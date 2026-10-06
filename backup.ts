import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { supabase } from '@/client/supabase';
import type { Journal, Comment, TagItem } from '@/services/api';

export const BACKUP_KEY = 'mosi_database_local_backup_v2';
export const BACKUP_META_KEY = 'mosi_database_backup_meta_v2';
const BACKUP_KEY_STORAGE = 'mosi_database_backup_aes_key_v1';

export interface LocalBackupData {
  version: string;
  timestamp: number;
  dateStr: string;
  data: {
    journals: Journal[];
    comments: Comment[];
    tags: TagItem[];
    thought_concepts?: any[];
    thought_people?: any[];
    thought_theories?: any[];
    thought_claims?: any[];
    thought_arguments?: any[];
    journal_entities?: any[];
    journal_relations?: any[];
    userSettings?: Record<string, any>;
  };
}

export interface BackupMetaInfo {
  lastBackupTime: number | null;
  lastBackupDateStr: string;
  sizeBytes: number;
  count: { journals: number; comments: number; tags: number };
  encrypted: boolean;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return globalThis.btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = globalThis.atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function getOrCreateBackupKey(): Promise<CryptoKey> {
  if (!globalThis.crypto?.subtle || !globalThis.crypto?.getRandomValues) {
    throw new Error('当前运行环境不支持 AES-GCM 加密备份');
  }
  let encoded = await SecureStore.getItemAsync(BACKUP_KEY_STORAGE);
  if (!encoded) {
    const raw = new Uint8Array(32);
    globalThis.crypto.getRandomValues(raw);
    encoded = bytesToBase64(raw);
    await SecureStore.setItemAsync(BACKUP_KEY_STORAGE, encoded);
  }
  return globalThis.crypto.subtle.importKey(
    'raw',
    base64ToBytes(encoded),
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt'],
  );
}

async function encryptBackup(payload: LocalBackupData): Promise<string> {
  const key = await getOrCreateBackupKey();
  const iv = new Uint8Array(12);
  globalThis.crypto.getRandomValues(iv);
  const plain = new TextEncoder().encode(JSON.stringify(payload));
  const cipher = await globalThis.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plain);
  return JSON.stringify({ version: '2.0', algorithm: 'AES-GCM', iv: bytesToBase64(iv), ciphertext: bytesToBase64(new Uint8Array(cipher)) });
}

async function decryptBackup(raw: string): Promise<LocalBackupData> {
  const envelope = JSON.parse(raw);
  if (envelope?.algorithm !== 'AES-GCM') {
    // V1 migration path: accept legacy plaintext once, then callers will rewrite it encrypted.
    return envelope as LocalBackupData;
  }
  const key = await getOrCreateBackupKey();
  const plain = await globalThis.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToBytes(envelope.iv) },
    key,
    base64ToBytes(envelope.ciphertext),
  );
  return JSON.parse(new TextDecoder().decode(plain)) as LocalBackupData;
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

export async function createLocalBackup(): Promise<{ success: boolean; meta: BackupMetaInfo; error?: string }> {
  try {
    const [journalsRes, commentsRes, tagsRes, conceptsRes, peopleRes, theoriesRes, claimsRes, argumentsRes, journalEntitiesRes, journalRelationsRes] = await Promise.all([
      supabase.from('journals').select('*').order('created_at', { ascending: false }),
      supabase.from('comments').select('*').order('created_at', { ascending: true }),
      supabase.from('tag_catalog').select('*').order('sort_order', { ascending: true }),
      supabase.from('thought_concepts').select('*'),
      supabase.from('thought_people').select('*'),
      supabase.from('thought_theories').select('*'),
      supabase.from('thought_claims').select('*'),
      supabase.from('thought_arguments').select('*'),
      supabase.from('journal_entities').select('*'),
      supabase.from('journal_relations').select('*'),
    ]);

    if (journalsRes.error) throw journalsRes.error;
    if (commentsRes.error) throw commentsRes.error;
    if (tagsRes.error) throw tagsRes.error;
    // V4.2 tables may not exist until migration 00011 is applied; keep V4.1 backup usable.
    const journals = (journalsRes.data || []) as Journal[];
    const comments = (commentsRes.data || []) as Comment[];
    const tags = (tagsRes.data || []) as TagItem[];
    const now = Date.now();
    const dateStr = new Date(now).toLocaleString('zh-CN', { hour12: false });
    const backupPayload: LocalBackupData = {
      version: '2.0', timestamp: now, dateStr,
      data: {
        journals, comments, tags,
        thought_concepts: conceptsRes.data || [],
        thought_people: peopleRes.data || [],
        thought_theories: theoriesRes.data || [],
        thought_claims: claimsRes.data || [],
        thought_arguments: argumentsRes.data || [],
        journal_entities: journalEntitiesRes.data || [],
        journal_relations: journalRelationsRes.data || [],
      },
    };

    const encrypted = await encryptBackup(backupPayload);
    const sizeBytes = new TextEncoder().encode(encrypted).byteLength;
    await AsyncStorage.setItem(BACKUP_KEY, encrypted);
    // 云端只保存密文快照；密钥永不上传。云端失败不阻断本地备份。
    try {
      await supabase.storage.from('database-backups').upload('latest.json', encrypted, { contentType:'application/json', upsert:true });
    } catch { /* local backup remains authoritative fallback */ }

    const meta: BackupMetaInfo = {
      lastBackupTime: now, lastBackupDateStr: dateStr, sizeBytes, encrypted: true,
      count: { journals: journals.length, comments: comments.length, tags: tags.length },
    };
    await AsyncStorage.setItem(BACKUP_META_KEY, JSON.stringify(meta));
    return { success: true, meta };
  } catch (err: any) {
    console.error('createLocalBackup error:', err);
    return {
      success: false,
      meta: { lastBackupTime: null, lastBackupDateStr: '备份失败', sizeBytes: 0, encrypted: false, count: { journals: 0, comments: 0, tags: 0 } },
      error: err?.message || '备份异常',
    };
  }
}

export async function getLocalBackupMeta(): Promise<BackupMetaInfo | null> {
  try {
    const rawMeta = await AsyncStorage.getItem(BACKUP_META_KEY);
    if (rawMeta) return JSON.parse(rawMeta);
    const rawBackup = await AsyncStorage.getItem(BACKUP_KEY);
    if (!rawBackup) return null;
    const parsed = await decryptBackup(rawBackup);
    return {
      lastBackupTime: parsed.timestamp,
      lastBackupDateStr: parsed.dateStr,
      sizeBytes: new TextEncoder().encode(rawBackup).byteLength,
      encrypted: rawBackup.includes('AES-GCM'),
      count: { journals: parsed.data.journals?.length || 0, comments: parsed.data.comments?.length || 0, tags: parsed.data.tags?.length || 0 },
    };
  } catch {
    return null;
  }
}

export async function getLocalBackupData(): Promise<LocalBackupData | null> {
  try {
    const raw = await AsyncStorage.getItem(BACKUP_KEY);
    if (!raw) return null;
    return decryptBackup(raw);
  } catch {
    return null;
  }
}

export async function restoreFromLocalBackup(): Promise<{ success: boolean; message: string }> {
  try {
    const backup = await getLocalBackupData();
    if (!backup?.data) return { success: false, message: '未找到或无法解密本地备份数据' };

    const { journals, comments, tags } = backup.data;
    if (journals?.length) {
      const { error } = await supabase.from('journals').upsert(journals, { onConflict: 'id' });
      if (error) throw error;
    }
    if (comments?.length) {
      const { error } = await supabase.from('comments').upsert(comments, { onConflict: 'id' });
      if (error) throw error;
    }
    if (tags?.length) {
      const cleanTags = tags.map((t) => ({ id: t.id, category: t.category, type: t.category, name: t.name, emoji: t.emoji || '', sort_order: t.sort_order || 99 }));
      const { error } = await supabase.from('tag_catalog').upsert(cleanTags, { onConflict: 'id' });
      if (error) throw error;
    }
    const thoughtTables = ['thought_concepts','thought_people','thought_theories','thought_claims','thought_arguments','journal_entities','journal_relations'] as const;
    for (const table of thoughtTables) {
      const rows = (backup.data as any)[table];
      if (Array.isArray(rows) && rows.length) {
        const { error } = await supabase.from(table).upsert(rows, { onConflict: 'id' });
        if (error) throw error;
      }
    }
    return { success: true, message: `成功恢复 ${journals?.length || 0} 篇日志、${comments?.length || 0} 条评论、${tags?.length || 0} 个标签及 V4.2 思想实体！` };
  } catch (err: any) {
    console.error('restoreFromLocalBackup error:', err);
    return { success: false, message: err?.message || '恢复过程出现错误，当前数据未完成恢复' };
  }
}

export async function clearLocalBackup(): Promise<boolean> {
  try {
    await AsyncStorage.multiRemove([BACKUP_KEY, BACKUP_META_KEY]);
    await SecureStore.deleteItemAsync(BACKUP_KEY_STORAGE);
    return true;
  } catch {
    return false;
  }
}

export async function clearAllLocalData(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const keysToRemove = keys.filter((k) => !k.includes('theme_preference'));
    if (keysToRemove.length) await AsyncStorage.multiRemove(keysToRemove);
    await SecureStore.deleteItemAsync(BACKUP_KEY_STORAGE);
    await SecureStore.deleteItemAsync(PIN_KEY_COMPAT);
  } catch (e) {
    console.error('clearAllLocalData error:', e);
  }
}

// 保持对旧调用方的兼容。
const PIN_KEY_COMPAT = 'mosi_security_pin_code_v1';
export const fullBackup = createLocalBackup;
export const restoreBackup = restoreFromLocalBackup;
export async function getBackupMeta(): Promise<{ lastTime: string; size: number; entries: number; encrypted: boolean }> {
  const meta = await getLocalBackupMeta();
  return { lastTime: meta?.lastBackupDateStr || '未备份', size: meta?.sizeBytes || 0, entries: (meta?.count?.journals || 0) + (meta?.count?.comments || 0) + (meta?.count?.tags || 0), encrypted: meta?.encrypted ?? true };
}
export const autoBackup = triggerAutoBackupDebounced;

let backupTimer: ReturnType<typeof setTimeout> | null = null;
export function triggerAutoBackupDebounced(delay = 1500): void {
  if (backupTimer) clearTimeout(backupTimer);
  backupTimer = setTimeout(() => { createLocalBackup().catch((e) => console.log('Auto backup silent error:', e)); }, delay);
}

export const EDITOR_DRAFT_KEY = 'mosi_editor_draft_encrypted_v1';
let backupIntervalHandle: ReturnType<typeof setInterval> | null = null;

async function encryptLocalText(text: string): Promise<string> {
  const key = await getOrCreateBackupKey();
  const iv = new Uint8Array(12);
  globalThis.crypto.getRandomValues(iv);
  const plain = new TextEncoder().encode(text);
  const cipher = await globalThis.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plain);
  return JSON.stringify({ version:'1', algorithm:'AES-GCM', iv:bytesToBase64(iv), ciphertext:bytesToBase64(new Uint8Array(cipher)) });
}

async function decryptLocalText(raw: string): Promise<string> {
  const envelope = JSON.parse(raw);
  const key = await getOrCreateBackupKey();
  const plain = await globalThis.crypto.subtle.decrypt({ name:'AES-GCM', iv:base64ToBytes(envelope.iv) }, key, base64ToBytes(envelope.ciphertext));
  return new TextDecoder().decode(plain);
}

export async function saveEditorDraft(draft: { id?: string; title: string; content: string; savedAt: number }): Promise<boolean> {
  try {
    const encrypted = await encryptLocalText(JSON.stringify(draft));
    await AsyncStorage.setItem(EDITOR_DRAFT_KEY, encrypted);
    return true;
  } catch { return false; }
}

export async function getEditorDraft(): Promise<{ id?: string; title: string; content: string; savedAt: number } | null> {
  try {
    const raw = await AsyncStorage.getItem(EDITOR_DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(await decryptLocalText(raw));
  } catch { return null; }
}

export async function clearEditorDraft(): Promise<void> {
  await AsyncStorage.removeItem(EDITOR_DRAFT_KEY);
}

export async function startAutomaticBackupLoop(): Promise<void> {
  if (backupIntervalHandle) clearInterval(backupIntervalHandle);
  const { getSecurityPolicyDB } = await import('@/services/api');
  const schedule = async () => {
    const policy = await getSecurityPolicyDB();
    const seconds = Math.max(60, Number(policy?.local_backup_interval_seconds || 60));
    if (backupIntervalHandle) clearInterval(backupIntervalHandle);
    backupIntervalHandle = setInterval(() => {
      createLocalBackup().catch(() => undefined);
    }, seconds * 1000);
  };
  await schedule();
}

export function stopAutomaticBackupLoop(): void {
  if (backupIntervalHandle) clearInterval(backupIntervalHandle);
  backupIntervalHandle = null;
}
