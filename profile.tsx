import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '@/context/ThemeContext';
import { useSession } from '@/ctx';
import { supabase } from '@/client/supabase';
import {
  getCurrentUserProfile,
  updateUserProfile,
  UserProfileData,
} from '@/services/api';
import {
  getPinStatus,
  savePinCode,
  disablePinCode,
  getBiometricEnabled,
  setBiometricEnabled,
  checkBiometricSupport,
} from '@/utils/security';
import { clearAllLocalData } from '@/utils/backup';
import { PinKeypadModal } from '@/components/PinKeypadModal';
import {
  ChevronLeft,
  User,
  Camera,
  Calendar,
  BookOpen,
  MessageSquare,
  Shield,
  Key,
  Fingerprint,
  LogOut,
  Save,
  Check,
  AlertCircle,
  HelpCircle,
  ShieldCheck,
  Lock,
} from 'lucide-react-native';

const DEFAULT_AVATARS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=300&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=300&q=80',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=300&q=80',
];

export default function ProfileScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { session } = useSession();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [journalsCount, setJournalsCount] = useState(0);
  const [commentsCount, setCommentsCount] = useState(0);

  // 表单状态
  const [nickname, setNickname] = useState('');
  const [realName, setRealName] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | 'secret'>('secret');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [securityQuestion, setSecurityQuestion] = useState('');
  const [securityAnswer, setSecurityAnswer] = useState('');

  // 安全设置状态
  const [pinEnabled, setPinEnabled] = useState(false);
  const [currentPin, setCurrentPin] = useState<string | null>(null);
  const [showPinSetupModal, setShowPinSetupModal] = useState(false);
  const [biometricEnabled, setBiometricEnabledState] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometryType, setBiometryType] = useState('指纹/面容');

  // 退出登录确认弹窗
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  // 提示信息
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getCurrentUserProfile();
      if (res.profile) {
        setProfile(res.profile);
        setNickname(res.profile.nickname || '');
        setRealName(res.profile.real_name || '');
        setGender(res.profile.gender || 'secret');
        setBio(res.profile.bio || '');
        setAvatarUrl(res.profile.avatar_url || DEFAULT_AVATARS[0]);
        setSecurityQuestion(res.profile.security_question || '我最喜欢的哲学书籍');
        setSecurityAnswer(res.profile.security_answer || '');
      }
      setJournalsCount(res.journalsCount);
      setCommentsCount(res.commentsCount);

      // 安全配置
      const pStatus = await getPinStatus();
      setPinEnabled(pStatus.enabled);
      setCurrentPin(pStatus.pin);

      const bSupport = await checkBiometricSupport();
      setBiometricAvailable(bSupport.supported && bSupport.enrolled);
      setBiometryType(bSupport.biometryType);
      const bEnabled = await getBiometricEnabled();
      setBiometricEnabledState(bEnabled);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  // 选择相册头像
  const handlePickAvatar = async () => {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!res.canceled && res.assets && res.assets[0]?.uri) {
        setAvatarUrl(res.assets[0].uri);
      }
    } catch (e) {
      console.error('pick avatar error:', e);
    }
  };

  // 保存资料修改
  const handleSaveProfile = async () => {
    if (!nickname.trim()) {
      setStatusMsg({ type: 'error', text: '昵称不能为空' });
      return;
    }
    if (nickname.trim().length < 2 || nickname.trim().length > 20) {
      setStatusMsg({ type: 'error', text: '昵称长度需在 2-20 个字符之间' });
      return;
    }
    if (bio.trim().length > 100) {
      setStatusMsg({ type: 'error', text: '个性签名不得超过 100 个字符' });
      return;
    }

    try {
      setSaving(true);
      setStatusMsg(null);
      const res = await updateUserProfile({
        nickname: nickname.trim(),
        real_name: realName.trim(),
        gender,
        bio: bio.trim(),
        avatar_url: avatarUrl,
        security_question: securityQuestion.trim(),
        security_answer: securityAnswer.trim(),
      });

      if (res.success) {
        setStatusMsg({ type: 'success', text: '个人资料保存成功' });
        setTimeout(() => setStatusMsg(null), 2500);
      } else {
        setStatusMsg({ type: 'error', text: res.message || '保存失败' });
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err?.message || '保存失败' });
    } finally {
      setSaving(false);
    }
  };

  // 切换 PIN 码保护
  const handleTogglePin = async () => {
    if (pinEnabled) {
      await disablePinCode();
      setPinEnabled(false);
      setCurrentPin(null);
      setStatusMsg({ type: 'success', text: '已停用 PIN 码安全保护' });
    } else {
      setShowPinSetupModal(true);
    }
  };

  // 切换生物识别
  const handleToggleBiometric = async () => {
    const nextState = !biometricEnabled;
    await setBiometricEnabled(nextState);
    setBiometricEnabledState(nextState);
    setStatusMsg({
      type: 'success',
      text: nextState ? `已开启${biometryType}快捷登录` : `已关闭${biometryType}快捷登录`,
    });
  };

  // 退出登录逻辑
  const handleConfirmLogout = async (keepLocalData: boolean) => {
    try {
      setLoggingOut(true);
      if (!keepLocalData) {
        // 清除所有本地数据
        await clearAllLocalData();
      }
      // 退出 Supabase Session
      await supabase.auth.signOut();
      setLogoutModalVisible(false);
      router.replace('/login' as any);
    } catch (err) {
      console.error(err);
      router.replace('/login' as any);
    } finally {
      setLoggingOut(false);
    }
  };

  const isAdmin = profile?.role === 'admin' || session?.user?.email?.includes('admin');

  return (
    <SafeAreaView edges={['top']} className="flex-1" style={{ backgroundColor: colors.bg }}>
      {/* 顶部栏 */}
      <View
        className="px-4 py-3 flex-row items-center justify-between border-b"
        style={{ backgroundColor: colors.cardBg, borderColor: colors.cardBorder }}
      >
        <View className="flex-row items-center">
          <Pressable onPress={() => router.back()} className="p-1 -ml-1 mr-2 active:opacity-60">
            <ChevronLeft size={24} color={colors.textPrimary} />
          </Pressable>
          <Text className="text-base font-bold" style={{ color: colors.textPrimary }}>
            个人中心
          </Text>
        </View>

        {isAdmin && (
          <Pressable
            onPress={() => router.push('/admin' as any)}
            className="flex-row items-center px-3 py-1.5 rounded-full border active:opacity-70"
            style={{ backgroundColor: colors.accentBg, borderColor: colors.accent }}
          >
            <ShieldCheck size={14} color={colors.accent} />
            <Text className="text-xs font-bold ml-1" style={{ color: colors.accent }}>
              管理后台
            </Text>
          </Pressable>
        )}
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.accent} />
          <Text className="text-xs mt-3" style={{ color: colors.textMuted }}>
            正在加载读者资料...
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* 用户基础信息与统计卡片 */}
          <View
            className="p-5 rounded-3xl border shadow-sm mb-4"
            style={{ backgroundColor: colors.cardBg, borderColor: colors.cardBorder }}
          >
            <View className="flex-row items-center mb-4">
              <View className="relative">
                <Image
                  source={{ uri: avatarUrl || DEFAULT_AVATARS[0] }}
                  className="w-16 h-16 rounded-full"
                  contentFit="cover"
                />
                <Pressable
                  onPress={handlePickAvatar}
                  className="absolute right-0 bottom-0 p-1.5 rounded-full shadow border active:opacity-75"
                  style={{ backgroundColor: colors.accent, borderColor: colors.cardBg }}
                >
                  <Camera size={12} color="#FFFFFF" />
                </Pressable>
              </View>

              <View className="flex-1 ml-4">
                <View className="flex-row items-center">
                  <Text className="text-lg font-bold" style={{ color: colors.textPrimary }}>
                    {nickname || profile?.username || '墨思读者'}
                  </Text>
                  {isAdmin && (
                    <View
                      className="ml-2 px-2 py-0.5 rounded-md"
                      style={{ backgroundColor: colors.accentBg }}
                    >
                      <Text className="text-[10px] font-bold" style={{ color: colors.accent }}>
                        创作者
                      </Text>
                    </View>
                  )}
                </View>
                <Text className="text-xs mt-0.5 font-mono" style={{ color: colors.textMuted }}>
                  @{profile?.username || 'user'}
                </Text>
                <Text numberOfLines={1} className="text-xs mt-1" style={{ color: colors.textSecondary }}>
                  {bio || '暂无个性签名，且思且行'}
                </Text>
              </View>
            </View>

            {/* 默认头像快捷选择 */}
            <View className="pt-2 border-t" style={{ borderColor: colors.cardBorder }}>
              <Text className="text-[11px] mb-2 font-medium" style={{ color: colors.textMuted }}>
                或从预设头像中挑选：
              </Text>
              <View className="flex-row gap-2.5">
                {DEFAULT_AVATARS.map((url, idx) => (
                  <Pressable
                    key={idx}
                    onPress={() => setAvatarUrl(url)}
                    className="rounded-full p-0.5 border-2 active:opacity-75"
                    style={{
                      borderColor: avatarUrl === url ? colors.accent : 'transparent',
                    }}
                  >
                    <Image source={{ uri: url }} className="w-9 h-9 rounded-full" contentFit="cover" />
                  </Pressable>
                ))}
              </View>
            </View>

            {/* 统计指标 */}
            <View
              className="flex-row mt-4 pt-3 border-t justify-around"
              style={{ borderColor: colors.cardBorder }}
            >
              <View className="items-center">
                <View className="flex-row items-center">
                  <BookOpen size={13} color={colors.accent} />
                  <Text className="text-base font-bold ml-1" style={{ color: colors.textPrimary }}>
                    {journalsCount}
                  </Text>
                </View>
                <Text className="text-[11px] mt-0.5" style={{ color: colors.textMuted }}>
                  收录日志
                </Text>
              </View>

              <View className="w-[1px] h-7 self-center" style={{ backgroundColor: colors.cardBorder }} />

              <View className="items-center">
                <View className="flex-row items-center">
                  <MessageSquare size={13} color={colors.accent} />
                  <Text className="text-base font-bold ml-1" style={{ color: colors.textPrimary }}>
                    {commentsCount}
                  </Text>
                </View>
                <Text className="text-[11px] mt-0.5" style={{ color: colors.textMuted }}>
                  累计评论
                </Text>
              </View>

              <View className="w-[1px] h-7 self-center" style={{ backgroundColor: colors.cardBorder }} />

              <View className="items-center">
                <View className="flex-row items-center">
                  <Calendar size={13} color={colors.accent} />
                  <Text className="text-xs font-bold ml-1" style={{ color: colors.textPrimary }}>
                    {profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : '近期'}
                  </Text>
                </View>
                <Text className="text-[11px] mt-0.5" style={{ color: colors.textMuted }}>
                  注册时间
                </Text>
              </View>
            </View>
          </View>

          {/* 编辑资料表单 */}
          <View
            className="p-5 rounded-3xl border shadow-sm mb-4"
            style={{ backgroundColor: colors.cardBg, borderColor: colors.cardBorder }}
          >
            <View className="flex-row items-center mb-4">
              <User size={18} color={colors.accent} />
              <Text className="text-sm font-bold ml-2" style={{ color: colors.textPrimary }}>
                编辑个人信息
              </Text>
            </View>

            <View className="gap-3.5">
              {/* 昵称 */}
              <View>
                <Text className="text-xs font-semibold mb-1" style={{ color: colors.textSecondary }}>
                  昵称 (2-20字)
                </Text>
                <TextInput
                  value={nickname}
                  onChangeText={setNickname}
                  placeholder="请输入您的笔名或昵称"
                  placeholderTextColor={colors.textMuted}
                  className="px-3 py-2.5 rounded-xl border text-sm"
                  style={{ backgroundColor: colors.bg, borderColor: colors.cardBorder, color: colors.textPrimary }}
                />
              </View>

              {/* 真实姓名 */}
              <View>
                <Text className="text-xs font-semibold mb-1" style={{ color: colors.textSecondary }}>
                  真实姓名 (选填)
                </Text>
                <TextInput
                  value={realName}
                  onChangeText={setRealName}
                  placeholder="仅用于私密归档"
                  placeholderTextColor={colors.textMuted}
                  className="px-3 py-2.5 rounded-xl border text-sm"
                  style={{ backgroundColor: colors.bg, borderColor: colors.cardBorder, color: colors.textPrimary }}
                />
              </View>

              {/* 性别 */}
              <View>
                <Text className="text-xs font-semibold mb-1.5" style={{ color: colors.textSecondary }}>
                  性别
                </Text>
                <View className="flex-row gap-2">
                  {[
                    { key: 'male', label: '男' },
                    { key: 'female', label: '女' },
                    { key: 'secret', label: '保密' },
                  ].map((g) => (
                    <Pressable
                      key={g.key}
                      onPress={() => setGender(g.key as any)}
                      className="flex-1 py-2 rounded-xl border items-center justify-center active:opacity-75"
                      style={{
                        backgroundColor: gender === g.key ? colors.accentBg : colors.bg,
                        borderColor: gender === g.key ? colors.accent : colors.cardBorder,
                      }}
                    >
                      <Text
                        className="text-xs font-semibold"
                        style={{ color: gender === g.key ? colors.accent : colors.textSecondary }}
                      >
                        {g.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* 个性签名 */}
              <View>
                <View className="flex-row items-center justify-between mb-1">
                  <Text className="text-xs font-semibold" style={{ color: colors.textSecondary }}>
                    个性签名 (0-100字)
                  </Text>
                  <Text className="text-[10px]" style={{ color: colors.textMuted }}>
                    {bio.length}/100
                  </Text>
                </View>
                <TextInput
                  value={bio}
                  onChangeText={setBio}
                  maxLength={100}
                  multiline
                  placeholder="写一句关乎生活、思考或灵魂的寄语..."
                  placeholderTextColor={colors.textMuted}
                  className="px-3 py-2.5 rounded-xl border text-sm h-18"
                  style={{ backgroundColor: colors.bg, borderColor: colors.cardBorder, color: colors.textPrimary }}
                />
              </View>

              {/* 保存按钮 */}
              <Pressable
                onPress={handleSaveProfile}
                disabled={saving}
                className="py-3 rounded-2xl items-center justify-center flex-row active:opacity-85 shadow mt-2"
                style={{ backgroundColor: colors.accent }}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Save size={15} color="#FFFFFF" />
                    <Text className="text-xs font-bold text-white ml-1.5">保存个人信息修改</Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>

          {/* 账号安全增强配置卡片 */}
          <View
            className="p-5 rounded-3xl border shadow-sm mb-4"
            style={{ backgroundColor: colors.cardBg, borderColor: colors.cardBorder }}
          >
            <View className="flex-row items-center mb-3">
              <Shield size={18} color={colors.accent} />
              <Text className="text-sm font-bold ml-2" style={{ color: colors.textPrimary }}>
                账号安全与验证保护
              </Text>
            </View>

            <View className="gap-3">
              {/* PIN 码保护 */}
              <View
                className="p-3.5 rounded-2xl border flex-row items-center justify-between"
                style={{ backgroundColor: colors.bg, borderColor: colors.cardBorder }}
              >
                <View className="flex-1 mr-3">
                  <View className="flex-row items-center">
                    <Key size={14} color={colors.accent} />
                    <Text className="text-xs font-bold ml-1.5" style={{ color: colors.textPrimary }}>
                      4-6 位数字 PIN 码保护
                    </Text>
                  </View>
                  <Text className="text-[11px] mt-1" style={{ color: colors.textMuted }}>
                    {pinEnabled ? '已启用：切后台重回时需验证 PIN 码' : '未开启：建议启用以防他人翻阅思辨日记'}
                  </Text>
                </View>

                <Pressable
                  onPress={handleTogglePin}
                  className="px-3 py-1.5 rounded-xl border active:opacity-75"
                  style={{
                    backgroundColor: pinEnabled ? '#FEE2E2' : colors.accentBg,
                    borderColor: pinEnabled ? '#EF4444' : colors.accent,
                  }}
                >
                  <Text
                    className="text-xs font-bold"
                    style={{ color: pinEnabled ? '#DC2626' : colors.accent }}
                  >
                    {pinEnabled ? '停用' : '启用'}
                  </Text>
                </Pressable>
              </View>

              {/* 生物识别快捷登录 */}
              {biometricAvailable && (
                <View
                  className="p-3.5 rounded-2xl border flex-row items-center justify-between"
                  style={{ backgroundColor: colors.bg, borderColor: colors.cardBorder }}
                >
                  <View className="flex-1 mr-3">
                    <View className="flex-row items-center">
                      <Fingerprint size={14} color={colors.accent} />
                      <Text className="text-xs font-bold ml-1.5" style={{ color: colors.textPrimary }}>
                        {biometryType}登录
                      </Text>
                    </View>
                    <Text className="text-[11px] mt-1" style={{ color: colors.textMuted }}>
                      {biometricEnabled ? '已启用：登录页面优先使用生物识别验证' : '未开启：使用设备硬件快速完成认证'}
                    </Text>
                  </View>

                  <Pressable
                    onPress={handleToggleBiometric}
                    className="px-3 py-1.5 rounded-xl border active:opacity-75"
                    style={{
                      backgroundColor: biometricEnabled ? '#FEE2E2' : colors.accentBg,
                      borderColor: biometricEnabled ? '#EF4444' : colors.accent,
                    }}
                  >
                    <Text
                      className="text-xs font-bold"
                      style={{ color: biometricEnabled ? '#DC2626' : colors.accent }}
                    >
                      {biometricEnabled ? '关闭' : '开启'}
                    </Text>
                  </Pressable>
                </View>
              )}

              {/* 备用安全问题 */}
              <View
                className="p-3.5 rounded-2xl border"
                style={{ backgroundColor: colors.bg, borderColor: colors.cardBorder }}
              >
                <View className="flex-row items-center mb-2">
                  <HelpCircle size={14} color={colors.accent} />
                  <Text className="text-xs font-bold ml-1.5" style={{ color: colors.textPrimary }}>
                    备用安全问题配置
                  </Text>
                </View>
                <TextInput
                  value={securityQuestion}
                  onChangeText={setSecurityQuestion}
                  placeholder="安全问题 (例如: 我最喜爱的哲学格言)"
                  placeholderTextColor={colors.textMuted}
                  className="px-3 py-2 rounded-xl border text-xs mb-2"
                  style={{ backgroundColor: colors.cardBg, borderColor: colors.cardBorder, color: colors.textPrimary }}
                />
                <TextInput
                  value={securityAnswer}
                  onChangeText={setSecurityAnswer}
                  placeholder="问题答案 (选填)"
                  placeholderTextColor={colors.textMuted}
                  className="px-3 py-2 rounded-xl border text-xs"
                  style={{ backgroundColor: colors.cardBg, borderColor: colors.cardBorder, color: colors.textPrimary }}
                />
              </View>
            </View>
          </View>

          {/* 反馈状态消息 */}
          {statusMsg && (
            <View
              className="flex-row items-center p-3 rounded-2xl border mb-4"
              style={{
                backgroundColor: statusMsg.type === 'success' ? '#ECFDF5' : '#FEF2F2',
                borderColor: statusMsg.type === 'success' ? '#10B981' : '#EF4444',
              }}
            >
              {statusMsg.type === 'success' ? (
                <Check size={16} color="#10B981" />
              ) : (
                <AlertCircle size={16} color="#EF4444" />
              )}
              <Text
                className="text-xs ml-2 font-medium flex-1"
                style={{ color: statusMsg.type === 'success' ? '#047857' : '#B91C1C' }}
              >
                {statusMsg.text}
              </Text>
            </View>
          )}

          {/* 退出登录按钮 */}
          <Pressable
            onPress={() => setLogoutModalVisible(true)}
            className="py-3.5 rounded-2xl border flex-row items-center justify-center active:opacity-75"
            style={{ backgroundColor: colors.cardBg, borderColor: '#EF4444' }}
          >
            <LogOut size={16} color="#EF4444" />
            <Text className="text-xs font-bold text-red-500 ml-2">退出登录</Text>
          </Pressable>
        </ScrollView>
      )}

      {/* PIN 码录入弹窗 */}
      {showPinSetupModal && (
        <PinKeypadModal
          visible={showPinSetupModal}
          title="设置 4 位安全 PIN 码"
          subtitle="应用切出重回时将需要验证此 PIN 码"
          pinLength={4}
          allowCancel
          onCancel={() => setShowPinSetupModal(false)}
          onSuccess={async (enteredPin) => {
            await savePinCode(enteredPin);
            setPinEnabled(true);
            setCurrentPin(enteredPin);
            setShowPinSetupModal(false);
            setStatusMsg({ type: 'success', text: 'PIN 码设置成功并已开启保护' });
          }}
        />
      )}

      {/* 退出登录选项弹窗（是否保留本地数据） */}
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
                确认退出登录
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
                  onPress={() => handleConfirmLogout(true)}
                  className="py-3 rounded-xl items-center justify-center active:opacity-85 shadow"
                  style={{ backgroundColor: colors.accent }}
                >
                  <Text className="text-xs font-bold text-white">是，保留本地备份数据</Text>
                </Pressable>

                <Pressable
                  onPress={() => handleConfirmLogout(false)}
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
