import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/client/supabase';
import { Journal, Comment, TagItem } from '@/services/api';

export const BACKUP_KEY = 'mosi_database_local_backup_v1';
export const BACKUP_META_KEY = 'mosi_database_backup_meta_v1';

export interface LocalBackupData {
  version: string;
  timestamp: number;
  dateStr: string;
  data: {
    journals: Journal[];
    comments: Comment[];
    tags: TagItem[];
    userSettings?: Record<string, any>;
  };
}

export interface BackupMetaInfo {
  lastBackupTime: number | null;
  lastBackupDateStr: string;
  sizeBytes: number;
  count: {
    journals: number;
    comments: number;
    tags: number;
  };
}

// 格式化数据大小
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

// 执行全量备份（保存到 AsyncStorage）
export async function createLocalBackup(): Promise<{ success: boolean; meta: BackupMetaInfo; error?: string }> {
  try {
    // 1. 从 Supabase 拉取所有最新数据
    const [journalsRes, commentsRes, tagsRes] = await Promise.all([
      supabase.from('journals').select('*').order('created_at', { ascending: false }),
      supabase.from('comments').select('*').order('created_at', { ascending: true }),
      supabase.from('tag_catalog').select('*').order('sort_order', { ascending: true }),
    ]);

    const journals = (journalsRes.data || []) as Journal[];
    const comments = (commentsRes.data || []) as Comment[];
    const tags = (tagsRes.data || []) as TagItem[];

    const now = Date.now();
    const dateStr = new Date(now).toLocaleString('zh-CN', { hour12: false });

    const backupPayload: LocalBackupData = {
      version: '1.0',
      timestamp: now,
      dateStr,
      data: {
        journals,
        comments,
        tags,
      },
    };

    const jsonStr = JSON.stringify(backupPayload);
    const sizeBytes = new Blob([jsonStr]).size;

    await AsyncStorage.setItem(BACKUP_KEY, jsonStr);

    const meta: BackupMetaInfo = {
      lastBackupTime: now,
      lastBackupDateStr: dateStr,
      sizeBytes,
      count: {
        journals: journals.length,
        comments: comments.length,
        tags: tags.length,
      },
    };

    await AsyncStorage.setItem(BACKUP_META_KEY, JSON.stringify(meta));
    return { success: true, meta };
  } catch (err: any) {
    console.error('createLocalBackup error:', err);
    return {
      success: false,
      meta: {
        lastBackupTime: null,
        lastBackupDateStr: '备份失败',
        sizeBytes: 0,
        count: { journals: 0, comments: 0, tags: 0 },
      },
      error: err?.message || '备份异常',
    };
  }
}

// 获取备份元信息
export async function getLocalBackupMeta(): Promise<BackupMetaInfo | null> {
  try {
    const rawMeta = await AsyncStorage.getItem(BACKUP_META_KEY);
    if (rawMeta) {
      return JSON.parse(rawMeta);
    }
    const rawBackup = await AsyncStorage.getItem(BACKUP_KEY);
    if (!rawBackup) return null;
    const parsed: LocalBackupData = JSON.parse(rawBackup);
    const sizeBytes = new Blob([rawBackup]).size;
    return {
      lastBackupTime: parsed.timestamp,
      lastBackupDateStr: parsed.dateStr,
      sizeBytes,
      count: {
        journals: parsed.data.journals?.length || 0,
        comments: parsed.data.comments?.length || 0,
        tags: parsed.data.tags?.length || 0,
      },
    };
  } catch {
    return null;
  }
}

// 获取本地备份数据
export async function getLocalBackupData(): Promise<LocalBackupData | null> {
  try {
    const raw = await AsyncStorage.getItem(BACKUP_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// 从本地备份中一键恢复到数据库
export async function restoreFromLocalBackup(): Promise<{ success: boolean; message: string }> {
  try {
    const backup = await getLocalBackupData();
    if (!backup || !backup.data) {
      return { success: false, message: '未找到本地备份数据，无法恢复' };
    }

    const { journals, comments, tags } = backup.data;

    // 1. 恢复 journals
    if (journals && journals.length > 0) {
      const { error: jErr } = await supabase.from('journals').upsert(journals, { onConflict: 'id' });
      if (jErr) console.warn('恢复日志异常:', jErr);
    }

    // 2. 恢复 comments
    if (comments && comments.length > 0) {
      const { error: cErr } = await supabase.from('comments').upsert(comments, { onConflict: 'id' });
      if (cErr) console.warn('恢复留言异常:', cErr);
    }

    // 3. 恢复 tag_catalog
    if (tags && tags.length > 0) {
      const cleanTags = tags.map((t) => ({
        id: t.id,
        category: t.category,
        type: t.category,
        name: t.name,
        emoji: t.emoji || '',
        sort_order: t.sort_order || 99,
      }));
      const { error: tErr } = await supabase.from('tag_catalog').upsert(cleanTags, { onConflict: 'id' });
      if (tErr) console.warn('恢复标签异常:', tErr);
    }

    return { success: true, message: `成功恢复 ${journals?.length || 0} 篇日志、${comments?.length || 0} 条评论、${tags?.length || 0} 个标签！` };
  } catch (err: any) {
    console.error('restoreFromLocalBackup error:', err);
    return { success: false, message: err?.message || '恢复过程出现错误' };
  }
}

// 清除本地备份数据
export async function clearLocalBackup(): Promise<boolean> {
  try {
    await AsyncStorage.multiRemove([BACKUP_KEY, BACKUP_META_KEY]);
    return true;
  } catch (e) {
    console.error('clearLocalBackup error:', e);
    return false;
  }
}

// 清除所有本地数据（退出登录时选择不保留数据时调用）
export async function clearAllLocalData(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    // 保留主题设置相关KEY避免界面闪烁，清除业务数据与备份
    const keysToRemove = keys.filter((k) => !k.includes('theme_preference'));
    if (keysToRemove.length > 0) {
      await AsyncStorage.multiRemove(keysToRemove);
    }
  } catch (e) {
    console.error('clearAllLocalData error:', e);
  }
}

// 别名与规范函数包装
export const fullBackup = createLocalBackup;
export const restoreBackup = restoreFromLocalBackup;
export async function getBackupMeta(): Promise<{ lastTime: string; size: number; entries: number }> {
  const meta = await getLocalBackupMeta();
  return {
    lastTime: meta?.lastBackupDateStr || '未备份',
    size: meta?.sizeBytes || 0,
    entries: (meta?.count?.journals || 0) + (meta?.count?.comments || 0) + (meta?.count?.tags || 0),
  };
}
export const autoBackup = triggerAutoBackupDebounced;

// 自动后台触发备份防抖机制
let backupTimer: ReturnType<typeof setTimeout> | null = null;
export function triggerAutoBackupDebounced(delay = 1500): void {
  if (backupTimer) clearTimeout(backupTimer);
  backupTimer = setTimeout(() => {
    createLocalBackup().catch((e) => console.log('Auto backup silent error:', e));
  }, delay);
}
