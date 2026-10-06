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
    if ((error as any).code === '42501' || /row-level security|permission denied|forbidden/i.test(error.message || '')) return [];
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
    // 使用数据库 RPC 原子递增，避免“读取→更新”竞态，也不需要向普通用户开放 journals UPDATE 权限。
    await supabase.rpc('increment_journal_views', { p_journal_id: id });
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
  createVersion?: boolean;
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
    if (payload.createVersion !== false) {
      await supabase.from('journal_versions').insert({
        journal_id: payload.id,
        title: payload.title,
        content: payload.content,
        version_note: payload.version_note || '内容更新',
      });
    }

    // 自动备份关键数据
    triggerAutoBackupDebounced();

    return { data: data as Journal, error: null };
  } else {
    // 新建
    const { data, error } = await supabase
      .from('journals')
      .insert({
        author_id: (await supabase.auth.getUser()).data.user?.id || null,
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
      if (payload.createVersion !== false) {
        await supabase.from('journal_versions').insert({
          journal_id: data.id,
          title: payload.title,
          content: payload.content,
          version_note: '初始创建',
        });
      }
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
const MAX_MUSIC_BYTES = 50 * 1024 * 1024;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ALLOWED_MUSIC_EXT = new Set(['mp3', 'm4a', 'wav', 'ogg']);
const ALLOWED_IMAGE_EXT = new Set(['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif']);

async function assertAdminForUpload(): Promise<void> {
  if (!(await checkIsAdmin())) throw new Error('仅管理员可以上传文件');
}

async function fetchArrayBufferWithLimit(uri: string, maxBytes: number): Promise<ArrayBuffer> {
  const response = await fetch(uri);
  if (!response.ok) throw new Error(`文件读取失败（HTTP ${response.status}）`);
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > maxBytes) throw new Error(`文件超过大小限制：${Math.round(maxBytes / 1024 / 1024)}MB`);
  return buffer;
}

export async function uploadMusicFile(
  fileUri: string,
  fileName: string,
  mimeType = 'audio/mpeg'
): Promise<string> {
  await assertAdminForUpload();
  const fileExt = fileName.split('.').pop()?.toLowerCase() || 'mp3';
  if (!ALLOWED_MUSIC_EXT.has(fileExt)) throw new Error('不支持的音频格式，仅允许 MP3/M4A/WAV/OGG');
  const cleanBaseName = fileName
    .replace(/\.[^/.]+$/, '')
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .slice(0, 30);
  const uniqueKey = `${Date.now()}_${cleanBaseName || 'audio'}.${fileExt}`;

  const arrayBuffer = await fetchArrayBufferWithLimit(fileUri, MAX_MUSIC_BYTES);

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
  await assertAdminForUpload();
  const ext = fileName ? fileName.split('.').pop()?.toLowerCase() || 'jpg' : 'jpg';
  if (!ALLOWED_IMAGE_EXT.has(ext)) throw new Error('不支持的图片格式，仅允许 JPG/JPEG/PNG/WEBP');
  const uniqueKey = `images/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

  const arrayBuffer = await fetchArrayBufferWithLimit(imageUri, MAX_IMAGE_BYTES);

  const { error } = await supabase.storage
    .from('journal-images')
    .upload(uniqueKey, arrayBuffer, {
      contentType: ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg',
      upsert: false,
    });

  if (error) {
    throw new Error(`图片上传失败：${error.message}`);
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
    return profile?.role === 'admin';
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
    let { data: profile } = await supabase.from('profiles').select('id,username,nickname,avatar_url,role,created_at,updated_at,real_name,gender,bio,security_question').eq('id', user.id).single();
    if (!profile) {
      // 容错插入
      const role = 'user';
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
      supabase.from('journals').select('id', { count: 'exact', head: true }).eq('author_id', user.id),
      supabase.from('comments').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
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
    if (Object.keys(updateData).length > 1) {
      const { error } = await supabase.from('profiles').update(updateData).eq('id', user.id);
      if (error) throw error;
    }

    if (payload.security_question !== undefined || payload.security_answer !== undefined) {
      if (!payload.security_question || !payload.security_answer) {
        throw new Error('安全问题与答案必须同时填写');
      }
      const { error } = await supabase.rpc('set_security_answer', {
        p_question: payload.security_question,
        p_answer: payload.security_answer,
      });
      if (error) throw error;
    }

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
export async function verifyInvitationCode(code: string): Promise<{ valid: boolean; message?: string }> {
  const cleanCode = code.trim().toUpperCase();
  if (!cleanCode) return { valid: false, message: '请输入邀请码' };

  const { data, error } = await supabase.rpc('verify_invitation_code', { p_code: cleanCode });
  if (error || !data?.[0]) return { valid: false, message: '邀请码校验服务暂不可用' };
  return { valid: Boolean(data[0].valid), message: data[0].message };
}

// 使用数据库原子 RPC 核销邀请码，避免并发注册时超额使用。
export async function consumeInvitationCode(code: string, userId: string): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.id !== userId) return false;
  const { data, error } = await supabase.rpc('consume_invitation_code', {
    p_code: code.trim().toUpperCase(),
    p_user_id: userId,
  });
  return !error && data === true;
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
  const bytes = new Uint32Array(length);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < length; i++) bytes[i] = Math.floor(Math.random() * 0xffffffff);
  }
  return Array.from(bytes, (n) => chars[n % chars.length]).join('');
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


// ---------------- V4.1 / V5 foundation ----------------
export interface SecurityPolicy {
  security_pin_enabled: boolean;
  security_gesture_enabled: boolean;
  autosave_interval_seconds: number;
  local_backup_interval_seconds: number;
  device_allowlist_enabled: boolean;
  share_link_default_days: number;
}

export interface DeviceRegistryItem {
  id: string;
  device_id: string;
  user_id: string;
  device_name: string;
  platform: string;
  app_version?: string;
  approved: boolean;
  approved_by?: string;
  approved_at?: string;
  last_seen_at?: string;
  created_at: string;
}

export interface AuditLogItem {
  id: number;
  actor_user_id?: string;
  actor_device_id?: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  severity: 'info' | 'warning' | 'critical';
  before_data?: any;
  after_data?: any;
  metadata?: any;
  created_at: string;
}

export async function getSecurityPolicyDB(): Promise<SecurityPolicy | null> {
  const { data, error } = await supabase.rpc('get_mosi_security_policy');
  if (error || !data) return null;
  return data as SecurityPolicy;
}

export async function setSecurityPolicyDB(key: keyof SecurityPolicy, value: boolean | number): Promise<boolean> {
  const { error } = await supabase.rpc('set_mosi_security_policy', { p_key: key, p_value: value });
  return !error;
}

export async function getDeviceRegistry(): Promise<DeviceRegistryItem[]> {
  const { data, error } = await supabase.from('device_registry').select('*').order('created_at', { ascending: false });
  return error ? [] : (data as DeviceRegistryItem[]);
}

export async function setDeviceApproval(id: string, approved: boolean): Promise<boolean> {
  const { data, error } = await supabase.rpc('set_device_approval', { p_device_registry_id: id, p_approved: approved });
  return !error && data === true;
}

export async function getAuditLogs(limit = 200): Promise<AuditLogItem[]> {
  const { data, error } = await supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(limit);
  return error ? [] : (data as AuditLogItem[]);
}

export async function createShareLink(journalId: string, days?: number): Promise<{ token: string; url: string; expires_at: string | null } | null> {
  const { data, error } = await supabase.rpc('create_mosi_share_link', { p_journal_id: journalId, p_days: days ?? null });
  if (error || !data) return null;
  const row = Array.isArray(data) ? data[0] : data;
  return row || null;
}

export interface SharedJournal {
  title: string;
  content: string;
  content_type: string;
  theme_tags: string[];
  mood_tag: string;
  weather_tag: string;
  location_tag: string;
  created_at: string;
  expires_at: string | null;
  share_id: string;
}

export async function getSharedJournal(token: string): Promise<SharedJournal | null> {
  const { data, error } = await supabase.rpc('get_mosi_shared_journal', { p_token: token });
  if (error || !data) return null;
  const row = Array.isArray(data) ? data[0] : data;
  return row || null;
}

export async function revokeShareLink(shareId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('revoke_mosi_share_link', { p_share_id: shareId });
  return !error && data === true;
}

// ----------------- V4.2 Structured Personal Thought Database -----------------

export type ThoughtEntityType = 'concept' | 'person' | 'theory' | 'claim' | 'argument';
export type ThoughtJournalRole = 'mentioned' | 'core' | 'supporting' | 'counterpoint' | 'source' | 'question';

export interface ThoughtBase {
  id: string;
  name: string;
  canonical_key?: string;
  aliases?: string[];
  summary?: string;
  description?: string;
  metadata?: Record<string, any>;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ThoughtConcept extends ThoughtBase {}
export interface ThoughtPerson extends ThoughtBase {
  birth_year?: number | null;
  death_year?: number | null;
  roles?: string[];
}
export interface ThoughtTheory extends ThoughtBase {
  school?: string;
  period?: string;
}
export interface ThoughtClaim extends Omit<ThoughtBase, 'name'> {
  statement: string;
  stance: 'supports' | 'opposes' | 'neutral' | 'question';
  confidence?: number | null;
  source_note?: string;
}
export interface ThoughtArgument extends ThoughtBase {
  argument_type?: string;
  thesis?: string;
  premises?: string[];
  conclusion?: string;
  strength?: number | null;
  counterargument?: string;
}

export interface JournalEntityLink {
  id: string;
  journal_id: string;
  entity_type: ThoughtEntityType;
  entity_id: string;
  role: ThoughtJournalRole;
  mention: string;
  note: string;
  sort_order: number;
  created_by?: string | null;
  created_at: string;
  entity?: ThoughtBase & { statement?: string };
}

export interface JournalRelation {
  id: string;
  journal_id?: string | null;
  source_type: ThoughtEntityType;
  source_id: string;
  target_type: ThoughtEntityType;
  target_id: string;
  relation_type: string;
  weight?: number | null;
  note: string;
  created_by?: string | null;
  created_at: string;
}

export interface ThoughtEntitySummary {
  id: string;
  entity_type: ThoughtEntityType;
  name: string;
  summary: string;
  aliases: string[];
  updated_at: string;
}

const THOUGHT_TABLE: Record<ThoughtEntityType, string> = {
  concept: 'thought_concepts',
  person: 'thought_people',
  theory: 'thought_theories',
  claim: 'thought_claims',
  argument: 'thought_arguments',
};

function normalizeThoughtName(type: ThoughtEntityType, row: any): string {
  return type === 'claim' ? String(row.statement || '').trim() : String(row.name || '').trim();
}

function normalizeThoughtRow(type: ThoughtEntityType, row: any): ThoughtEntitySummary {
  return {
    id: row.id,
    entity_type: type,
    name: normalizeThoughtName(type, row),
    summary: String(row.summary || row.description || row.source_note || '').trim(),
    aliases: Array.isArray(row.aliases) ? row.aliases : [],
    updated_at: row.updated_at || row.created_at,
  };
}

export async function getThoughtEntities(params?: {
  type?: ThoughtEntityType;
  keyword?: string;
  limit?: number;
}): Promise<ThoughtEntitySummary[]> {
  const types = params?.type ? [params.type] : (Object.keys(THOUGHT_TABLE) as ThoughtEntityType[]);
  const limit = Math.min(Math.max(params?.limit || 200, 1), 500);
  const keyword = params?.keyword?.trim().toLowerCase();
  const results = await Promise.all(types.map(async (type) => {
    const { data, error } = await supabase.from(THOUGHT_TABLE[type]).select('*').order('updated_at', { ascending: false }).limit(limit);
    if (error) return [] as ThoughtEntitySummary[];
    return (data || []).map((row: any) => normalizeThoughtRow(type, row));
  }));
  const merged = results.flat();
  if (!keyword) return merged.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  return merged.filter((item) => `${item.name} ${item.summary} ${item.aliases.join(' ')}`.toLowerCase().includes(keyword));
}

export async function createThoughtEntity(type: ThoughtEntityType, payload: Record<string, any>): Promise<any | null> {
  const table = THOUGHT_TABLE[type];
  const clean = { ...payload };
  if (type === 'claim') {
    clean.statement = String(payload.statement || '').trim();
    delete clean.name;
  } else {
    clean.name = String(payload.name || '').trim();
  }
  if (type !== 'claim' && !clean.name) return null;
  if (type === 'claim' && !clean.statement) return null;
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase.from(table).insert({ ...clean, created_by: user?.id || null }).select().single();
  if (error) return null;
  triggerAutoBackupDebounced();
  return data;
}

export async function updateThoughtEntity(type: ThoughtEntityType, id: string, payload: Record<string, any>): Promise<any | null> {
  const { data, error } = await supabase.from(THOUGHT_TABLE[type]).update(payload).eq('id', id).select().single();
  if (error) return null;
  triggerAutoBackupDebounced();
  return data;
}

export async function deleteThoughtEntity(type: ThoughtEntityType, id: string): Promise<boolean> {
  const { error } = await supabase.from(THOUGHT_TABLE[type]).delete().eq('id', id);
  if (!error) triggerAutoBackupDebounced();
  return !error;
}

export async function getJournalEntities(journalId: string): Promise<JournalEntityLink[]> {
  const { data, error } = await supabase.from('journal_entities').select('*').eq('journal_id', journalId).order('sort_order', { ascending: true });
  if (error || !data) return [];
  const links = data as JournalEntityLink[];
  const enriched = await Promise.all(links.map(async (link) => {
    const { data: entity } = await supabase.from(THOUGHT_TABLE[link.entity_type]).select('*').eq('id', link.entity_id).maybeSingle();
    return { ...link, entity: entity ? { ...entity, name: normalizeThoughtName(link.entity_type, entity) } : undefined };
  }));
  return enriched;
}

export async function linkThoughtToJournal(payload: {
  journal_id: string;
  entity_type: ThoughtEntityType;
  entity_id: string;
  role?: ThoughtJournalRole;
  mention?: string;
  note?: string;
  sort_order?: number;
}): Promise<JournalEntityLink | null> {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase.from('journal_entities').upsert({
    ...payload,
    role: payload.role || 'mentioned',
    mention: payload.mention || '',
    note: payload.note || '',
    sort_order: payload.sort_order || 0,
    created_by: user?.id || null,
  }, { onConflict: 'journal_id,entity_type,entity_id' }).select().single();
  if (error) return null;
  triggerAutoBackupDebounced();
  return data as JournalEntityLink;
}

export async function unlinkThoughtFromJournal(linkId: string): Promise<boolean> {
  const { error } = await supabase.from('journal_entities').delete().eq('id', linkId);
  if (!error) triggerAutoBackupDebounced();
  return !error;
}

export async function getThoughtRelations(params?: { entityType?: ThoughtEntityType; entityId?: string; journalId?: string }): Promise<JournalRelation[]> {
  let query = supabase.from('journal_relations').select('*').order('created_at', { ascending: false });
  if (params?.entityType && params?.entityId) {
    query = query.or(`and(source_type.eq.${params.entityType},source_id.eq.${params.entityId}),and(target_type.eq.${params.entityType},target_id.eq.${params.entityId})`);
  }
  if (params?.journalId) query = query.eq('journal_id', params.journalId);
  const { data, error } = await query;
  if (error || !data) return [];
  return data as JournalRelation[];
}

export async function createThoughtRelation(payload: {
  journal_id?: string;
  source_type: ThoughtEntityType;
  source_id: string;
  target_type: ThoughtEntityType;
  target_id: string;
  relation_type: string;
  weight?: number;
  note?: string;
}): Promise<JournalRelation | null> {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase.from('journal_relations').insert({
    ...payload,
    relation_type: payload.relation_type.trim(),
    note: payload.note || '',
    created_by: user?.id || null,
  }).select().single();
  if (error) return null;
  triggerAutoBackupDebounced();
  return data as JournalRelation;
}

export async function deleteThoughtRelation(id: string): Promise<boolean> {
  const { error } = await supabase.from('journal_relations').delete().eq('id', id);
  if (!error) triggerAutoBackupDebounced();
  return !error;
}

export async function getThoughtDatabaseStats(): Promise<Record<string, number>> {
  const { data, error } = await supabase.rpc('get_thought_database_stats');
  if (error || !data) return {};
  return data as Record<string, number>;
}
