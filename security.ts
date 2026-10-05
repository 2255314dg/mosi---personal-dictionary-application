import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';

export const PIN_KEY = 'mosi_security_pin_code_v1';
export const PIN_ENABLED_KEY = 'mosi_security_pin_enabled_v1';
export const BIOMETRIC_ENABLED_KEY = 'mosi_security_biometric_enabled_v1';
export const BIOMETRIC_USER_CREDENTIALS_KEY = 'mosi_biometric_credentials_v1';

// 密码强度校验：至少8位，包含大写字母、小写字母和数字
export function checkPasswordStrength(password: string): { valid: boolean; message: string } {
  if (password.length < 8) {
    return { valid: false, message: '密码长度至少需8位字符' };
  }
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);

  if (!hasUpperCase || !hasLowerCase || !hasNumber) {
    return { valid: false, message: '密码需同时包含大写字母、小写字母和数字' };
  }

  return { valid: true, message: '密码强度合格' };
}

// 检查设备是否支持生物识别
export async function checkBiometricSupport(): Promise<{
  supported: boolean;
  enrolled: boolean;
  biometryType: string;
}> {
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();

    let typeStr = '指纹/面容';
    if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
      typeStr = '面容识别 (Face ID)';
    } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
      typeStr = '指纹识别';
    }

    return {
      supported: hasHardware,
      enrolled: isEnrolled,
      biometryType: typeStr,
    };
  } catch {
    return { supported: false, enrolled: false, biometryType: '生物识别' };
  }
}

// 触发生物识别验证
export async function authenticateWithBiometrics(promptMessage = '请验证身份以进入墨思'): Promise<boolean> {
  try {
    const support = await checkBiometricSupport();
    if (!support.supported || !support.enrolled) return false;

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      cancelLabel: '取消',
      disableDeviceFallback: false,
    });

    return result.success;
  } catch (err) {
    console.error('authenticateWithBiometrics error:', err);
    return false;
  }
}

// 获取生物识别开关状态
export async function getBiometricEnabled(): Promise<boolean> {
  const val = await AsyncStorage.getItem(BIOMETRIC_ENABLED_KEY);
  return val === 'true';
}

// 设置生物识别开关
export async function setBiometricEnabled(enabled: boolean, credentials?: { username: string; password?: string }): Promise<void> {
  await AsyncStorage.setItem(BIOMETRIC_ENABLED_KEY, enabled ? 'true' : 'false');
  if (enabled && credentials) {
    await AsyncStorage.setItem(BIOMETRIC_USER_CREDENTIALS_KEY, JSON.stringify(credentials));
  } else if (!enabled) {
    await AsyncStorage.removeItem(BIOMETRIC_USER_CREDENTIALS_KEY);
  }
}

// 获取存储的生物识别免密凭据
export async function getBiometricCredentials(): Promise<{ username: string; password?: string } | null> {
  try {
    const raw = await AsyncStorage.getItem(BIOMETRIC_USER_CREDENTIALS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// 获取 PIN 码设置状态
export async function getPinStatus(): Promise<{ enabled: boolean; pin: string | null }> {
  const enabledVal = await AsyncStorage.getItem(PIN_ENABLED_KEY);
  const pin = await AsyncStorage.getItem(PIN_KEY);
  return {
    enabled: enabledVal === 'true' && !!pin,
    pin,
  };
}

// 设置 / 开启 PIN 码
export async function savePinCode(pin: string): Promise<boolean> {
  if (pin.length < 4 || pin.length > 6) return false;
  await AsyncStorage.setItem(PIN_KEY, pin);
  await AsyncStorage.setItem(PIN_ENABLED_KEY, 'true');
  return true;
}

// 关闭 PIN 码
export async function disablePinCode(): Promise<void> {
  await AsyncStorage.setItem(PIN_ENABLED_KEY, 'false');
  await AsyncStorage.removeItem(PIN_KEY);
}

// 校验 PIN 码
export async function verifyPinCode(pin: string): Promise<boolean> {
  const stored = await AsyncStorage.getItem(PIN_KEY);
  return stored === pin;
}

// 检查是否设置了 PIN 码
export async function hasPinCode(): Promise<boolean> {
  const { enabled, pin } = await getPinStatus();
  return enabled && !!pin;
}

// 开启生物识别
export async function enableBiometric(credentials?: { username: string; password?: string }): Promise<boolean> {
  await setBiometricEnabled(true, credentials);
  return true;
}

// 检查生物识别是否开启
export async function isBiometricEnabled(): Promise<boolean> {
  return await getBiometricEnabled();
}
