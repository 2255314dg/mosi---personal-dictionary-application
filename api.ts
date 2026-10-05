import { supabase } from '@/client/supabase';
import { triggerAutoBackupDebounced, getLocalBackupData } from '@/utils/backup';

export interface Journal {
  id: string;
  author_id?: string;
  title: string;
  content: string;
  content_type: 'pure_text' | 'with_image' | 'dialogue';
  theme_tags: string[];
  mood_tag?: string;
  weather_tag?: string;
  location_tag?: string;
  views_count: number;
  created_at: string;
  updated_at: string;
}

export interface Comment {
  id: string;
  journal_id: string;
  user_id?: string;
  nickname: string;
  content: string;
  created_at: string;
}

export interface JournalVersion {
  id: string;
  journal_id: string;
  title: string;
  content: string;
  version_note?: string;
  created_at: string;
}

export interface MusicTrackDB {
  id: string;
  title: string;
  artist: string;
  url: string;
  duration: number;
  sort_order: number;
  is_builtin: boolean;
  created_at: string;
}

export interface JournalFilterParams {
  year?: string;
  month?: string;
  contentType?: string;
  themeTag?: string;
  moodTag?: string;
  weatherTag?: string;
  locationTag?: string;
  keyword?: string;
}

// 自动检测正文内容形态
export function detectContentType(content: string): 'pure_text' | 'with_image' | 'dialogue' {
  if (/!\[.*?\]\(.*?\)|<img/i.test(content)) {
    return 'with_image';
  }
  // 检测对话模式（如：“学者：”、“青年：”或者 “> **某某**：”）
  if (/(学者|青年|苏格拉底|斐多|问|答|A|B)[:：]|>\s*\*\*.*?\*\*[:：]/i.test(content)) {
    return 'dialogue';
  }
  return 'pure_text';
}

// 提取正文前30个字作为无标题时的标题
export function getJournalDisplayTitle(journal: { title?: string; content: string }): string {
  if (journal.title && journal.title.trim().length > 0) {
    return journal.title.trim();
  }
  const clean = journal.content.replace(/#+\s+/g, '').replace(/[>*\-_`\[\]()]/g, '').trim();
  return clean.slice(0, 30) || '无题思辨';
}

// 提取正文前200字纯文本摘要
export function getJournalSummary(content: string, length = 200): string {
  const clean = content
    .replace(/!\[.*?\]\(.*?\)/g, '[图片]')
    .replace(/#+\s+/g, '')
    .replace(/[>*\-_`]/g, '')
    .replace(/\n+/g, ' ')
    .trim();
  return clean.slice(0, length) + (clean.length > length ? '...' : '');
}

// 查询日志列表，支持多维度组合筛选
export async function getJournals(params?: JournalFilterParams): Promise<Journal[]> {
  let query = supabase.from('journals').select('*').order('created_at', { ascending: false });

  if (params?.contentType) {
    query = query.eq('content_type', params.contentType);
  }
  if (params?.moodTag) {
    query = query.eq('mood_tag', params.moodTag);
  }
  if (params?.weatherTag) {
    query = query.eq('weather_tag', params.weatherTag);
  }
  if (params?.locationTag) {
    query = query.eq('location_tag', params.locationTag);
  }
  if (params?.themeTag) {
    query = query.contains('theme_tags', [params.themeTag]);
  }

  const { data, error } = await query;
  if (error) {
    console.warn('getJournals 网络或查询异常，尝试使用本地备份降级:', error);
    try {
      const backup = await getLocalBackupData();
      if (backup?.data?.journals && backup.data.journals.length > 0) {
        let list = backup.data.journals;
        if (params?.themeTag) list = list.filter((j) => j.theme_tags?.includes(params.themeTag!));
        if (params?.moodTag) list = list.filter((j) => j.mood_tag === params.moodTag);
        if (params?.weatherTag) list = list.filter((j) => j.weather_tag === params.weatherTag);
        if (params?.contentType) list = list.filter((j) => j.content_type === params.contentType);
        if (params?.year) list = list.filter((j) => new Date(j.created_at).getFullYear().toString() === params.year);
        if (params?.month) list = list.filter((j) => (new Date(j.created_at).getMonth() + 1).toString().padStart(2, '0') === params.month);
        if (params?.keyword && params.keyword.trim().length > 0) {
          const kw = params.keyword.toLowerCase().trim();
          list = list.filter((j) => j.title.toLowerCase().includes(kw) || j.content.toLowerCase().includes(kw));
        }
        return list;
      }
    } catch {
      // ignore
    }
    return [];
  }

  let list = (data || []) as Journal[];

  // 客户端过滤年月与全文搜索关键词
  if (params?.year) {
    list = list.filter((j) => new Date(j.created_at).getFullYear().toString() === params.year);
  }
  if (params?.month) {
    list = list.filter((j) => (new Date(j.created_at).getMonth() + 1).toString().padStart(2, '0') === params.month);
  }
  if (params?.keyword && params.keyword.trim().length > 0) {
    const kw = params.keyword.toLowerCase().trim();
    list = list.filter(
      (j) => j.title.toLowerCase().includes(kw) || j.content.toLowerCase().includes(kw)
    );
  }

  return list;
}

// 获取单篇日志详情
export async function getJournalById(id: string): Promise<Journal | null> {
  const { data, error } = await supabase.from('journals').select('*').eq('id', id).single();
  if (error || !data) return null;
  return data as Journal;
}

// 递增阅读量（基于本地缓存简单防刷）
export async function incrementJournalViews(id: string): Promise<void> {
  try {
    const key = `viewed_journal_${id}`;
    if (typeof window !== 'undefined' && window.localStorage) {
      const lastView = window.localStorage.getItem(key);
      const now = Date.now();
      if (lastView && now - Number(lastView) < 24 * 3600 * 1000) {
        return; // 24小时内不重复计
      }
      window.localStorage.setItem(key, String(now));
    }
    // 增加计数
    const { data } = await supabase.from('journals').select('views_count').eq('id', id).single();
    if (data) {
      await supabase.from('journals').update({ views_count: (data.views_count || 0) + 1 }).eq('id', id);
    }
  } catch {
    // ignore
  }
}

// 创建或编辑日志
export async function saveJournal(payload: {
  id?: string;
  title: string;
  content: string;
  content_type?: 'pure_text' | 'with_image' | 'dialogue';
  theme_tags?: string[];
  mood_tag?: string;
  weather_tag?: string;
  location_tag?: string;
  created_at?: string;
  version_note?: string;
}): Promise<{ data: Journal | null; error: Error | null }> {
  const cType = payload.content_type || detectContentType(payload.content);
  const now = new Date().toISOString();

  if (payload.id) {
    // 编辑更新
    const { data, error } = await supabase
      .from('journals')
      .update({
        title: payload.title,
        content: payload.content,
        content_type: cType,
        theme_tags: payload.theme_tags || [],
        mood_tag: payload.mood_tag || '平静',
        weather_tag: payload.weather_tag || '晴',
        location_tag: payload.location_tag || '许昌',
        created_at: payload.created_at || now,
        updated_at: now,
      })
      .eq('id', payload.id)
      .select()
      .single();

    if (error) return { data: null, error: new Error(error.message) };

    // 保存历史版本
    await supabase.from('journal_versions').insert({
      journal_id: payload.id,
      title: payload.title,
      content: payload.content,
      version_note: payload.version_note || '内容更新',
    });

    // 自动备份关键数据
    triggerAutoBackupDebounced();

    return { data: data as Journal, error: null };
  } else {
    // 新建
    const { data, error } = await supabase
      .from('journals')
      .insert({
        title: payload.title,
        content: payload.content,
        content_type: cType,
        theme_tags: payload.theme_tags || [],
        mood_tag: payload.mood_tag || '平静',
        weather_tag: payload.weather_tag || '晴',
        location_tag: payload.location_tag || '许昌',
        created_at: payload.created_at || now,
      })
      .select()
      .single();

    if (error) return { data: null, error: new Error(error.message) };

    if (data) {
      await supabase.from('journal_versions').insert({
        journal_id: data.id,
        title: payload.title,
        content: payload.content,
        version_note: '初始创建',
      });
    }

    // 自动备份关键数据
    triggerAutoBackupDebounced();

    return { data: data as Journal, error: null };
  }
}

// 删除日志
export async function deleteJournal(id: string): Promise<boolean> {
  const { error } = await supabase.from('journals').delete().eq('id', id);
  if (!error) {
    triggerAutoBackupDebounced();
  }
  return !error;
}

// 获取日志版本历史
export async function getJournalVersions(journalId: string): Promise<JournalVersion[]> {
  const { data, error } = await supabase
    .from('journal_versions')
    .select('*')
    .eq('journal_id', journalId)
    .order('created_at', { ascending: false });
  if (error) return [];
  return data as JournalVersion[];
}

// 留言相关 API (支持访客免注册)
export async function getComments(journalId: string): Promise<Comment[]> {
  const { data, error } = await supabase
    .from('comments')
    .select('*')
    .eq('journal_id', journalId)
    .order('created_at', { ascending: true });
  if (error) return [];
  return data as Comment[];
}

export async function addComment(payload: {
  journal_id: string;
  nickname: string;
  content: string;
  user_id?: string;
}): Promise<{ data: Comment | null; error: Error | null }> {
  const { data, error } = await supabase
    .from('comments')
    .insert({
      journal_id: payload.journal_id,
      nickname: payload.nickname.trim() || '过客',
      content: payload.content.trim(),
      user_id: payload.user_id || null,
    })
    .select()
    .single();

  if (error) return { data: null, error: new Error(error.message) };
  triggerAutoBackupDebounced();
  return { data: data as Comment, error: null };
}

export async function getAllComments(): Promise<(Comment & { journal_title?: string })[]> {
  const { data, error } = await supabase
    .from('comments')
    .select('*, journals(title)')
    .order('created_at', { ascending: false });
  if (error) return [];
  return data.map((c: any) => ({
    ...c,
    journal_title: c.journals?.title || '无题',
  }));
}

export async function deleteComment(id: string): Promise<boolean> {
  const { error } = await supabase.from('comments').delete().eq('id', id);
  if (!error) {
    triggerAutoBackupDebounced();
  }
  return !error;
}

// 音乐曲目 API
export async function getMusicTracksDB(): Promise<MusicTrackDB[]> {
  const { data, error } = await supabase.from('music_tracks').select('*').order('sort_order', { ascending: true });
  if (error) return [];
  return data as MusicTrackDB[];
}

export async function addMusicTrackDB(track: {
  title: string;
  artist?: string;
  url: string;
  duration?: number;
  sort_order?: number;
}): Promise<MusicTrackDB | null> {
  const { data, error } = await supabase
    .from('music_tracks')
    .insert({
      title: track.title,
      artist: track.artist || '未知艺术家',
      url: track.url,
      duration: track.duration || 180,
      sort_order: track.sort_order || 99,
      is_builtin: false,
    })
    .select()
    .single();
  if (error) return null;
  return data as MusicTrackDB;
}

export async function deleteMusicTrackDB(id: string): Promise<boolean> {
  const { error } = await supabase.from('music_tracks').delete().eq('id', id);
  return !error;
}

/**
 * 上传音乐文件到 Supabase Storage 的 music bucket
 * @param fileUri 本地文件 URI (file:// 或 content:// 或 web blob:)
 * @param fileName 原始文件名
 * @param mimeType 文件 MIME 类型
 */
export async function uploadMusicFile(
  fileUri: string,
  fileName: string,
  mimeType = 'audio/mpeg'
): Promise<string> {
  const fileExt = fileName.split('.').pop()?.toLowerCase() || 'mp3';
  const cleanBaseName = fileName
    .replace(/\.[^/.]+$/, '')
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .slice(0, 30);
  const uniqueKey = `${Date.now()}_${cleanBaseName || 'audio'}.${fileExt}`;

  const response = await fetch(fileUri);
  const arrayBuffer = await response.arrayBuffer();

  const { error } = await supabase.storage
    .from('music')
    .upload(uniqueKey, arrayBuffer, {
      contentType: mimeType || 'audio/mpeg',
      upsert: false,
    });

  if (error) {
    throw new Error(`音频上传失败: ${error.message}`);
  }

  const { data: urlData } = supabase.storage.from('music').getPublicUrl(uniqueKey);
  return urlData.publicUrl;
}

/**
 * 上传图片文件到 Supabase Storage 的 journal-images bucket
 * @param imageUri 本地图片 URI
 * @param fileName 可选原始文件名
 */
export async function uploadJournalImage(
  imageUri: string,
  fileName?: string
): Promise<string> {
  const ext = fileName ? fileName.split('.').pop()?.toLowerCase() || 'jpg' : 'jpg';
  const uniqueKey = `images/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

  const response = await fetch(imageUri);
  const arrayBuffer = await response.arrayBuffer();

  const { error } = await supabase.storage
    .from('journal-images')
    .upload(uniqueKey, arrayBuffer, {
      contentType: ext === 'png' ? 'image/png' : 'image/jpeg',
      upsert: false,
    });

  if (error) {
    throw new Error(`图片上传失败: ${error.message}`);
  }

  const { data: urlData } = supabase.storage.from('journal-images').getPublicUrl(uniqueKey);
  return urlData.publicUrl;
}

// 分类标签项接口
export interface TagItem {
  id: string;
  category: 'theme' | 'mood' | 'weather';
  type?: 'theme' | 'mood' | 'weather';
  name: string;
  emoji?: string;
  sort_order: number;
  created_at?: string;
}

// 获取分类标签列表
export async function getTagCatalogDB(): Promise<TagItem[]> {
  const { data, error } = await supabase
    .from('tag_catalog')
    .select('*')
    .order('sort_order', { ascending: true });
  if (error || !data || data.length === 0) {
    // 降级返回默认项
    return [
      { id: '1', category: 'theme', type: 'theme', name: '自我认知', emoji: '💭', sort_order: 1 },
      { id: '2', category: 'theme', type: 'theme', name: '关系与情感', emoji: '❤️', sort_order: 2 },
      { id: '3', category: 'theme', type: 'theme', name: '存在与意义', emoji: '🌌', sort_order: 3 },
      { id: '4', category: 'theme', type: 'theme', name: '生命哲学', emoji: '🌱', sort_order: 4 },
      { id: '5', category: 'theme', type: 'theme', name: '社会批判', emoji: '⚡', sort_order: 5 },
      { id: '6', category: 'theme', type: 'theme', name: '美与艺术', emoji: '🎨', sort_order: 6 },
      { id: '7', category: 'mood', type: 'mood', name: '平静', emoji: '🌊', sort_order: 1 },
      { id: '8', category: 'mood', type: 'mood', name: '困惑', emoji: '🌀', sort_order: 2 },
      { id: '9', category: 'mood', type: 'mood', name: '释然', emoji: '🕊️', sort_order: 3 },
      { id: '10', category: 'mood', type: 'mood', name: '焦虑', emoji: '🌧️', sort_order: 4 },
      { id: '11', category: 'mood', type: 'mood', name: '深沉', emoji: '🕯️', sort_order: 5 },
      { id: '12', category: 'mood', type: 'mood', name: '愉悦', emoji: '✨', sort_order: 6 },
      { id: '13', category: 'weather', type: 'weather', name: '晴', emoji: '☀️', sort_order: 1 },
      { id: '14', category: 'weather', type: 'weather', name: '阴', emoji: '⛅', sort_order: 2 },
      { id: '15', category: 'weather', type: 'weather', name: '雨', emoji: '🌧️', sort_order: 3 },
      { id: '16', category: 'weather', type: 'weather', name: '雪', emoji: '❄️', sort_order: 4 },
      { id: '17', category: 'weather', type: 'weather', name: '风', emoji: '💨', sort_order: 5 },
    ];
  }
  return data.map((item) => ({
    ...item,
    category: (item.type || item.category || 'theme') as 'theme' | 'mood' | 'weather',
    type: (item.type || item.category || 'theme') as 'theme' | 'mood' | 'weather',
    emoji: item.emoji || '',
  })) as TagItem[];
}

// 添加/创建分类标签
export async function addTagCatalogDB(tag: {
  category: 'theme' | 'mood' | 'weather';
  name: string;
  emoji?: string;
  sort_order?: number;
}): Promise<TagItem | null> {
  const { data, error } = await supabase
    .from('tag_catalog')
    .insert({
      category: tag.category,
      type: tag.category,
      name: tag.name.trim(),
      emoji: tag.emoji?.trim() || '',
      sort_order: tag.sort_order || 99,
    })
    .select()
    .single();
  if (error) return null;
  triggerAutoBackupDebounced();
  return {
    ...data,
    category: (data.type || data.category || 'theme') as 'theme' | 'mood' | 'weather',
    type: (data.type || data.category || 'theme') as 'theme' | 'mood' | 'weather',
  } as TagItem;
}

// 别名导出以兼容 createTagCatalogDB 命名
export const createTagCatalogDB = addTagCatalogDB;

// 编辑/更新分类标签
export async function updateTagCatalogDB(
  id: string,
  tag: {
    category?: 'theme' | 'mood' | 'weather';
    name?: string;
    emoji?: string;
    sort_order?: number;
  }
): Promise<TagItem | null> {
  const updatePayload: Record<string, any> = {};
  if (tag.category) {
    updatePayload.category = tag.category;
    updatePayload.type = tag.category;
  }
  if (tag.name !== undefined) updatePayload.name = tag.name.trim();
  if (tag.emoji !== undefined) updatePayload.emoji = tag.emoji.trim();
  if (tag.sort_order !== undefined) updatePayload.sort_order = tag.sort_order;

  const { data, error } = await supabase
    .from('tag_catalog')
    .update(updatePayload)
    .eq('id', id)
    .select()
    .single();
  if (error) return null;
  triggerAutoBackupDebounced();
  return {
    ...data,
    category: (data.type || data.category || 'theme') as 'theme' | 'mood' | 'weather',
    type: (data.type || data.category || 'theme') as 'theme' | 'mood' | 'weather',
  } as TagItem;
}

// 删除分类标签
export async function deleteTagCatalogDB(id: string): Promise<boolean> {
  const { error } = await supabase.from('tag_catalog').delete().eq('id', id);
  if (!error) {
    triggerAutoBackupDebounced();
  }
  return !error;
}

// 管理员角色判断与状态检查
export async function checkIsAdmin(): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    return Boolean(profile?.role === 'admin' || user.email?.includes('admin'));
  } catch {
    return false;
  }
}

export interface UserProfileData {
  id: string;
  username: string;
  nickname: string;
  real_name?: string;
  gender?: 'male' | 'female' | 'secret';
  bio?: string;
  avatar_url?: string;
  role: string;
  created_at: string;
  security_question?: string;
  security_answer?: string;
}

// 获取当前用户 Profile 详情与统计
export async function getCurrentUserProfile(): Promise<{
  profile: UserProfileData | null;
  journalsCount: number;
  commentsCount: number;
}> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { profile: null, journalsCount: 0, commentsCount: 0 };

    // 获取 profile
    let { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    if (!profile) {
      // 容错插入
      const role = user.email?.includes('admin') ? 'admin' : 'user';
      const username = user.email?.split('@')[0] || '读者';
      const insertRes = await supabase.from('profiles').insert({
        id: user.id,
        username,
        nickname: username,
        role,
      }).select().single();
      profile = insertRes.data;
    }

    // 获取统计
    const [jCountRes, cCountRes] = await Promise.all([
      supabase.from('journals').select('id', { count: 'exact', head: true }),
      supabase.from('comments').select('id', { count: 'exact', head: true }),
    ]);

    return {
      profile: profile as UserProfileData,
      journalsCount: jCountRes.count || 0,
      commentsCount: cCountRes.count || 0,
    };
  } catch (err) {
    console.error('getCurrentUserProfile error:', err);
    return { profile: null, journalsCount: 0, commentsCount: 0 };
  }
}

// 更新用户个人资料
export async function updateUserProfile(payload: {
  nickname?: string;
  real_name?: string;
  gender?: 'male' | 'female' | 'secret';
  bio?: string;
  avatar_url?: string;
  security_question?: string;
  security_answer?: string;
}): Promise<{ success: boolean; message?: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, message: '用户未登录' };

    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };
    if (payload.nickname !== undefined) updateData.nickname = payload.nickname.trim();
    if (payload.real_name !== undefined) updateData.real_name = payload.real_name.trim();
    if (payload.gender !== undefined) updateData.gender = payload.gender;
    if (payload.bio !== undefined) updateData.bio = payload.bio.trim();
    if (payload.avatar_url !== undefined) updateData.avatar_url = payload.avatar_url;
    if (payload.security_question !== undefined) updateData.security_question = payload.security_question;
    if (payload.security_answer !== undefined) updateData.security_answer = payload.security_answer;

    const { error } = await supabase.from('profiles').update(updateData).eq('id', user.id);
    if (error) throw error;
    triggerAutoBackupDebounced();
    return { success: true };
  } catch (err: any) {
    return { success: false, message: err?.message || '保存资料失败' };
  }
}

// 修改当前登录管理员密码
export async function updateAdminPassword(params: {
  currentPassword: string;
  newPassword: string;
}): Promise<{ success: boolean; message: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !user.email) {
      return { success: false, message: '请先登录管理员账号' };
    }

    // 1. 验证当前密码是否正确
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: params.currentPassword,
    });

    if (signInError) {
      return { success: false, message: '当前原密码错误，请核对后重试' };
    }

    // 2. 更新为新密码
    const { error: updateError } = await supabase.auth.updateUser({
      password: params.newPassword,
    });

    if (updateError) {
      return { success: false, message: updateError.message || '更新密码失败' };
    }

    return { success: true, message: '密码修改成功' };
  } catch (err: any) {
    return { success: false, message: err?.message || '网络或认证异常' };
  }
}

// ----------------- 邀请码与系统设置相关接口 -----------------

export interface InvitationCode {
  id: string;
  code: string;
  created_by?: string | null;
  used_by?: string | null;
  used_at?: string | null;
  max_uses: number;
  uses_count: number;
  expires_at?: string | null;
  is_active: boolean;
  created_at: string;
}

// 查询全局设置：是否需要邀请码注册
export async function getRequireInvitationCodeSetting(): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'require_invitation_code')
      .maybeSingle();
    if (error || !data) return true; // 默认要求
    return data.value === true || data.value === 'true';
  } catch {
    return true;
  }
}

// 更新是否需要邀请码注册设置 (仅管理员)
export async function updateRequireInvitationCodeSetting(required: boolean): Promise<boolean> {
  const { error } = await supabase
    .from('app_settings')
    .upsert({
      key: 'require_invitation_code',
      value: required,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'key' });
  return !error;
}

// 校验邀请码有效性 (code 存在、is_active=true、未过期、未超限)
export async function verifyInvitationCode(code: string): Promise<{ valid: boolean; message?: string; record?: InvitationCode }> {
  const cleanCode = code.trim().toUpperCase();
  if (!cleanCode) {
    return { valid: false, message: '请输入邀请码' };
  }

  const { data, error } = await supabase
    .from('invitation_codes')
    .select('*')
    .ilike('code', cleanCode)
    .maybeSingle();

  if (error || !data) {
    return { valid: false, message: '邀请码无效或不存在' };
  }

  const item = data as InvitationCode;

  if (!item.is_active) {
    return { valid: false, message: '该邀请码已被管理员停用' };
  }

  if (item.expires_at && new Date(item.expires_at) < new Date()) {
    return { valid: false, message: '该邀请码已过期' };
  }

  if (item.max_uses > 0 && item.uses_count >= item.max_uses) {
    return { valid: false, message: '邀请码无效或已被使用' };
  }

  return { valid: true, record: item };
}

// 标记邀请码为已使用
export async function consumeInvitationCode(code: string, userId: string): Promise<boolean> {
  const cleanCode = code.trim().toUpperCase();
  const { data: record } = await supabase
    .from('invitation_codes')
    .select('*')
    .ilike('code', cleanCode)
    .maybeSingle();

  if (!record) return false;

  const newCount = (record.uses_count || 0) + 1;
  const updatePayload: Record<string, unknown> = {
    uses_count: newCount,
    used_at: new Date().toISOString(),
  };

  if (!record.used_by) {
    updatePayload.used_by = userId;
  }

  const { error } = await supabase
    .from('invitation_codes')
    .update(updatePayload)
    .eq('id', record.id);

  return !error;
}

// 获取全部邀请码列表 (管理员)
export async function getInvitationCodes(): Promise<InvitationCode[]> {
  const { data, error } = await supabase
    .from('invitation_codes')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return [];
  return (data || []) as InvitationCode[];
}

// 生成新的邀请码 (管理员)
export function generateRandomCode(length = 8): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export async function createInvitationCode(params: {
  code?: string;
  max_uses?: number;
  expires_days?: number;
}): Promise<InvitationCode | null> {
  const code = (params.code || generateRandomCode(8)).trim().toUpperCase();
  const max_uses = params.max_uses ?? 1;

  let expires_at: string | null = null;
  if (params.expires_days && params.expires_days > 0) {
    const d = new Date();
    d.setDate(d.getDate() + params.expires_days);
    expires_at = d.toISOString();
  }

  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('invitation_codes')
    .insert({
      code,
      max_uses,
      uses_count: 0,
      expires_at,
      is_active: true,
      created_by: user?.id || null,
    })
    .select()
    .single();

  if (error) return null;
  return data as InvitationCode;
}

// 切换邀请码激活状态 (管理员)
export async function toggleInvitationCodeActive(id: string, is_active: boolean): Promise<boolean> {
  const { error } = await supabase
    .from('invitation_codes')
    .update({ is_active })
    .eq('id', id);
  return !error;
}

// 删除未使用的邀请码 (管理员)
export async function deleteInvitationCode(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('invitation_codes')
    .delete()
    .eq('id', id);
  return !error;
}

