import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import { supabase } from '@/client/supabase';
import {
  ChevronLeft,
  KeyRound,
  User,
  Lock,
  Ticket,
  Check,
  AlertCircle,
  Info,
  Fingerprint,
  HelpCircle,
} from 'lucide-react-native';
import {
  getRequireInvitationCodeSetting,
  verifyInvitationCode,
  consumeInvitationCode,
} from '@/services/api';
import {
  checkPasswordStrength,
  checkBiometricSupport,
  authenticateWithBiometrics,
  getBiometricEnabled,
  setBiometricEnabled,
  getBiometricCredentials,
} from '@/utils/security';

export default function LoginScreen() {
  const router = useRouter();
  const { colors } = useTheme();

  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [invitationCode, setInvitationCode] = useState('');
  const [requireCode, setRequireCode] = useState(true);

  // 安全问题
  const [securityQuestion, setSecurityQuestion] = useState('我最喜欢的一本书是？');
  const [securityAnswer, setSecurityAnswer] = useState('');

  // 生物识别相关状态
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState('指纹/面容');
  const [showBiometricPromptModal, setShowBiometricPromptModal] = useState(false);
  const [rememberedUser, setRememberedUser] = useState<string>('');

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // 检查系统当前是否开启邀请码注册限制与生物识别支持
  useEffect(() => {
    (async () => {
      const required = await getRequireInvitationCodeSetting();
      setRequireCode(required);

      const support = await checkBiometricSupport();
      if (support.supported && support.enrolled) {
        setBiometricAvailable(true);
        setBiometricType(support.biometryType);

        // 检查是否有已开启的生物识别
        const enabled = await getBiometricEnabled();
        const creds = await getBiometricCredentials();
        if (enabled && creds?.username) {
          setRememberedUser(creds.username);
        }
      }
    })();
  }, []);

  // 生物识别快捷登录
  const handleBiometricLogin = async () => {
    try {
      const creds = await getBiometricCredentials();
      if (!creds || !creds.username) {
        setErrorMsg('请先使用账号密码正常登录一次，并开启生物识别');
        return;
      }

      const success = await authenticateWithBiometrics(`使用${biometricType}验证身份进入墨思`);
      if (success) {
        setLoading(true);
        setErrorMsg('');
        setSuccessMsg(`${biometricType}验证成功，正在登录...`);

        // 使用记住的凭据免密登录
        const email = creds.username.includes('@') ? creds.username.trim() : `${creds.username.trim().toLowerCase()}@mosi.local`;
        if (creds.password) {
          const { error } = await supabase.auth.signInWithPassword({
            email,
            password: creds.password,
          });
          if (error) throw error;
        }

        setTimeout(() => {
          router.replace('/');
        }, 800);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || '生物识别验证失败，请使用密码登录');
    } finally {
      setLoading(false);
    }
  };

  const handleAuth = async () => {
    if (!username.trim() || !password.trim()) {
      setErrorMsg('请填写完整的账号与密码');
      return;
    }

    // 注册模式下的密码强度严格检查
    if (isRegister) {
      const strength = checkPasswordStrength(password.trim());
      if (!strength.valid) {
        setErrorMsg(strength.message);
        return;
      }
    }

    // 注册模式下的邀请码严格校验
    if (isRegister && requireCode) {
      if (!invitationCode.trim()) {
        setErrorMsg('请填写邀请码');
        return;
      }
      const verifyRes = await verifyInvitationCode(invitationCode);
      if (!verifyRes.valid) {
        setErrorMsg(verifyRes.message || '邀请码无效或已被使用');
        return;
      }
    }

    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);

    // 标准化邮箱格式进行 Supabase Auth 认证
    const email = username.includes('@') ? username.trim() : `${username.trim().toLowerCase()}@mosi.local`;

    try {
      if (isRegister) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password: password.trim(),
        });
        if (error) throw error;

        // 创建 profile 记录（包含安全问题）
        if (data.user) {
          const role = username.toLowerCase().includes('admin') ? 'admin' : 'user';
          await supabase.from('profiles').insert({
            id: data.user.id,
            username: username.trim(),
            nickname: username.trim(),
            role,
            security_question: securityQuestion,
            security_answer: securityAnswer.trim() || null,
          });

          // 如果填写了邀请码，核销该邀请码
          if (requireCode && invitationCode.trim()) {
            await consumeInvitationCode(invitationCode.trim(), data.user.id);
          }
        }
        setSuccessMsg('注册成功，正在进入墨思...');

        // 检查是否支持生物识别，询问开启
        if (biometricAvailable) {
          await setBiometricEnabled(true, { username: username.trim(), password: password.trim() });
        }

        setTimeout(() => {
          router.replace('/');
        }, 1200);
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password: password.trim(),
        });
        if (error) throw error;

        // 如果是系统管理员账号或包含 admin
        if (username.toLowerCase().includes('admin') && data.user) {
          await supabase.from('profiles').upsert({
            id: data.user.id,
            username: username.trim(),
            nickname: '墨思创作者',
            role: 'admin',
          });
        }

        // 保存凭据供下次生物识别快速登录
        if (biometricAvailable) {
          await setBiometricEnabled(true, { username: username.trim(), password: password.trim() });
        }

        setSuccessMsg('认证成功，欢迎回归墨思');
        setTimeout(() => {
          router.replace('/');
        }, 1000);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || '认证失败，请检查账号密码');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.bg }}>
      {/* 顶栏 */}
      <View
        className="px-4 py-3 flex-row items-center border-b"
        style={{ backgroundColor: colors.cardBg, borderColor: colors.cardBorder }}
      >
        <Pressable onPress={() => router.back()} className="p-1">
          <ChevronLeft size={24} color={colors.textPrimary} />
        </Pressable>
        <Text className="text-base font-bold ml-2" style={{ color: colors.textPrimary }}>
          {isRegister ? '加入墨思' : '身份认证'}
        </Text>
      </View>

      <KeyboardAvoidingView
        behavior={process.env.EXPO_OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}
          keyboardShouldPersistTaps="handled"
        >
          <View
            className="p-6 rounded-3xl border shadow-lg"
            style={{ backgroundColor: colors.cardBg, borderColor: colors.cardBorder }}
          >
            <View className="items-center mb-6">
              <View
                className="w-14 h-14 rounded-2xl items-center justify-center mb-3"
                style={{ backgroundColor: colors.accentBg }}
              >
                <KeyRound size={28} color={colors.accent} />
              </View>
              <Text className="text-xl font-bold" style={{ color: colors.textPrimary }}>
                {isRegister ? '注册墨思读者账号' : '创作者 / 读者登录'}
              </Text>
            </View>

            {/* 表单输入 */}
            <View className="gap-3.5 mb-5">
              <View
                className="flex-row items-center px-3.5 py-2.5 rounded-xl border"
                style={{ backgroundColor: colors.bg, borderColor: colors.cardBorder }}
              >
                <User size={18} color={colors.textMuted} />
                <TextInput
                  placeholder="用户名 (如: admin 或 笔名)"
                  placeholderTextColor={colors.textMuted}
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  className="flex-1 ml-2.5 text-sm"
                  style={{ color: colors.textPrimary }}
                />
              </View>

              <View
                className="flex-row items-center px-3.5 py-2.5 rounded-xl border"
                style={{ backgroundColor: colors.bg, borderColor: colors.cardBorder }}
              >
                <Lock size={18} color={colors.textMuted} />
                <TextInput
                  placeholder={isRegister ? "密码 (至少8位，含大小写和数字)" : "密码"}
                  placeholderTextColor={colors.textMuted}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  className="flex-1 ml-2.5 text-sm"
                  style={{ color: colors.textPrimary }}
                />
              </View>

              {/* 注册模式下的密码强度即时提示与安全问题 */}
              {isRegister && (
                <>
                  {password.length > 0 && (
                    <View className="px-1 -mt-1">
                      <Text
                        className="text-[11px]"
                        style={{
                          color: checkPasswordStrength(password).valid ? '#10B981' : colors.accent,
                        }}
                      >
                        {checkPasswordStrength(password).valid ? '✓ 密码强度合格' : checkPasswordStrength(password).message}
                      </Text>
                    </View>
                  )}

                  {/* 安全问题作为备用验证 */}
                  <View className="mt-1">
                    <View className="flex-row items-center mb-1.5 px-1">
                      <HelpCircle size={13} color={colors.textMuted} />
                      <Text className="text-xs ml-1.5 font-medium" style={{ color: colors.textSecondary }}>
                        设置安全问题（备用验证）
                      </Text>
                    </View>
                    <View
                      className="px-3.5 py-2.5 rounded-xl border mb-2"
                      style={{ backgroundColor: colors.bg, borderColor: colors.cardBorder }}
                    >
                      <TextInput
                        placeholder="安全问题 (如: 我最喜欢的一本书)"
                        placeholderTextColor={colors.textMuted}
                        value={securityQuestion}
                        onChangeText={setSecurityQuestion}
                        className="text-xs"
                        style={{ color: colors.textPrimary }}
                      />
                    </View>
                    <View
                      className="px-3.5 py-2.5 rounded-xl border"
                      style={{ backgroundColor: colors.bg, borderColor: colors.cardBorder }}
                    >
                      <TextInput
                        placeholder="问题答案 (选填)"
                        placeholderTextColor={colors.textMuted}
                        value={securityAnswer}
                        onChangeText={setSecurityAnswer}
                        className="text-xs"
                        style={{ color: colors.textPrimary }}
                      />
                    </View>
                  </View>
                </>
              )}

              {/* 注册模式下的邀请码输入区 */}
              {isRegister && (
                <View className="mt-1">
                  {requireCode && (
                    <View className="flex-row items-center mb-2 px-1">
                      <Info size={13} color={colors.accent} />
                      <Text className="text-xs ml-1.5 font-medium" style={{ color: colors.accent }}>
                        需要邀请码才能注册，请联系管理员获取
                      </Text>
                    </View>
                  )}
                  <View
                    className="flex-row items-center px-3.5 py-2.5 rounded-xl border"
                    style={{ backgroundColor: colors.bg, borderColor: colors.cardBorder }}
                  >
                    <Ticket size={18} color={colors.textMuted} />
                    <TextInput
                      placeholder={requireCode ? "邀请码 (必填，如 MOSI2026)" : "邀请码 (选填)"}
                      placeholderTextColor={colors.textMuted}
                      value={invitationCode}
                      onChangeText={setInvitationCode}
                      autoCapitalize="characters"
                      className="flex-1 ml-2.5 text-sm font-mono"
                      style={{ color: colors.textPrimary }}
                    />
                  </View>
                </View>
              )}
            </View>

            {/* 状态反馈 */}
            {errorMsg ? (
              <View className="flex-row items-center mb-4 p-2.5 rounded-lg bg-red-50 border border-red-200">
                <AlertCircle size={15} color="#EF4444" />
                <Text className="text-xs text-red-600 ml-1.5 flex-1">{errorMsg}</Text>
              </View>
            ) : null}

            {successMsg ? (
              <View className="flex-row items-center mb-4 p-2.5 rounded-lg bg-emerald-50 border border-emerald-200">
                <Check size={15} color="#10B981" />
                <Text className="text-xs text-emerald-600 ml-1.5 flex-1">{successMsg}</Text>
              </View>
            ) : null}

            {/* 提交按钮 */}
            <Pressable
              onPress={handleAuth}
              disabled={loading}
              className="py-3 rounded-xl items-center justify-center active:opacity-85 shadow mb-3"
              style={{ backgroundColor: colors.accent }}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text className="text-sm font-bold text-white">
                  {isRegister ? '确认注册并进入' : '立即登录'}
                </Text>
              )}
            </Pressable>

            {/* 生物识别登录按钮 */}
            {!isRegister && biometricAvailable && (
              <Pressable
                onPress={handleBiometricLogin}
                disabled={loading}
                className="py-2.5 rounded-xl border flex-row items-center justify-center active:opacity-75 mb-1"
                style={{ backgroundColor: colors.bg, borderColor: colors.cardBorder }}
              >
                <Fingerprint size={18} color={colors.accent} />
                <Text className="text-xs font-semibold ml-2" style={{ color: colors.textPrimary }}>
                  {rememberedUser ? `使用${biometricType}快捷登录 (${rememberedUser})` : `使用${biometricType}快捷登录`}
                </Text>
              </Pressable>
            )}

            {/* 切换登录/注册 */}
            <View className="flex-row items-center justify-center mt-5">
              <Text className="text-xs" style={{ color: colors.textMuted }}>
                {isRegister ? '已有墨思账号？' : '尚未拥有账号？'}
              </Text>
              <Pressable onPress={() => setIsRegister(!isRegister)} className="ml-1.5 p-1">
                <Text className="text-xs font-bold" style={{ color: colors.accent }}>
                  {isRegister ? '切换为登录' : '立即注册'}
                </Text>
              </Pressable>
            </View>

            {/* 提示：墨思空间 */}
            <View className="mt-4 p-3 rounded-xl bg-black/5">
              <Text className="text-[11px] leading-relaxed text-center font-medium" style={{ color: colors.textSecondary }}>
                墨思为私人空间，需邀请码方可访问
              </Text>
              <Text className="text-[10px] leading-relaxed mt-1 text-center" style={{ color: colors.textMuted }}>
                输入用户名包含 admin (如 admin / admin123) 登录或注册即可拥有创作者管理权限。
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
