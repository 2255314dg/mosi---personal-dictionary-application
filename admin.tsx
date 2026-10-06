import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Switch,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Sharing from 'expo-sharing';
import { Paths, File } from 'expo-file-system';
import JSZip from 'jszip';
import { useTheme } from '@/context/ThemeContext';
import { useAudioPlayer } from '@/context/AudioPlayerContext';
import { PinKeypadModal } from '@/components/PinKeypadModal';
import { GesturePatternModal } from '@/components/GesturePatternModal';
import { savePinCode, getPin, saveGesturePattern, getGesturePattern, clearGesturePattern } from '@/utils/security';
import { supabase } from '@/client/supabase';
import {
  Journal,
  Comment,
  InvitationCode,
  TagItem,
  getJournals,
  deleteJournal,
  checkIsAdmin,
  getAllComments,
  deleteComment,
  getJournalDisplayTitle,
  getInvitationCodes,
  createInvitationCode,
  toggleInvitationCodeActive,
  deleteInvitationCode,
  getRequireInvitationCodeSetting,
  updateRequireInvitationCodeSetting,
  updateAdminPassword,
  getSecurityPolicyDB, setSecurityPolicyDB, getDeviceRegistry, setDeviceApproval, getAuditLogs,
  DeviceRegistryItem, AuditLogItem,
  uploadMusicFile,
  addMusicTrackDB,
  getTagCatalogDB,
  addTagCatalogDB,
  createTagCatalogDB,
  updateTagCatalogDB,
  deleteTagCatalogDB,
} from '@/services/api';
import * as DocumentPicker from 'expo-document-picker';
import {
  ChevronLeft,
  Music,
  MessageSquare,
  FileArchive,
  Ticket,
  KeyRound,
  Trash2,
  Plus,
  CheckSquare,
  Square,
  Download,
  Check,
  Disc,
  Sparkles,
  Calendar,
  Users,
  AlertCircle,
  Lock,
  LogOut,
  ShieldCheck,
  Tags,
  Edit2,
  Database,
  RefreshCw,
  HardDrive,
  User,
} from 'lucide-react-native';
import {
  createLocalBackup,
  restoreFromLocalBackup,
  getLocalBackupMeta,
  clearAllLocalData,
  clearLocalBackup,
  formatBytes,
  BackupMetaInfo,
  startAutomaticBackupLoop,
} from '@/utils/backup';

export default function AdminScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { tracks, addCustomTrack, removeTrack } = useAudioPlayer();

  const [activeTab, setActiveTab] = useState<'codes' | 'tags' | 'backup' | 'security' | 'music' | 'comments' | 'export'>('codes');
  const [journals, setJournals] = useState<Journal[]>([]);
  const [comments, setComments] = useState<(Comment & { journal_title?: string })[]>([]);
  const [invitationCodes, setInvitationCodes] = useState<InvitationCode[]>([]);
  const [tagItems, setTagItems] = useState<TagItem[]>([]);
  const [requireCodeSetting, setRequireCodeSetting] = useState(true);
  const [selectedJournalIds, setSelectedJournalIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [securityPolicy, setSecurityPolicy] = useState<any>(null);
  const [devices, setDevices] = useState<DeviceRegistryItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [pinSetupVisible, setPinSetupVisible] = useState(false);
  const [gestureSetupVisible, setGestureSetupVisible] = useState(false);
  const [pinConfigured, setPinConfigured] = useState(false);
  const [gestureConfigured, setGestureConfigured] = useState(false);

  // 本地备份与恢复状态
  const [backupMeta, setBackupMeta] = useState<BackupMetaInfo | null>(null);
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupStatusMsg, setBackupStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // 退出登录状态
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  // 自定义标签管理表单
  const [newTagCategory, setNewTagCategory] = useState<'theme' | 'mood' | 'weather'>('theme');
  const [selectedTagTab, setSelectedTagTab] = useState<'theme' | 'mood' | 'weather'>('theme');
  const [newTagName, setNewTagName] = useState('');
  const [newTagEmoji, setNewTagEmoji] = useState('');
  const [tagAdding, setTagAdding] = useState(false);
  const [tagMsg, setTagMsg] = useState('');

  useEffect(() => {
    if (activeTab !== 'security') return;
    (async () => {
      setAuditLoading(true);
      const [policy, deviceList, logs] = await Promise.all([getSecurityPolicyDB(), getDeviceRegistry(), getAuditLogs(300)]);
      setSecurityPolicy(policy);
      setDevices(deviceList);
      setAuditLogs(logs);
      setPinConfigured(Boolean(await getPin()));
      setGestureConfigured(Boolean(await getGesturePattern()));
      setAuditLoading(false);
    })();
  }, [activeTab]);

  const toggleSecuritySetting = async (key: string, value: boolean | number) => {
    const ok = await setSecurityPolicyDB(key as any, value);
    if (ok) { setSecurityPolicy((prev:any)=>({ ...prev, [key]: value })); if (key === 'local_backup_interval_seconds') await startAutomaticBackupLoop(); }
  };

  // 快捷 emoji 候选列表
  const QUICK_EMOJIS = ['💭', '⏳', '🌌', '🌱', '⚡', '🎨', '❤️', '🌊', '🌀', '🕊️', '🌧️', '🕯️', '✨', '☀️', '⛅', '❄️', '💨'];

  // 正在编辑的标签状态
  const [editingTag, setEditingTag] = useState<TagItem | null>(null);
  const [editTagName, setEditTagName] = useState('');
  const [editTagEmoji, setEditTagEmoji] = useState('');
  const [editTagCategory, setEditTagCategory] = useState<'theme' | 'mood' | 'weather'>('theme');
  const [editTagModalVisible, setEditTagModalVisible] = useState(false);
  const [tagUpdating, setTagUpdating] = useState(false);

  // 危险操作确认对话框状态
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [confirmModalAction, setConfirmModalAction] = useState<(() => Promise<void>) | null>(null);
  const [confirmModalTitle, setConfirmModalTitle] = useState('操作确认');
  const [confirmModalMessage, setConfirmModalMessage] = useState('此操作会影响用户访问权限，确认继续吗？');

  // 邀请码创建表单
  const [customCodeInput, setCustomCodeInput] = useState('');
  const [maxUsesInput, setMaxUsesInput] = useState('1');
  const [expireDaysInput, setExpireDaysInput] = useState('30');
  const [creatingCode, setCreatingCode] = useState(false);
  const [codeSuccessMsg, setCodeSuccessMsg] = useState('');

  // 修改密码表单
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdError, setPwdError] = useState('');
  const [pwdSuccess, setPwdSuccess] = useState('');

  // 添加新音乐输入与本地上传状态
  const [newMusicTitle, setNewMusicTitle] = useState('');
  const [newMusicArtist, setNewMusicArtist] = useState('');
  const [selectedMusicFile, setSelectedMusicFile] = useState<{
    uri: string;
    name: string;
    mimeType?: string;
    size?: number;
  } | null>(null);
  const [uploadingMusic, setUploadingMusic] = useState(false);
  const [musicUploadError, setMusicUploadError] = useState('');
  const [musicUploadSuccess, setMusicUploadSuccess] = useState('');
  const [exportingZip, setExportingZip] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  useEffect(() => {
    (async () => {
      const allowed = await checkIsAdmin();
      if (!allowed) {
        router.replace('/' as any);
        return;
      }
      await loadAllData();
    })();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [jList, cList, codes, reqSetting, tags, meta] = await Promise.all([
        getJournals(),
        getAllComments(),
        getInvitationCodes(),
        getRequireInvitationCodeSetting(),
        getTagCatalogDB(),
        getLocalBackupMeta(),
      ]);
      setJournals(jList);
      setComments(cList);
      setInvitationCodes(codes);
      setRequireCodeSetting(reqSetting);
      setTagItems(tags);
      setBackupMeta(meta);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // 手动执行一键备份
  const handleManualBackup = async () => {
    setBackupLoading(true);
    setBackupStatusMsg(null);
    try {
      const res = await createLocalBackup();
      if (res.success) {
        const meta = await getLocalBackupMeta();
        setBackupMeta(meta);
        setBackupStatusMsg({
          type: 'success',
          text: `全量备份完成！已备份 ${res.meta.count.journals}篇日志、${res.meta.count.comments}条评论、${res.meta.count.tags}个标签，共 ${formatBytes(res.meta.sizeBytes)}`,
        });
      } else {
        setBackupStatusMsg({ type: 'error', text: res.error || '备份失败' });
      }
    } catch (err: any) {
      setBackupStatusMsg({ type: 'error', text: err?.message || '备份异常' });
    } finally {
      setBackupLoading(false);
    }
  };

  // 手动执行一键恢复
  const handleManualRestore = async () => {
    setConfirmModalTitle('确认从本地备份恢复？');
    setConfirmModalMessage('恢复将用本地备份覆盖或同步合并当前数据库中的日志、评论及标签，确认执行吗？');
    setConfirmModalAction(() => async () => {
      setBackupLoading(true);
      setBackupStatusMsg(null);
      try {
        const res = await restoreFromLocalBackup();
        if (res.success) {
          setBackupStatusMsg({ type: 'success', text: res.message });
          await loadAllData();
        } else {
          setBackupStatusMsg({ type: 'error', text: res.message || '恢复失败' });
        }
      } catch (err: any) {
        setBackupStatusMsg({ type: 'error', text: err?.message || '恢复异常' });
      } finally {
        setBackupLoading(false);
      }
    });
    setConfirmModalVisible(true);
  };

  // 手动清除本地备份（高危操作）
  const handleClearBackup = async () => {
    setConfirmModalTitle('确认清除本地备份？');
    setConfirmModalMessage('此操作将永久删除保存在当前设备本地的全部离线数据库备份与历史快照，云端数据库数据不受影响。确认清除吗？');
    setConfirmModalAction(() => async () => {
      setBackupLoading(true);
      setBackupStatusMsg(null);
      try {
        const ok = await clearLocalBackup();
        if (ok) {
          setBackupMeta(null);
          setBackupStatusMsg({ type: 'success', text: '本地备份数据已彻底清除' });
        } else {
          setBackupStatusMsg({ type: 'error', text: '清除本地备份失败' });
        }
      } catch (err: any) {
        setBackupStatusMsg({ type: 'error', text: err?.message || '清除异常' });
      } finally {
        setBackupLoading(false);
      }
    });
    setConfirmModalVisible(true);
  };

  // 管理后台退出登录
  const handleAdminLogout = async (keepLocalData: boolean) => {
    try {
      setLoggingOut(true);
      if (!keepLocalData) {
        await clearAllLocalData();
      }
      await supabase.auth.signOut();
      setLogoutModalVisible(false);
      router.replace('/login' as any);
    } catch (e) {
      console.error(e);
      router.replace('/login' as any);
    } finally {
      setLoggingOut(false);
    }
  };

  // 添加自定义标签
  const handleAddTag = async () => {
    if (!newTagName.trim()) return;
    setTagAdding(true);
    setTagMsg('');
    try {
      const res = await createTagCatalogDB({
        category: newTagCategory,
        name: newTagName.trim(),
        emoji: newTagEmoji.trim(),
      });
      if (res) {
        setTagItems([...tagItems, res]);
        setNewTagName('');
        setNewTagEmoji('');
        setTagMsg('添加成功！');
        setTimeout(() => setTagMsg(''), 2000);
      } else {
        setTagMsg('添加失败或已存在相同标签');
      }
    } catch (err: any) {
      setTagMsg(err?.message || '添加异常');
    } finally {
      setTagAdding(false);
    }
  };

  // 打开编辑标签弹窗
  const handleStartEditTag = (tag: TagItem) => {
    setEditingTag(tag);
    setEditTagName(tag.name);
    setEditTagEmoji(tag.emoji || '');
    setEditTagCategory(tag.category);
    setEditTagModalVisible(true);
  };

  // 保存编辑标签
  const handleSaveEditTag = async () => {
    if (!editingTag || !editTagName.trim()) return;
    setTagUpdating(true);
    try {
      const updated = await updateTagCatalogDB(editingTag.id, {
        name: editTagName.trim(),
        emoji: editTagEmoji.trim(),
        category: editTagCategory,
      });
      if (updated) {
        setTagItems(tagItems.map((t) => (t.id === editingTag.id ? updated : t)));
        setEditTagModalVisible(false);
        setEditingTag(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setTagUpdating(false);
    }
  };

  // 删除自定义标签（带二次确认）
  const handleDeleteTag = (id: string, name: string) => {
    setConfirmModalTitle('删除标签');
    setConfirmModalMessage('确认删除此标签？相关日志将失去此标签分类。');
    setConfirmModalAction(() => async () => {
      const ok = await deleteTagCatalogDB(id);
      if (ok) {
        setTagItems(tagItems.filter((t) => t.id !== id));
      }
    });
    setConfirmModalVisible(true);
  };

  // 切换邀请码全局开关 (需要确认)
  const handleToggleRequireSetting = (val: boolean) => {
    setConfirmModalTitle('切换邀请码访问权限');
    setConfirmModalMessage('此操作会影响用户访问权限，确认继续吗？');
    setConfirmModalAction(() => async () => {
      setRequireCodeSetting(val);
      await updateRequireInvitationCodeSetting(val);
    });
    setConfirmModalVisible(true);
  };

  // 生成新的邀请码
  const handleCreateCode = async (isRandom = false) => {
    setCreatingCode(true);
    setCodeSuccessMsg('');
    try {
      const max_uses = parseInt(maxUsesInput, 10) || 1;
      const expires_days = parseInt(expireDaysInput, 10) || 30;
      const res = await createInvitationCode({
        code: isRandom ? undefined : customCodeInput,
        max_uses,
        expires_days,
      });

      if (res) {
        setInvitationCodes([res, ...invitationCodes]);
        setCustomCodeInput('');
        setCodeSuccessMsg(`成功生成邀请码：${res.code}`);
        setTimeout(() => setCodeSuccessMsg(''), 3000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCreatingCode(false);
    }
  };

  // 切换单个邀请码启用/停用 (停用需要确认)
  const handleToggleCodeActive = (id: string, currentActive: boolean) => {
    const nextActive = !currentActive;
    if (currentActive) {
      // 当前是启用，要停用 -> 弹出确认对话框
      setConfirmModalTitle('停用邀请码');
      setConfirmModalMessage('此操作会影响用户访问权限，确认继续吗？');
      setConfirmModalAction(() => async () => {
        const ok = await toggleInvitationCodeActive(id, false);
        if (ok) {
          setInvitationCodes(invitationCodes.map((c) => (c.id === id ? { ...c, is_active: false } : c)));
        }
      });
      setConfirmModalVisible(true);
    } else {
      // 重新启用直接执行
      toggleInvitationCodeActive(id, true).then((ok) => {
        if (ok) {
          setInvitationCodes(invitationCodes.map((c) => (c.id === id ? { ...c, is_active: true } : c)));
        }
      });
    }
  };

  // 删除未使用的邀请码 (需要确认)
  const handleDeleteCode = (id: string) => {
    setConfirmModalTitle('删除邀请码');
    setConfirmModalMessage('此操作会影响用户访问权限，确认继续吗？');
    setConfirmModalAction(() => async () => {
      const ok = await deleteInvitationCode(id);
      if (ok) {
        setInvitationCodes(invitationCodes.filter((c) => c.id !== id));
      }
    });
    setConfirmModalVisible(true);
  };

  // 提交修改管理员密码
  const handleChangePassword = async () => {
    setPwdError('');
    setPwdSuccess('');

    if (!currentPassword.trim()) {
      setPwdError('请输入当前管理员原密码');
      return;
    }
    if (!newPassword.trim()) {
      setPwdError('请输入新密码');
      return;
    }
    if (newPassword.trim().length < 6) {
      setPwdError('新密码长度不能少于6位');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwdError('两次输入的密码不一致');
      return;
    }
    if (currentPassword.trim() === newPassword.trim()) {
      setPwdError('新密码不能与原密码相同');
      return;
    }

    setPwdLoading(true);
    try {
      const result = await updateAdminPassword({
        currentPassword: currentPassword.trim(),
        newPassword: newPassword.trim(),
      });

      if (!result.success) {
        setPwdError(result.message);
        setPwdLoading(false);
        return;
      }

      setPwdSuccess('密码修改成功！请使用新密码重新登录');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      // 退出登录并跳转至登录页
      setTimeout(async () => {
        try {
          await supabase.auth.signOut();
        } catch {
          // ignore
        }
        router.replace('/login');
      }, 1600);
    } catch (err: any) {
      setPwdError(err?.message || '修改密码失败，请稍后重试');
    } finally {
      setPwdLoading(false);
    }
  };

  // 从手机选择本地音乐文件 (.mp3/.m4a/.wav/.ogg/.flac)
  const handlePickMusicFile = async () => {
    try {
      setMusicUploadError('');
      setMusicUploadSuccess('');
      const res = await DocumentPicker.getDocumentAsync({
        type: [
          'audio/mpeg',
          'audio/mp3',
          'audio/m4a',
          'audio/x-m4a',
          'audio/wav',
          'audio/x-wav',
          'audio/ogg',
          'audio/flac',
          'audio/*',
        ],
        copyToCacheDirectory: true,
      });

      if (!res.canceled && res.assets && res.assets.length > 0) {
        const asset = res.assets[0];
        setSelectedMusicFile({
          uri: asset.uri,
          name: asset.name || 'selected_music.mp3',
          mimeType: asset.mimeType,
          size: asset.size,
        });
        // 若标题为空，自动填入文件名（去掉扩展名）
        if (!newMusicTitle.trim() && asset.name) {
          const autoTitle = asset.name.replace(/\.[^/.]+$/, '');
          setNewMusicTitle(autoTitle);
        }
      }
    } catch (err: any) {
      setMusicUploadError(err?.message || '选择本地音乐文件失败');
    }
  };

  // 上传并添加本地音乐到 Storage 和数据库
  const handleUploadAndAddMusic = async () => {
    if (!selectedMusicFile) {
      setMusicUploadError('请先从手机选择音乐文件');
      return;
    }
    const finalTitle = newMusicTitle.trim() || selectedMusicFile.name.replace(/\.[^/.]+$/, '');
    const finalArtist = newMusicArtist.trim() || '墨思伴读';

    setUploadingMusic(true);
    setMusicUploadError('');
    setMusicUploadSuccess('');

    try {
      // 1. 上传至 Storage music bucket
      const uploadedUrl = await uploadMusicFile(
        selectedMusicFile.uri,
        selectedMusicFile.name,
        selectedMusicFile.mimeType || 'audio/mpeg'
      );

      // 2. 插入数据库 music_tracks 表
      await addMusicTrackDB({
        title: finalTitle,
        artist: finalArtist,
        url: uploadedUrl,
        duration: 180,
      });

      // 3. 同步加入当前播放器上下文
      addCustomTrack({
        id: `custom_${Date.now()}`,
        title: finalTitle,
        artist: finalArtist,
        url: uploadedUrl,
        duration: 180,
      });

      setMusicUploadSuccess(`成功上传并收录《${finalTitle}》！`);
      setSelectedMusicFile(null);
      setNewMusicTitle('');
      setNewMusicArtist('');
    } catch (err: any) {
      setMusicUploadError(err?.message || '音乐上传或保存失败，请重试');
    } finally {
      setUploadingMusic(false);
    }
  };

  // 删除评论
  const handleDeleteComment = async (id: string) => {
    const ok = await deleteComment(id);
    if (ok) {
      setComments(comments.filter((c) => c.id !== id));
    }
  };

  // 多选切换
  const toggleSelectJournal = (id: string) => {
    if (selectedJournalIds.includes(id)) {
      setSelectedJournalIds(selectedJournalIds.filter((item) => item !== id));
    } else {
      setSelectedJournalIds([...selectedJournalIds, id]);
    }
  };

  const selectAllJournals = () => {
    if (selectedJournalIds.length === journals.length) {
      setSelectedJournalIds([]);
    } else {
      setSelectedJournalIds(journals.map((j) => j.id));
    }
  };

  // 批量导出为 ZIP 文件
  const handleExportZip = async () => {
    if (selectedJournalIds.length === 0) return;
    setExportingZip(true);
    try {
      const zip = new JSZip();
      const targetJournals = journals.filter((j) => selectedJournalIds.includes(j.id));

      targetJournals.forEach((j) => {
        const title = getJournalDisplayTitle(j);
        const mdContent = `# ${title}\n\n` +
          `> 创建时间：${new Date(j.created_at).toLocaleString()}\n` +
          `> 标签：${j.theme_tags?.join(', ') || '无'} | 心境：${j.mood_tag || '无'}\n\n` +
          `---\n\n` +
          j.content;

        zip.file(`${title.replace(/[\\/:*?"<>|]/g, '_')}.md`, mdContent);
      });

      const base64Data = await zip.generateAsync({ type: 'base64' });

      // 原生移动端文件系统保存并唤起分享/下载
      try {
        const file = new File(Paths.document, `mosi_journals_export_${Date.now()}.zip`);
        file.create({ overwrite: true });
        const binary = globalThis.atob(base64Data);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        file.write(bytes);

        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(file.uri, {
            mimeType: 'application/zip',
            dialogTitle: '导出墨思思辨日志归档包',
          });
        }
      } catch (fsErr) {
        console.warn('File save fallback:', fsErr);
      }

      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 3000);
    } catch (err) {
      console.error('ZIP Export error:', err);
    } finally {
      setExportingZip(false);
    }
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1" style={{ backgroundColor: colors.bg }}>
      {/* 顶栏 */}
      <View
        className="px-4 py-3 flex-row items-center justify-between border-b"
        style={{ backgroundColor: colors.cardBg, borderColor: colors.cardBorder }}
      >
        <Pressable
          onPress={() => router.back()}
          className="flex-row items-center p-1 rounded-lg active:opacity-70"
        >
          <ChevronLeft size={22} color={colors.textPrimary} />
          <Text className="text-sm font-medium ml-1" style={{ color: colors.textPrimary }}>
            返回首页
          </Text>
        </Pressable>

        <Text className="text-base font-bold" style={{ color: colors.textPrimary }}>
          墨思 · 创作者管理后台
        </Text>

        <View className="w-8" />
      </View>

      {/* Tab 导航 */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 12, gap: 6 }}
        className="border-b py-2 flex-grow-0"
        style={{ backgroundColor: colors.cardBg, borderColor: colors.cardBorder }}
      >
        <Pressable
          onPress={() => setActiveTab('codes')}
          className="flex-row items-center px-3 py-1.5 rounded-xl"
          style={{ backgroundColor: activeTab === 'codes' ? colors.accentBg : 'transparent' }}
        >
          <Ticket size={13} color={activeTab === 'codes' ? colors.accent : colors.textSecondary} />
          <Text
            className="text-[11px] font-semibold ml-1.5"
            style={{ color: activeTab === 'codes' ? colors.accent : colors.textSecondary }}
          >
            邀请码
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setActiveTab('backup')}
          className="flex-row items-center px-3 py-1.5 rounded-xl"
          style={{ backgroundColor: activeTab === 'backup' ? colors.accentBg : 'transparent' }}
        >
          <Database size={13} color={activeTab === 'backup' ? colors.accent : colors.textSecondary} />
          <Text
            className="text-[11px] font-semibold ml-1.5"
            style={{ color: activeTab === 'backup' ? colors.accent : colors.textSecondary }}
          >
            备份恢复
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setActiveTab('tags')}
          className="flex-row items-center px-3 py-1.5 rounded-xl"
          style={{ backgroundColor: activeTab === 'tags' ? colors.accentBg : 'transparent' }}
        >
          <Tags size={13} color={activeTab === 'tags' ? colors.accent : colors.textSecondary} />
          <Text
            className="text-[11px] font-semibold ml-1.5"
            style={{ color: activeTab === 'tags' ? colors.accent : colors.textSecondary }}
          >
            分类标签
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setActiveTab('music')}
          className="flex-row items-center px-3 py-1.5 rounded-xl"
          style={{ backgroundColor: activeTab === 'music' ? colors.accentBg : 'transparent' }}
        >
          <Music size={13} color={activeTab === 'music' ? colors.accent : colors.textSecondary} />
          <Text
            className="text-[11px] font-semibold ml-1.5"
            style={{ color: activeTab === 'music' ? colors.accent : colors.textSecondary }}
          >
            伴读乐库
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setActiveTab('comments')}
          className="flex-row items-center px-3 py-1.5 rounded-xl"
          style={{ backgroundColor: activeTab === 'comments' ? colors.accentBg : 'transparent' }}
        >
          <MessageSquare size={13} color={activeTab === 'comments' ? colors.accent : colors.textSecondary} />
          <Text
            className="text-[11px] font-semibold ml-1.5"
            style={{ color: activeTab === 'comments' ? colors.accent : colors.textSecondary }}
          >
            留言审核
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setActiveTab('export')}
          className="flex-row items-center px-3 py-1.5 rounded-xl"
          style={{ backgroundColor: activeTab === 'export' ? colors.accentBg : 'transparent' }}
        >
          <FileArchive size={13} color={activeTab === 'export' ? colors.accent : colors.textSecondary} />
          <Text
            className="text-[11px] font-semibold ml-1.5"
            style={{ color: activeTab === 'export' ? colors.accent : colors.textSecondary }}
          >
            批量导出
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setActiveTab('security')}
          className="flex-row items-center px-3 py-1.5 rounded-xl"
          style={{ backgroundColor: activeTab === 'security' ? colors.accentBg : 'transparent' }}
        >
          <KeyRound size={13} color={activeTab === 'security' ? colors.accent : colors.textSecondary} />
          <Text
            className="text-[11px] font-semibold ml-1.5"
            style={{ color: activeTab === 'security' ? colors.accent : colors.textSecondary }}
          >
            安全与退出
          </Text>
        </Pressable>

        <Pressable
          onPress={() => router.push('/profile' as any)}
          className="flex-row items-center px-3 py-1.5 rounded-xl active:opacity-70"
          style={{ backgroundColor: 'transparent' }}
        >
          <User size={13} color={colors.accent} />
          <Text
            className="text-[11px] font-semibold ml-1.5"
            style={{ color: colors.accent }}
          >
            个人中心
          </Text>
        </Pressable>
      </ScrollView>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="small" color={colors.accent} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 110 }} className="flex-1">
          {/* 1. 邀请码管理 */}
          {activeTab === 'codes' && (
            <View>
              {/* 全局开关 */}
              <View
                className="p-4 rounded-2xl border mb-4 flex-row items-center justify-between"
                style={{ backgroundColor: colors.cardBg, borderColor: colors.cardBorder }}
              >
                <View className="flex-1 mr-3">
                  <Text className="text-sm font-bold" style={{ color: colors.textPrimary }}>
                    是否需要邀请码注册
                  </Text>
                  <Text className="text-xs mt-0.5" style={{ color: colors.textMuted }}>
                    {requireCodeSetting
                      ? '已开启限制：新用户注册必须填写有效且未过期的邀请码'
                      : '已关闭限制：普通读者无需邀请码即可自由注册账号'}
                  </Text>
                </View>
                <Switch
                  value={requireCodeSetting}
                  onValueChange={handleToggleRequireSetting}
                  trackColor={{ false: '#D1D5DB', true: colors.accent }}
                  thumbColor="#FFFFFF"
                />
              </View>

              {/* 生成邀请码 */}
              <View
                className="p-4 rounded-2xl border mb-4"
                style={{ backgroundColor: colors.cardBg, borderColor: colors.cardBorder }}
              >
                <Text className="text-sm font-bold mb-3" style={{ color: colors.textPrimary }}>
                  生成新邀请码
                </Text>

                {/* 自定义邀请码输入框（去除8位字样） */}
                <View className="mb-3">
                  <Text className="text-xs font-semibold mb-1" style={{ color: colors.textSecondary }}>
                    邀请码内容 (留空则自动随机生成)
                  </Text>
                  <TextInput
                    placeholder="自定义邀请码 (留空则自动随机生成)"
                    placeholderTextColor={colors.textMuted}
                    value={customCodeInput}
                    onChangeText={setCustomCodeInput}
                    autoCapitalize="characters"
                    className="text-xs p-2.5 rounded-lg border font-mono"
                    style={{ backgroundColor: colors.bg, borderColor: colors.cardBorder, color: colors.textPrimary }}
                  />
                </View>

                {/* 需求1：数字 1 和 30 分两行放置，并注明含义 */}
                {/* 第1行：单次使用（1次） */}
                <View className="mb-2.5">
                  <View className="flex-row items-center justify-between mb-1">
                    <Text className="text-xs font-semibold" style={{ color: colors.textSecondary }}>
                      单次使用（1次）
                    </Text>
                    <Text className="text-[11px]" style={{ color: colors.textMuted }}>
                      允许核销的最高次数
                    </Text>
                  </View>
                  <TextInput
                    placeholder="1"
                    placeholderTextColor={colors.textMuted}
                    value={maxUsesInput}
                    onChangeText={setMaxUsesInput}
                    keyboardType="numeric"
                    className="text-xs p-2.5 rounded-lg border font-mono"
                    style={{ backgroundColor: colors.bg, borderColor: colors.cardBorder, color: colors.textPrimary }}
                  />
                </View>

                {/* 第2行：有效期30天 */}
                <View className="mb-3.5">
                  <View className="flex-row items-center justify-between mb-1">
                    <Text className="text-xs font-semibold" style={{ color: colors.textSecondary }}>
                      有效期30天
                    </Text>
                    <Text className="text-[11px]" style={{ color: colors.textMuted }}>
                      生成后多少天内有效
                    </Text>
                  </View>
                  <TextInput
                    placeholder="30"
                    placeholderTextColor={colors.textMuted}
                    value={expireDaysInput}
                    onChangeText={setExpireDaysInput}
                    keyboardType="numeric"
                    className="text-xs p-2.5 rounded-lg border font-mono"
                    style={{ backgroundColor: colors.bg, borderColor: colors.cardBorder, color: colors.textPrimary }}
                  />
                </View>

                <View className="flex-row gap-2">
                  {/* 需求2 & 3：按钮文字改为一键随机生成，去除8位字样 */}
                  <Pressable
                    onPress={() => handleCreateCode(true)}
                    disabled={creatingCode}
                    className="flex-1 flex-row items-center justify-center py-2.5 rounded-xl border active:opacity-85"
                    style={{ backgroundColor: colors.bg, borderColor: colors.accent }}
                  >
                    <Sparkles size={14} color={colors.accent} />
                    <Text className="text-xs font-bold ml-1" style={{ color: colors.accent }}>
                      一键随机生成
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => handleCreateCode(false)}
                    disabled={creatingCode}
                    className="flex-1 flex-row items-center justify-center py-2.5 rounded-xl active:opacity-85 shadow"
                    style={{ backgroundColor: colors.accent }}
                  >
                    {creatingCode ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Plus size={14} color="#FFFFFF" />
                        <Text className="text-xs font-bold text-white ml-1">确认新增邀请码</Text>
                      </>
                    )}
                  </Pressable>
                </View>

                {codeSuccessMsg ? (
                  <View className="flex-row items-center mt-2.5 p-2 rounded-lg bg-emerald-50 border border-emerald-200">
                    <Check size={14} color="#10B981" />
                    <Text className="text-xs text-emerald-700 ml-1.5">{codeSuccessMsg}</Text>
                  </View>
                ) : null}
              </View>

              {/* 邀请码列表 */}
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-xs font-bold" style={{ color: colors.textMuted }}>
                  现有邀请码列表 ({invitationCodes.length} 个)
                </Text>
              </View>

              {invitationCodes.length === 0 ? (
                <Text className="text-xs text-center py-8" style={{ color: colors.textMuted }}>
                  暂无邀请码记录，请点击上方一键生成
                </Text>
              ) : (
                <View className="gap-2.5">
                  {invitationCodes.map((codeItem) => {
                    const isExhausted = codeItem.max_uses > 0 && codeItem.uses_count >= codeItem.max_uses;
                    const isExpired = codeItem.expires_at && new Date(codeItem.expires_at) < new Date();
                    const isUsable = codeItem.is_active && !isExhausted && !isExpired;

                    return (
                      <View
                        key={codeItem.id}
                        className="p-3.5 rounded-2xl border"
                        style={{ backgroundColor: colors.cardBg, borderColor: colors.cardBorder }}
                      >
                        <View className="flex-row items-center justify-between mb-1.5">
                          <View className="flex-row items-center">
                            <Text
                              className="text-base font-bold font-mono tracking-wider mr-2"
                              style={{ color: colors.accent }}
                            >
                              {codeItem.code}
                            </Text>
                            <View
                              className="px-2 py-0.5 rounded-full"
                              style={{
                                backgroundColor: isUsable ? '#DEF7EC' : '#FDE8E8',
                              }}
                            >
                              <Text
                                className="text-[10px] font-bold"
                                style={{ color: isUsable ? '#03543F' : '#9B1C1C' }}
                              >
                                {isUsable ? '有效可用' : isExhausted ? '已用完' : isExpired ? '已过期' : '已停用'}
                              </Text>
                            </View>
                          </View>

                          <View className="flex-row items-center gap-1.5">
                            {/* 启用/停用按钮 */}
                            <Pressable
                              onPress={() => handleToggleCodeActive(codeItem.id, codeItem.is_active)}
                              className="px-2.5 py-1 rounded-lg border"
                              style={{
                                borderColor: codeItem.is_active ? '#F59E0B' : '#10B981',
                                backgroundColor: colors.bg,
                              }}
                            >
                              <Text
                                className="text-[10px] font-bold"
                                style={{ color: codeItem.is_active ? '#D97706' : '#10B981' }}
                              >
                                {codeItem.is_active ? '停用' : '激活'}
                              </Text>
                            </Pressable>

                            {/* 删除按钮 (仅未使用的允许删除) */}
                            {codeItem.uses_count === 0 && (
                              <Pressable
                                onPress={() => handleDeleteCode(codeItem.id)}
                                className="p-1.5 rounded-lg active:opacity-60"
                              >
                                <Trash2 size={15} color="#EF4444" />
                              </Pressable>
                            )}
                          </View>
                        </View>

                        <View className="flex-row flex-wrap gap-x-4 gap-y-1 mt-1">
                          <View className="flex-row items-center">
                            <Users size={11} color={colors.textMuted} />
                            <Text className="text-[11px] ml-1 font-mono" style={{ color: colors.textMuted }}>
                              使用: {codeItem.uses_count} / {codeItem.max_uses} 次
                            </Text>
                          </View>

                          {codeItem.expires_at ? (
                            <View className="flex-row items-center">
                              <Calendar size={11} color={colors.textMuted} />
                              <Text className="text-[11px] ml-1 font-mono" style={{ color: colors.textMuted }}>
                                截止: {new Date(codeItem.expires_at).toLocaleDateString()}
                              </Text>
                            </View>
                          ) : (
                            <Text className="text-[11px] font-mono" style={{ color: colors.textMuted }}>
                              永久有效
                            </Text>
                          )}

                          {codeItem.used_at && (
                            <Text className="text-[11px] font-mono" style={{ color: colors.textMuted }}>
                              最近使用: {new Date(codeItem.used_at).toLocaleDateString()}
                            </Text>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          )}

          {/* 分类标签自定义管理 */}
          {activeTab === 'tags' && (
            <View>
              {/* 三个分类标签页切换 (主题范畴 / 心境 / 天气) */}
              <View
                className="p-1.5 rounded-2xl border mb-4 flex-row"
                style={{ backgroundColor: colors.cardBg, borderColor: colors.cardBorder }}
              >
                {(
                  [
                    { key: 'theme', label: '主题范畴' },
                    { key: 'mood', label: '心境' },
                    { key: 'weather', label: '天气' },
                  ] as const
                ).map((cat) => {
                  const isActive = selectedTagTab === cat.key;
                  const count = tagItems.filter((t) => t.category === cat.key).length;
                  return (
                    <Pressable
                      key={cat.key}
                      onPress={() => {
                        setSelectedTagTab(cat.key);
                        setNewTagCategory(cat.key);
                      }}
                      className="flex-1 py-2.5 rounded-xl items-center justify-center active:opacity-75"
                      style={{
                        backgroundColor: isActive ? colors.accent : 'transparent',
                      }}
                    >
                      <Text
                        className="text-xs font-bold"
                        style={{ color: isActive ? '#FFFFFF' : colors.textSecondary }}
                      >
                        {cat.label} ({count})
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* 当前标签页已有标签列表展示 */}
              <View
                className="p-5 rounded-3xl border shadow-sm mb-4"
                style={{ backgroundColor: colors.cardBg, borderColor: colors.cardBorder }}
              >
                <View className="flex-row items-center justify-between mb-3">
                  <View className="flex-row items-center">
                    <Tags size={18} color={colors.accent} />
                    <Text className="text-sm font-bold ml-2" style={{ color: colors.textPrimary }}>
                      {selectedTagTab === 'theme' ? '主题范畴' : selectedTagTab === 'mood' ? '心境' : '天气'}已有标签 (
                      {tagItems.filter((t) => t.category === selectedTagTab).length})
                    </Text>
                  </View>
                  <Text className="text-[10px]" style={{ color: colors.textMuted }}>
                    点击编辑 / 长按或点击删除
                  </Text>
                </View>

                <View className="flex-row flex-wrap gap-2.5">
                  {tagItems
                    .filter((t) => t.category === selectedTagTab)
                    .map((tag) => (
                      <Pressable
                        key={tag.id}
                        onPress={() => handleStartEditTag(tag)}
                        onLongPress={() => handleDeleteTag(tag.id, tag.name)}
                        className="flex-row items-center px-3 py-2 rounded-xl border active:opacity-70"
                        style={{ backgroundColor: colors.bg, borderColor: colors.cardBorder }}
                      >
                        <Text className="text-xs mr-2 font-medium" style={{ color: colors.textPrimary }}>
                          {tag.emoji ? `${tag.emoji} ` : ''}{tag.name}
                        </Text>
                        <Pressable
                          onPress={(e) => {
                            e.stopPropagation();
                            handleStartEditTag(tag);
                          }}
                          className="p-1 mr-1 active:opacity-60"
                        >
                          <Edit2 size={12} color={colors.accent} />
                        </Pressable>
                        <Pressable
                          onPress={(e) => {
                            e.stopPropagation();
                            handleDeleteTag(tag.id, tag.name);
                          }}
                          className="p-1 active:opacity-60"
                        >
                          <Trash2 size={12} color="#EF4444" />
                        </Pressable>
                      </Pressable>
                    ))}
                  {tagItems.filter((t) => t.category === selectedTagTab).length === 0 && (
                    <Text className="text-xs italic py-4 text-center w-full" style={{ color: colors.textMuted }}>
                      暂无标签，请在下方添加
                    </Text>
                  )}
                </View>
              </View>

              {/* 添加新标签卡片 */}
              <View
                className="p-5 rounded-3xl border shadow-sm mb-4"
                style={{ backgroundColor: colors.cardBg, borderColor: colors.cardBorder }}
              >
                <View className="flex-row items-center mb-3">
                  <View
                    className="w-9 h-9 rounded-xl items-center justify-center mr-2.5"
                    style={{ backgroundColor: colors.accentBg }}
                  >
                    <Plus size={18} color={colors.accent} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-bold" style={{ color: colors.textPrimary }}>
                      添加新标签 (归属于「{selectedTagTab === 'theme' ? '主题范畴' : selectedTagTab === 'mood' ? '心境' : '天气'}」)
                    </Text>
                    <Text className="text-[11px] mt-0.5" style={{ color: colors.textMuted }}>
                      输入标签名与选择emoji，点击添加即可保存到数据库
                    </Text>
                  </View>
                </View>

                {/* 标签名称与 emoji 输入 */}
                <View className="flex-row gap-2 mb-2">
                  <View className="w-20">
                    <Text className="text-xs font-semibold mb-1" style={{ color: colors.textSecondary }}>
                      Emoji
                    </Text>
                    <TextInput
                      value={newTagEmoji}
                      onChangeText={setNewTagEmoji}
                      placeholder="✨"
                      placeholderTextColor={colors.textMuted}
                      className="px-2.5 py-2 rounded-xl border text-base text-center"
                      style={{
                        backgroundColor: colors.bg,
                        borderColor: colors.cardBorder,
                        color: colors.textPrimary,
                      }}
                    />
                  </View>

                  <View className="flex-1">
                    <Text className="text-xs font-semibold mb-1" style={{ color: colors.textSecondary }}>
                      标签名称
                    </Text>
                    <TextInput
                      value={newTagName}
                      onChangeText={setNewTagName}
                      placeholder={selectedTagTab === 'theme' ? '例如：自我认知 / 美与艺术' : selectedTagTab === 'mood' ? '例如：释然 / 平静' : '例如：晴 / 雾'}
                      placeholderTextColor={colors.textMuted}
                      className="px-3 py-2 rounded-xl border text-sm"
                      style={{
                        backgroundColor: colors.bg,
                        borderColor: colors.cardBorder,
                        color: colors.textPrimary,
                      }}
                    />
                  </View>
                </View>

                {/* 常用 Emoji 快捷选择器 */}
                <View className="mb-3">
                  <Text className="text-[10px] mb-1 font-medium" style={{ color: colors.textMuted }}>
                    快捷选择 Emoji 图标：
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View className="flex-row gap-1.5 py-1">
                      {QUICK_EMOJIS.map((em) => (
                        <Pressable
                          key={em}
                          onPress={() => setNewTagEmoji(em)}
                          className="w-8 h-8 rounded-lg border items-center justify-center active:opacity-75"
                          style={{
                            backgroundColor: newTagEmoji === em ? colors.accentBg : colors.bg,
                            borderColor: newTagEmoji === em ? colors.accent : colors.cardBorder,
                          }}
                        >
                          <Text className="text-sm">{em}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </ScrollView>
                </View>

                {tagMsg ? (
                  <Text className="text-xs mb-3 text-center" style={{ color: colors.accent }}>
                    {tagMsg}
                  </Text>
                ) : null}

                <Pressable
                  onPress={handleAddTag}
                  disabled={tagAdding || !newTagName.trim()}
                  className="py-3 rounded-2xl items-center justify-center active:opacity-85 shadow"
                  style={{
                    backgroundColor: !newTagName.trim() ? colors.cardBorder : colors.accent,
                  }}
                >
                  <Text className="text-xs font-bold text-white">
                    {tagAdding ? '正在添加...' : '添加'}
                  </Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* 2. 修改密码 (安全设置) */}
          {activeTab === 'security' && (
            <View>
              <View
                className="p-5 rounded-3xl border shadow-sm mb-4"
                style={{ backgroundColor: colors.cardBg, borderColor: colors.cardBorder }}
              >
                <View className="flex-row items-center mb-3">
                  <View
                    className="w-10 h-10 rounded-xl items-center justify-center mr-3"
                    style={{ backgroundColor: colors.accentBg }}
                  >
                    <ShieldCheck size={22} color={colors.accent} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-base font-bold" style={{ color: colors.textPrimary }}>
                      修改管理员登录密码
                    </Text>
                    <Text className="text-xs mt-0.5" style={{ color: colors.textMuted }}>
                      需核验当前原密码，两次输入新密码一致后方可提交
                    </Text>
                  </View>
                </View>

                <View className="h-0.5 w-full my-3" style={{ backgroundColor: colors.cardBorder }} />

                {/* 表单输入区 */}
                <View className="gap-3.5 my-2">
                  <View>
                    <Text className="text-xs font-semibold mb-1.5" style={{ color: colors.textSecondary }}>
                      当前原密码 <Text className="text-red-500">*</Text>
                    </Text>
                    <View
                      className="flex-row items-center px-3.5 py-2.5 rounded-xl border"
                      style={{ backgroundColor: colors.bg, borderColor: colors.cardBorder }}
                    >
                      <Lock size={16} color={colors.textMuted} />
                      <TextInput
                        placeholder="请输入当前登录密码"
                        placeholderTextColor={colors.textMuted}
                        value={currentPassword}
                        onChangeText={setCurrentPassword}
                        secureTextEntry
                        className="flex-1 ml-2 text-sm"
                        style={{ color: colors.textPrimary }}
                      />
                    </View>
                  </View>

                  <View>
                    <Text className="text-xs font-semibold mb-1.5" style={{ color: colors.textSecondary }}>
                      新密码 <Text className="text-red-500">*</Text>
                    </Text>
                    <View
                      className="flex-row items-center px-3.5 py-2.5 rounded-xl border"
                      style={{ backgroundColor: colors.bg, borderColor: colors.cardBorder }}
                    >
                      <KeyRound size={16} color={colors.textMuted} />
                      <TextInput
                        placeholder="请输入新密码 (不少于6位)"
                        placeholderTextColor={colors.textMuted}
                        value={newPassword}
                        onChangeText={setNewPassword}
                        secureTextEntry
                        className="flex-1 ml-2 text-sm"
                        style={{ color: colors.textPrimary }}
                      />
                    </View>
                  </View>

                  <View>
                    <Text className="text-xs font-semibold mb-1.5" style={{ color: colors.textSecondary }}>
                      确认新密码 <Text className="text-red-500">*</Text>
                    </Text>
                    <View
                      className="flex-row items-center px-3.5 py-2.5 rounded-xl border"
                      style={{ backgroundColor: colors.bg, borderColor: colors.cardBorder }}
                    >
                      <KeyRound size={16} color={colors.textMuted} />
                      <TextInput
                        placeholder="请再次输入新密码"
                        placeholderTextColor={colors.textMuted}
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        secureTextEntry
                        className="flex-1 ml-2 text-sm"
                        style={{ color: colors.textPrimary }}
                      />
                    </View>
                  </View>
                </View>

                {/* 错误或成功提示 */}
                {pwdError ? (
                  <View className="flex-row items-center mt-3 p-3 rounded-xl bg-red-50 border border-red-200">
                    <AlertCircle size={16} color="#EF4444" />
                    <Text className="text-xs text-red-600 ml-2 flex-1">{pwdError}</Text>
                  </View>
                ) : null}

                {pwdSuccess ? (
                  <View className="flex-row items-center mt-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                    <Check size={16} color="#10B981" />
                    <Text className="text-xs text-emerald-700 ml-2 flex-1 font-semibold">{pwdSuccess}</Text>
                  </View>
                ) : null}

                {/* 提交按钮 */}
                <Pressable
                  onPress={handleChangePassword}
                  disabled={pwdLoading}
                  className="mt-5 py-3 rounded-xl flex-row items-center justify-center active:opacity-85 shadow"
                  style={{ backgroundColor: colors.accent }}
                >
                  {pwdLoading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Check size={16} color="#FFFFFF" />
                      <Text className="text-sm font-bold text-white ml-1.5">确认修改并重新登录</Text>
                    </>
                  )}
                </Pressable>
              </View>

              {/* MOSI 安全策略：PIN/手势由管理员统一控制 */}
              <View className="p-5 rounded-3xl border shadow-sm mb-4" style={{backgroundColor:colors.cardBg,borderColor:colors.cardBorder}}>
                <Text className="text-base font-bold mb-1" style={{color:colors.textPrimary}}>应用安全策略</Text>
                <Text className="text-xs mb-4" style={{color:colors.textMuted}}>所有开关在数据库服务端保存；普通用户端不再拥有修改权限。</Text>
                {[
                  ['security_pin_enabled','PIN 码保护'],
                  ['security_gesture_enabled','手势密码保护'],
                  ['device_allowlist_enabled','设备授权白名单'],
                ].map(([key,label])=><View key={key} className="flex-row items-center justify-between py-3 border-b" style={{borderColor:colors.cardBorder}}><View className="flex-1 mr-3"><Text className="text-sm font-semibold" style={{color:colors.textPrimary}}>{label}</Text><Text className="text-[11px] mt-1" style={{color:colors.textMuted}}>{key==='device_allowlist_enabled'?'关闭后所有已登录设备可访问私人数据；建议保持开启。':'由管理员决定应用是否强制执行。'}</Text></View><Switch value={Boolean(securityPolicy?.[key])} onValueChange={(v)=>toggleSecuritySetting(key,v)} trackColor={{false:colors.cardBorder,true:colors.accentBg}} thumbColor={Boolean(securityPolicy?.[key])?colors.accent:colors.textMuted}/></View>)}
                <View className="mt-4 flex-row gap-2">
                  <Pressable onPress={()=>setPinSetupVisible(true)} className="flex-1 py-2.5 rounded-xl border items-center" style={{borderColor:colors.cardBorder,backgroundColor:colors.bg}}><Text className="text-xs font-bold" style={{color:colors.textPrimary}}>{pinConfigured?'重设 PIN':'设置 PIN'}</Text></Pressable>
                  <Pressable onPress={()=>setGestureSetupVisible(true)} className="flex-1 py-2.5 rounded-xl border items-center" style={{borderColor:colors.cardBorder,backgroundColor:colors.bg}}><Text className="text-xs font-bold" style={{color:colors.textPrimary}}>{gestureConfigured?'重设手势':'设置手势'}</Text></Pressable>
                  {gestureConfigured ? <Pressable onPress={async()=>{await clearGesturePattern();setGestureConfigured(false)}} className="px-3 py-2.5 rounded-xl border items-center" style={{borderColor:'#FCA5A5',backgroundColor:'#FEF2F2'}}><Text className="text-xs font-bold text-red-600">清除手势</Text></Pressable> : null}
                </View>
                <View className="pt-4 flex-row gap-3"><View className="flex-1"><Text className="text-xs font-semibold mb-1" style={{color:colors.textSecondary}}>自动保存（秒，最低30）</Text><TextInput keyboardType="numeric" value={String(securityPolicy?.autosave_interval_seconds ?? 30)} onChangeText={v=>setSecurityPolicy((p:any)=>({...p,autosave_interval_seconds:Number(v)||30}))} onBlur={()=>toggleSecuritySetting('autosave_interval_seconds',Math.max(30,Number(securityPolicy?.autosave_interval_seconds)||30))} className="p-2.5 rounded-xl border text-xs" style={{backgroundColor:colors.bg,borderColor:colors.cardBorder,color:colors.textPrimary}}/></View><View className="flex-1"><Text className="text-xs font-semibold mb-1" style={{color:colors.textSecondary}}>自动备份（秒，最低60）</Text><TextInput keyboardType="numeric" value={String(securityPolicy?.local_backup_interval_seconds ?? 60)} onChangeText={v=>setSecurityPolicy((p:any)=>({...p,local_backup_interval_seconds:Number(v)||60}))} onBlur={()=>toggleSecuritySetting('local_backup_interval_seconds',Math.max(60,Number(securityPolicy?.local_backup_interval_seconds)||60))} className="p-2.5 rounded-xl border text-xs" style={{backgroundColor:colors.bg,borderColor:colors.cardBorder,color:colors.textPrimary}}/></View></View>
              </View>

              {/* 设备白名单 */}
              <View className="p-5 rounded-3xl border shadow-sm mb-4" style={{backgroundColor:colors.cardBg,borderColor:colors.cardBorder}}>
                <Text className="text-base font-bold" style={{color:colors.textPrimary}}>设备授权管理</Text>
                <Text className="text-xs mt-1 mb-3" style={{color:colors.textMuted}}>只允许你手动批准的设备进入私人数据库。IP 不是稳定的唯一身份，因此不作为唯一安全依据。</Text>
                {devices.map(d=><View key={d.id} className="py-3 border-b" style={{borderColor:colors.cardBorder}}><View className="flex-row items-center justify-between"><View className="flex-1 mr-3"><Text className="text-xs font-bold" style={{color:colors.textPrimary}}>{d.device_name}</Text><Text className="text-[10px] mt-1" style={{color:colors.textMuted}}>{d.platform} · {d.device_id.slice(0,8)}… · {d.approved?'已授权':'待授权'}</Text></View><Pressable onPress={async()=>{const ok=await setDeviceApproval(d.id,!d.approved);if(ok)setDevices(prev=>prev.map(x=>x.id===d.id?{...x,approved:!d.approved}:x));}} className="px-3 py-1.5 rounded-xl border" style={{backgroundColor:d.approved?'#FEF2F2':colors.accentBg,borderColor:d.approved?'#EF4444':colors.accent}}><Text className="text-[11px] font-bold" style={{color:d.approved?'#DC2626':colors.accent}}>{d.approved?'撤销授权':'批准设备'}</Text></Pressable></View></View>)}
                {!devices.length?<Text className="text-xs py-3" style={{color:colors.textMuted}}>暂无设备登记。</Text>:null}
              </View>

              {/* 完整审计日志 */}
              <View className="p-5 rounded-3xl border shadow-sm mb-4" style={{backgroundColor:colors.cardBg,borderColor:colors.cardBorder}}>
                <View className="flex-row items-center justify-between mb-3"><View><Text className="text-base font-bold" style={{color:colors.textPrimary}}>安全审计日志</Text><Text className="text-xs mt-1" style={{color:colors.textMuted}}>数据库触发器记录数据增删改、设备授权、分享链接和设置变更。</Text></View><Pressable onPress={async()=>setAuditLogs(await getAuditLogs(300))} className="px-3 py-1.5 rounded-xl border" style={{borderColor:colors.cardBorder}}><Text className="text-[11px] font-bold" style={{color:colors.accent}}>刷新</Text></Pressable></View>
                {auditLoading?<ActivityIndicator color={colors.accent}/>:auditLogs.slice(0,80).map(log=><View key={String(log.id)} className="py-2.5 border-b" style={{borderColor:colors.cardBorder}}><View className="flex-row justify-between"><Text className="text-xs font-bold" style={{color:log.severity==='critical'?'#DC2626':log.severity==='warning'?'#D97706':colors.textPrimary}}>{log.action} · {log.entity_type}</Text><Text className="text-[10px]" style={{color:colors.textMuted}}>{new Date(log.created_at).toLocaleString()}</Text></View><Text className="text-[10px] mt-1" numberOfLines={2} style={{color:colors.textMuted}}>ID: {log.entity_id || '-'} · 设备: {log.actor_device_id ? log.actor_device_id.slice(0,8)+'…' : '未知'}</Text></View>)}
              </View>

              {/* 初始密码与安全提示小卡片 */}
              <View
                className="p-4 rounded-2xl border bg-black/5 mb-4"
                style={{ borderColor: colors.cardBorder }}
              >
                <Text className="text-xs font-semibold mb-1" style={{ color: colors.textPrimary }}>
                  安全指引：
                </Text>
                <Text className="text-[11px] leading-relaxed" style={{ color: colors.textMuted }}>
                  • 系统管理员初始密码只应通过安全渠道设置；源码与界面不再展示默认密码。{'\n'}
                  • 修改密码成功后，系统将自动退出当前会话并跳转至登录页，请妥善保管新密码。
                </Text>
              </View>

              {/* 退出登录操作卡片 */}
              <View
                className="p-5 rounded-3xl border shadow-sm"
                style={{ backgroundColor: colors.cardBg, borderColor: colors.cardBorder }}
              >
                <View className="flex-row items-center mb-2">
                  <View
                    className="w-9 h-9 rounded-xl items-center justify-center mr-2.5"
                    style={{ backgroundColor: '#FEE2E2' }}
                  >
                    <LogOut size={18} color="#EF4444" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-bold" style={{ color: colors.textPrimary }}>
                      退出管理后台
                    </Text>
                    <Text className="text-xs mt-0.5" style={{ color: colors.textMuted }}>
                      清除创作者登录态，支持自主选择保留或清除本地缓存
                    </Text>
                  </View>
                </View>

                <Pressable
                  onPress={() => setLogoutModalVisible(true)}
                  className="mt-3 py-3 rounded-2xl border flex-row items-center justify-center active:opacity-75"
                  style={{ borderColor: '#EF4444', backgroundColor: colors.bg }}
                >
                  <LogOut size={15} color="#EF4444" />
                  <Text className="text-xs font-bold text-red-500 ml-1.5">退出当前登录状态</Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* 备份与恢复模块 */}
          {activeTab === 'backup' && (
            <View>
              {/* 备份状态概览卡片 */}
              <View
                className="p-5 rounded-3xl border shadow-sm mb-4"
                style={{ backgroundColor: colors.cardBg, borderColor: colors.cardBorder }}
              >
                <View className="flex-row items-center mb-3">
                  <View
                    className="w-10 h-10 rounded-xl items-center justify-center mr-3"
                    style={{ backgroundColor: colors.accentBg }}
                  >
                    <Database size={22} color={colors.accent} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-base font-bold" style={{ color: colors.textPrimary }}>
                      数据库本地备份与灾备恢复
                    </Text>
                    <Text className="text-xs mt-0.5" style={{ color: colors.textMuted }}>
                      当网络不可用时系统自动降级读取本地备份展示
                    </Text>
                  </View>
                </View>

                {/* 状态统计条目 */}
                <View
                  className="p-3.5 rounded-2xl border mb-3 gap-2"
                  style={{ backgroundColor: colors.bg, borderColor: colors.cardBorder }}
                >
                  <View className="flex-row items-center justify-between">
                    <Text className="text-xs" style={{ color: colors.textSecondary }}>
                      上次备份时间
                    </Text>
                    <Text className="text-xs font-semibold" style={{ color: colors.textPrimary }}>
                      {backupMeta?.lastBackupTime
                        ? backupMeta.lastBackupDateStr || new Date(backupMeta.lastBackupTime).toLocaleString()
                        : '尚未进行过备份'}
                    </Text>
                  </View>

                  <View className="flex-row items-center justify-between">
                    <Text className="text-xs" style={{ color: colors.textSecondary }}>
                      本地备份数据大小
                    </Text>
                    <Text className="text-xs font-semibold font-mono" style={{ color: colors.textPrimary }}>
                      {formatBytes(backupMeta?.sizeBytes || 0)}
                    </Text>
                  </View>

                  <View className="flex-row items-center justify-between">
                    <Text className="text-xs" style={{ color: colors.textSecondary }}>
                      备份包含记录数
                    </Text>
                    <Text className="text-xs font-semibold" style={{ color: colors.accent }}>
                      {backupMeta?.count?.journals || 0} 篇日志 · {backupMeta?.count?.comments || 0} 条评论 · {backupMeta?.count?.tags || 0} 个标签
                    </Text>
                  </View>
                </View>

                {/* 反馈提示 */}
                {backupStatusMsg && (
                  <View
                    className="flex-row items-center p-3 rounded-xl border mb-3"
                    style={{
                      backgroundColor: backupStatusMsg.type === 'success' ? '#ECFDF5' : '#FEF2F2',
                      borderColor: backupStatusMsg.type === 'success' ? '#10B981' : '#EF4444',
                    }}
                  >
                    {backupStatusMsg.type === 'success' ? (
                      <Check size={16} color="#10B981" />
                    ) : (
                      <AlertCircle size={16} color="#EF4444" />
                    )}
                    <Text
                      className="text-xs ml-2 font-medium flex-1"
                      style={{ color: backupStatusMsg.type === 'success' ? '#047857' : '#B91C1C' }}
                    >
                      {backupStatusMsg.text}
                    </Text>
                  </View>
                )}

                {/* 操作按钮组 */}
                <View className="gap-2.5">
                  <Pressable
                    onPress={handleManualBackup}
                    disabled={backupLoading}
                    className="py-3 rounded-2xl items-center justify-center flex-row active:opacity-85 shadow"
                    style={{ backgroundColor: colors.accent }}
                  >
                    {backupLoading ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <HardDrive size={15} color="#FFFFFF" />
                        <Text className="text-xs font-bold text-white ml-2">立即执行本地全量备份</Text>
                      </>
                    )}
                  </Pressable>

                  <Pressable
                    onPress={handleManualRestore}
                    disabled={backupLoading || !backupMeta?.lastBackupTime}
                    className="py-3 rounded-2xl border items-center justify-center flex-row active:opacity-75"
                    style={{
                      backgroundColor: colors.bg,
                      borderColor: backupMeta?.lastBackupTime ? colors.accent : colors.cardBorder,
                      opacity: backupMeta?.lastBackupTime ? 1 : 0.5,
                    }}
                  >
                    <RefreshCw size={15} color={colors.accent} />
                    <Text className="text-xs font-bold ml-2" style={{ color: colors.accent }}>
                      从最近本地备份一键恢复
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={handleClearBackup}
                    disabled={backupLoading || !backupMeta?.lastBackupTime}
                    className="py-3 rounded-2xl border items-center justify-center flex-row active:opacity-75"
                    style={{
                      backgroundColor: colors.bg,
                      borderColor: backupMeta?.lastBackupTime ? '#EF4444' : colors.cardBorder,
                      opacity: backupMeta?.lastBackupTime ? 1 : 0.5,
                    }}
                  >
                    <Trash2 size={15} color={backupMeta?.lastBackupTime ? '#EF4444' : colors.textMuted} />
                    <Text
                      className="text-xs font-bold ml-2"
                      style={{ color: backupMeta?.lastBackupTime ? '#EF4444' : colors.textMuted }}
                    >
                      清除当前设备本地备份
                    </Text>
                  </Pressable>
                </View>
              </View>

              {/* 机制说明卡片 */}
              <View
                className="p-4 rounded-2xl border bg-black/5"
                style={{ borderColor: colors.cardBorder }}
              >
                <Text className="text-xs font-semibold mb-1" style={{ color: colors.textPrimary }}>
                  自动备份与离线降级机制说明：
                </Text>
                <Text className="text-[11px] leading-relaxed" style={{ color: colors.textMuted }}>
                  1. 自动同步：每次创作者修改日志、读者发布评论或调整标签时，系统均会在 1.5 秒内自动静默生成本地异步快照。{'\n'}
                  2. 离线访问：当发生网络断开或数据库连接故障时，客户端将优先无缝降级读取本地缓存，保障沉思阅读体验不受中断。{'\n'}
                  3. 灾备保障：若远端数据出现误删或异常，可点击上方「一键恢复」按钮将本地历史备份完整推送同步回数据库。
                </Text>
              </View>
            </View>
          )}

          {/* 3. 伴读乐库管理 */}
          {activeTab === 'music' && (
            <View>
              {/* 从手机选择并上传音乐组件 */}
              <View
                className="p-4 rounded-2xl border mb-5"
                style={{ backgroundColor: colors.cardBg, borderColor: colors.cardBorder }}
              >
                <Text className="text-sm font-bold mb-1.5" style={{ color: colors.textPrimary }}>
                  从手机上传伴读乐曲
                </Text>
                <Text className="text-xs mb-3" style={{ color: colors.textMuted }}>
                  支持选择本地 .mp3 / .m4a / .wav / .ogg / .flac 等格式音频，自动上传至云端伴读乐库
                </Text>

                {/* 1. 从手机选择按钮与当前选择的文件提示 */}
                <Pressable
                  onPress={handlePickMusicFile}
                  disabled={uploadingMusic}
                  className="flex-row items-center justify-center p-3 rounded-xl border border-dashed mb-3 active:opacity-80"
                  style={{
                    backgroundColor: colors.accentBg,
                    borderColor: colors.accent,
                  }}
                >
                  <Music size={18} color={colors.accent} />
                  <Text className="text-xs font-bold ml-2" style={{ color: colors.accent }}>
                    {selectedMusicFile ? `已选文件: ${selectedMusicFile.name}` : '点击从手机选择音频文件'}
                  </Text>
                </Pressable>

                {selectedMusicFile && (
                  <View
                    className="p-2.5 rounded-lg border mb-3 flex-row items-center justify-between"
                    style={{ backgroundColor: colors.bg, borderColor: colors.cardBorder }}
                  >
                    <View className="flex-1 mr-2">
                      <Text numberOfLines={1} className="text-xs font-semibold" style={{ color: colors.textPrimary }}>
                        {selectedMusicFile.name}
                      </Text>
                      {selectedMusicFile.size ? (
                        <Text className="text-[10px]" style={{ color: colors.textMuted }}>
                          大小: {(selectedMusicFile.size / (1024 * 1024)).toFixed(2)} MB
                        </Text>
                      ) : null}
                    </View>
                    <Pressable onPress={() => setSelectedMusicFile(null)} className="p-1">
                      <Text className="text-xs text-destructive">重新选择</Text>
                    </Pressable>
                  </View>
                )}

                <TextInput
                  placeholder="曲目名称 (可选，默认使用文件名)"
                  placeholderTextColor={colors.textMuted}
                  value={newMusicTitle}
                  onChangeText={setNewMusicTitle}
                  editable={!uploadingMusic}
                  className="text-xs p-2.5 rounded-lg border mb-2"
                  style={{ backgroundColor: colors.bg, borderColor: colors.cardBorder, color: colors.textPrimary }}
                />

                <TextInput
                  placeholder="艺术家 / 风格标签 (可选，如: 墨思伴读)"
                  placeholderTextColor={colors.textMuted}
                  value={newMusicArtist}
                  onChangeText={setNewMusicArtist}
                  editable={!uploadingMusic}
                  className="text-xs p-2.5 rounded-lg border mb-3"
                  style={{ backgroundColor: colors.bg, borderColor: colors.cardBorder, color: colors.textPrimary }}
                />

                {musicUploadError ? (
                  <View className="flex-row items-center mb-3">
                    <AlertCircle size={14} color="#EF4444" />
                    <Text className="text-xs text-destructive ml-1">{musicUploadError}</Text>
                  </View>
                ) : null}

                {musicUploadSuccess ? (
                  <View className="flex-row items-center mb-3">
                    <Check size={14} color="#10B981" />
                    <Text className="text-xs text-emerald-600 ml-1">{musicUploadSuccess}</Text>
                  </View>
                ) : null}

                <Pressable
                  onPress={handleUploadAndAddMusic}
                  disabled={uploadingMusic || !selectedMusicFile}
                  className="flex-row items-center justify-center py-2.5 rounded-xl active:opacity-85"
                  style={{
                    backgroundColor: selectedMusicFile && !uploadingMusic ? colors.accent : colors.tagBg,
                  }}
                >
                  {uploadingMusic ? (
                    <>
                      <ActivityIndicator size="small" color="#FFFFFF" />
                      <Text className="text-xs font-bold text-white ml-2">正在上传音频至云端...</Text>
                    </>
                  ) : (
                    <>
                      <Plus size={16} color={selectedMusicFile ? '#FFFFFF' : colors.textMuted} />
                      <Text
                        className="text-xs font-bold ml-1"
                        style={{ color: selectedMusicFile ? '#FFFFFF' : colors.textMuted }}
                      >
                        上传并加入乐库
                      </Text>
                    </>
                  )}
                </Pressable>
              </View>

              <Text className="text-xs font-bold mb-2" style={{ color: colors.textMuted }}>
                当前曲目列表 ({tracks.length} 首)
              </Text>

              <View className="gap-2">
                {tracks.map((track, idx) => (
                  <View
                    key={track.id || idx}
                    className="p-3 rounded-xl border flex-row items-center justify-between"
                    style={{ backgroundColor: colors.cardBg, borderColor: colors.cardBorder }}
                  >
                    <View className="flex-row items-center flex-1 mr-2">
                      <Disc size={18} color={colors.accent} />
                      <View className="ml-2.5 flex-1">
                        <Text numberOfLines={1} className="text-xs font-bold" style={{ color: colors.textPrimary }}>
                          {track.title}
                        </Text>
                        <Text numberOfLines={1} className="text-[10px]" style={{ color: colors.textMuted }}>
                          {track.artist}
                        </Text>
                      </View>
                    </View>

                    <Pressable onPress={() => removeTrack(track.id)} className="p-1.5 active:opacity-60">
                      <Trash2 size={15} color="#EF4444" />
                    </Pressable>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* 4. 留言审核管理 */}
          {activeTab === 'comments' && (
            <View>
              <Text className="text-xs font-bold mb-3" style={{ color: colors.textMuted }}>
                全站思辨留言审查 ({comments.length} 条)
              </Text>

              {comments.length === 0 ? (
                <Text className="text-xs text-center py-10" style={{ color: colors.textMuted }}>
                  目前无留言记录
                </Text>
              ) : (
                <View className="gap-2.5">
                  {comments.map((comm) => (
                    <View
                      key={comm.id}
                      className="p-3.5 rounded-xl border"
                      style={{ backgroundColor: colors.cardBg, borderColor: colors.cardBorder }}
                    >
                      <View className="flex-row items-center justify-between mb-1.5">
                        <Text className="text-xs font-bold" style={{ color: colors.accent }}>
                          {comm.nickname} · 发表于《{comm.journal_title}》
                        </Text>
                        <Pressable onPress={() => handleDeleteComment(comm.id)} className="p-1">
                          <Trash2 size={14} color="#EF4444" />
                        </Pressable>
                      </View>

                      <Text className="text-xs leading-relaxed" style={{ color: colors.textPrimary }}>
                        {comm.content}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* 5. 批量导出 */}
          {activeTab === 'export' && (
            <View>
              <View
                className="p-4 rounded-2xl border mb-4"
                style={{ backgroundColor: colors.cardBg, borderColor: colors.cardBorder }}
              >
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-sm font-bold" style={{ color: colors.textPrimary }}>
                    打包导出思辨长卷
                  </Text>
                  <Pressable onPress={selectAllJournals} className="flex-row items-center">
                    <Text className="text-xs mr-1" style={{ color: colors.accent }}>
                      {selectedJournalIds.length === journals.length ? '取消全选' : '全选所有'}
                    </Text>
                  </Pressable>
                </View>
                <Text className="text-xs mb-4" style={{ color: colors.textMuted }}>
                  已勾选 {selectedJournalIds.length} 篇日志，支持打包为 ZIP 离线备份
                </Text>

                <Pressable
                  onPress={handleExportZip}
                  disabled={exportingZip || selectedJournalIds.length === 0}
                  className="flex-row items-center justify-center py-3 rounded-xl active:opacity-85 shadow"
                  style={{
                    backgroundColor: selectedJournalIds.length > 0 ? colors.accent : colors.tagBg,
                  }}
                >
                  {exportingZip ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Download size={16} color={selectedJournalIds.length > 0 ? '#FFFFFF' : colors.textMuted} />
                      <Text
                        className="text-xs font-bold ml-1.5"
                        style={{ color: selectedJournalIds.length > 0 ? '#FFFFFF' : colors.textMuted }}
                      >
                        批量打包导出 ZIP
                      </Text>
                    </>
                  )}
                </Pressable>

                {exportSuccess && (
                  <View className="flex-row items-center justify-center mt-3">
                    <Check size={14} color="#10B981" />
                    <Text className="text-xs text-emerald-600 ml-1">打包并触发导出成功！</Text>
                  </View>
                )}
              </View>

              {/* 日志多选列表 */}
              <View className="gap-2">
                {journals.map((j) => {
                  const isChecked = selectedJournalIds.includes(j.id);
                  return (
                    <Pressable
                      key={j.id}
                      onPress={() => toggleSelectJournal(j.id)}
                      className="p-3 rounded-xl border flex-row items-center justify-between active:opacity-80"
                      style={{
                        backgroundColor: isChecked ? colors.accentBg : colors.cardBg,
                        borderColor: isChecked ? colors.accent : colors.cardBorder,
                      }}
                    >
                      <View className="flex-1 mr-2">
                        <Text numberOfLines={1} className="text-xs font-bold" style={{ color: colors.textPrimary }}>
                          {getJournalDisplayTitle(j)}
                        </Text>
                        <Text className="text-[10px] mt-0.5" style={{ color: colors.textMuted }}>
                          {new Date(j.created_at).toLocaleDateString()} · {j.theme_tags?.join(', ')}
                        </Text>
                      </View>

                      <View className="flex-row items-center gap-2">
                        {isChecked ? <CheckSquare size={18} color={colors.accent} /> : <Square size={18} color={colors.textMuted} />}
                        <Pressable onPress={()=>{setConfirmModalTitle('删除思辨日志');setConfirmModalMessage(`确认删除《${getJournalDisplayTitle(j)}》？此操作会通过统一删除入口同步清理版本历史与相关分享链接。`);setConfirmModalAction(()=>async()=>{const ok=await deleteJournal(j.id);if(ok)setJournals(prev=>prev.filter(x=>x.id!==j.id));});setConfirmModalVisible(true);}} className="p-2 rounded-lg" style={{backgroundColor:'#FEF2F2'}}><Trash2 size={15} color="#DC2626"/></Pressable>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {/* 页面底部快捷管理区域：个人中心与数据备份恢复入口 */}
          <View
            className="mt-6 pt-5 border-t gap-3"
            style={{ borderColor: colors.cardBorder }}
          >
            {/* 个人中心直达卡片 */}
            <Pressable
              onPress={() => router.push('/profile' as any)}
              className="p-4 rounded-2xl border flex-row items-center justify-between active:opacity-75"
              style={{ backgroundColor: colors.cardBg, borderColor: colors.cardBorder }}
            >
              <View className="flex-row items-center flex-1 mr-3">
                <View
                  className="w-10 h-10 rounded-xl items-center justify-center mr-3"
                  style={{ backgroundColor: colors.accentBg }}
                >
                  <User size={20} color={colors.accent} />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-bold" style={{ color: colors.textPrimary }}>
                    个人中心
                  </Text>
                  <Text className="text-xs mt-0.5" style={{ color: colors.textMuted }}>
                    管理头像、昵称、性别、个性签名与安全PIN码
                  </Text>
                </View>
              </View>
              <View
                className="px-3 py-1.5 rounded-lg"
                style={{ backgroundColor: colors.accentBg }}
              >
                <Text className="text-xs font-bold" style={{ color: colors.accent }}>
                  前往设置
                </Text>
              </View>
            </Pressable>

            {/* 数据备份与恢复区块 */}
            <View
              className="p-4 rounded-2xl border"
              style={{ backgroundColor: colors.cardBg, borderColor: colors.cardBorder }}
            >
              <View className="flex-row items-center justify-between mb-3">
                <View className="flex-row items-center">
                  <Database size={18} color={colors.accent} />
                  <Text className="text-sm font-bold ml-2" style={{ color: colors.textPrimary }}>
                    数据备份与恢复
                  </Text>
                </View>
                <Text className="text-[11px]" style={{ color: colors.textMuted }}>
                  上次备份：{backupMeta?.lastBackupDateStr || '未备份'}
                </Text>
              </View>

              <View className="flex-row gap-2.5">
                <Pressable
                  onPress={handleManualBackup}
                  disabled={backupLoading}
                  className="flex-1 py-2.5 rounded-xl items-center justify-center flex-row active:opacity-85 shadow-sm"
                  style={{ backgroundColor: colors.accent }}
                >
                  <Database size={14} color="#FFFFFF" />
                  <Text className="text-xs font-bold text-white ml-1.5">
                    {backupLoading ? '备份中...' : '一键备份'}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={handleManualRestore}
                  disabled={backupLoading || !backupMeta?.lastBackupTime}
                  className="flex-1 py-2.5 rounded-xl border items-center justify-center flex-row active:opacity-75"
                  style={{
                    backgroundColor: colors.bg,
                    borderColor: backupMeta?.lastBackupTime ? colors.accent : colors.cardBorder,
                    opacity: backupMeta?.lastBackupTime ? 1 : 0.5,
                  }}
                >
                  <RefreshCw size={14} color={colors.accent} />
                  <Text className="text-xs font-bold ml-1.5" style={{ color: colors.accent }}>
                    一键恢复
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </ScrollView>
      )}

      {/* 危险操作确认对话框（停用/删除/切换全局邀请码开关） */}
      <Modal
        visible={confirmModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmModalVisible(false)}
      >
        <Pressable
          className="flex-1 justify-center items-center bg-black/50 px-6"
          onPress={() => setConfirmModalVisible(false)}
        >
          <Pressable
            className="w-full max-w-sm rounded-3xl p-6 shadow-xl border"
            style={{ backgroundColor: colors.cardBg, borderColor: colors.cardBorder }}
            onPress={(e) => e.stopPropagation()}
          >
            <View className="flex-row items-center mb-3">
              <View
                className="w-10 h-10 rounded-full items-center justify-center mr-3"
                style={{ backgroundColor: '#FEE2E2' }}
              >
                <AlertCircle size={22} color="#EF4444" />
              </View>
              <Text className="text-base font-bold flex-1" style={{ color: colors.textPrimary }}>
                {confirmModalTitle}
              </Text>
            </View>

            <Text className="text-sm leading-relaxed mb-6" style={{ color: colors.textSecondary }}>
              {confirmModalMessage}
            </Text>

            <View className="flex-row gap-3">
              <Pressable
                onPress={() => {
                  setConfirmModalVisible(false);
                  setConfirmModalAction(null);
                }}
                className="flex-1 py-3 rounded-2xl border items-center justify-center active:opacity-75"
                style={{ borderColor: colors.cardBorder, backgroundColor: colors.bg }}
              >
                <Text className="text-xs font-semibold" style={{ color: colors.textSecondary }}>
                  取消
                </Text>
              </Pressable>

              <Pressable
                onPress={async () => {
                  setConfirmModalVisible(false);
                  if (confirmModalAction) {
                    await confirmModalAction();
                    setConfirmModalAction(null);
                  }
                }}
                className="flex-1 py-3 rounded-2xl items-center justify-center active:opacity-85 shadow"
                style={{ backgroundColor: '#EF4444' }}
              >
                <Text className="text-xs font-bold text-white">
                  确认继续
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* 编辑分类标签模态框 */}
      <Modal
        visible={editTagModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEditTagModalVisible(false)}
      >
        <Pressable
          className="flex-1 justify-center items-center bg-black/50 px-6"
          onPress={() => setEditTagModalVisible(false)}
        >
          <Pressable
            className="w-full max-w-sm rounded-3xl p-6 shadow-xl border"
            style={{ backgroundColor: colors.cardBg, borderColor: colors.cardBorder }}
            onPress={(e) => e.stopPropagation()}
          >
            <View className="flex-row items-center mb-4">
              <View
                className="w-10 h-10 rounded-full items-center justify-center mr-3"
                style={{ backgroundColor: colors.accentBg }}
              >
                <Edit2 size={20} color={colors.accent} />
              </View>
              <Text className="text-base font-bold flex-1" style={{ color: colors.textPrimary }}>
                编辑分类标签
              </Text>
            </View>

            {/* 分类维度选择 */}
            <Text className="text-xs font-semibold mb-2" style={{ color: colors.textSecondary }}>
              所属分类
            </Text>
            <View className="flex-row gap-2 mb-3">
              {(
                [
                  { key: 'theme', label: '主题范畴' },
                  { key: 'mood', label: '心境' },
                  { key: 'weather', label: '天气' },
                ] as const
              ).map((cat) => (
                <Pressable
                  key={cat.key}
                  onPress={() => setEditTagCategory(cat.key)}
                  className="px-3 py-1.5 rounded-xl border active:opacity-75"
                  style={{
                    backgroundColor: editTagCategory === cat.key ? colors.accentBg : colors.bg,
                    borderColor: editTagCategory === cat.key ? colors.accent : colors.cardBorder,
                  }}
                >
                  <Text
                    className="text-xs font-semibold"
                    style={{ color: editTagCategory === cat.key ? colors.accent : colors.textSecondary }}
                  >
                    {cat.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Emoji 和名称编辑 */}
            <View className="flex-row gap-2 mb-2">
              <View className="w-20">
                <Text className="text-xs font-semibold mb-1.5" style={{ color: colors.textSecondary }}>
                  Emoji 图标
                </Text>
                <TextInput
                  value={editTagEmoji}
                  onChangeText={setEditTagEmoji}
                  placeholder="✨"
                  placeholderTextColor={colors.textMuted}
                  className="px-2.5 py-2.5 rounded-xl border text-base text-center"
                  style={{
                    backgroundColor: colors.bg,
                    borderColor: colors.cardBorder,
                    color: colors.textPrimary,
                  }}
                />
              </View>

              <View className="flex-1">
                <Text className="text-xs font-semibold mb-1.5" style={{ color: colors.textSecondary }}>
                  标签名称
                </Text>
                <TextInput
                  value={editTagName}
                  onChangeText={setEditTagName}
                  placeholder="标签名称"
                  placeholderTextColor={colors.textMuted}
                  className="px-3.5 py-2.5 rounded-xl border text-sm"
                  style={{
                    backgroundColor: colors.bg,
                    borderColor: colors.cardBorder,
                    color: colors.textPrimary,
                  }}
                />
              </View>
            </View>

            {/* 编辑模态框内快捷 Emoji 选择 */}
            <View className="mb-4">
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View className="flex-row gap-1.5 py-1">
                  {QUICK_EMOJIS.map((em) => (
                    <Pressable
                      key={em}
                      onPress={() => setEditTagEmoji(em)}
                      className="w-7 h-7 rounded-lg border items-center justify-center active:opacity-75"
                      style={{
                        backgroundColor: editTagEmoji === em ? colors.accentBg : colors.bg,
                        borderColor: editTagEmoji === em ? colors.accent : colors.cardBorder,
                      }}
                    >
                      <Text className="text-xs">{em}</Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            </View>

            <View className="flex-row gap-3">
              <Pressable
                onPress={() => {
                  setEditTagModalVisible(false);
                  setEditingTag(null);
                }}
                className="flex-1 py-3 rounded-2xl border items-center justify-center active:opacity-75"
                style={{ borderColor: colors.cardBorder, backgroundColor: colors.bg }}
              >
                <Text className="text-xs font-semibold" style={{ color: colors.textSecondary }}>
                  取消
                </Text>
              </Pressable>

              <Pressable
                onPress={handleSaveEditTag}
                disabled={tagUpdating || !editTagName.trim()}
                className="flex-1 py-3 rounded-2xl items-center justify-center active:opacity-85 shadow"
                style={{ backgroundColor: !editTagName.trim() ? colors.cardBorder : colors.accent }}
              >
                <Text className="text-xs font-bold text-white">
                  {tagUpdating ? '保存中...' : '保存修改'}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* 退出登录确认弹窗（是否保留本地数据） */}
      <Modal
        visible={logoutModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setLogoutModalVisible(false)}
      >
        <Pressable
          className="flex-1 justify-center items-center bg-black/60 px-6"
          onPress={() => setLogoutModalVisible(false)}
        >
          <Pressable
            className="w-full max-w-sm rounded-3xl p-6 shadow-2xl border"
            style={{ backgroundColor: colors.cardBg, borderColor: colors.cardBorder }}
            onPress={(e) => e.stopPropagation()}
          >
            <View className="items-center mb-4">
              <View
                className="w-12 h-12 rounded-2xl items-center justify-center mb-3"
                style={{ backgroundColor: '#FEE2E2' }}
              >
                <LogOut size={22} color="#EF4444" />
              </View>
              <Text className="text-base font-bold text-center" style={{ color: colors.textPrimary }}>
                确认退出管理后台
              </Text>
              <Text className="text-xs text-center mt-2 leading-relaxed" style={{ color: colors.textMuted }}>
                是否保留本地数据？保留将仅清除登录状态，清除将同时删除本地备份与离线缓存。
              </Text>
            </View>

            {loggingOut ? (
              <View className="py-6 items-center">
                <ActivityIndicator size="small" color={colors.accent} />
                <Text className="text-xs mt-2" style={{ color: colors.textMuted }}>
                  正在退出中...
                </Text>
              </View>
            ) : (
              <View className="gap-2.5">
                <Pressable
                  onPress={() => handleAdminLogout(true)}
                  className="py-3 rounded-xl items-center justify-center active:opacity-85 shadow"
                  style={{ backgroundColor: colors.accent }}
                >
                  <Text className="text-xs font-bold text-white">是，保留本地备份数据</Text>
                </Pressable>

                <Pressable
                  onPress={() => handleAdminLogout(false)}
                  className="py-3 rounded-xl border items-center justify-center active:opacity-75"
                  style={{ borderColor: '#EF4444', backgroundColor: colors.bg }}
                >
                  <Text className="text-xs font-bold text-red-500">否，清除所有本地数据</Text>
                </Pressable>

                <Pressable
                  onPress={() => setLogoutModalVisible(false)}
                  className="py-2.5 items-center justify-center active:opacity-60"
                >
                  <Text className="text-xs" style={{ color: colors.textMuted }}>
                    取消
                  </Text>
                </Pressable>
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
