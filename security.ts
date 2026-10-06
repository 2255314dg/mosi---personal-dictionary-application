import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';
import { supabase } from '@/client/supabase';

export const PIN_KEY = 'mosi_security_pin_code_v3';
export const GESTURE_KEY = 'mosi_security_gesture_v1';
export const DEVICE_ID_KEY = 'mosi_device_id_v1';
export const BIOMETRIC_ENABLED_KEY = 'mosi_biometric_enabled_v3';

export interface MosiSecurityPolicy {
  security_pin_enabled: boolean;
  security_gesture_enabled: boolean;
  autosave_interval_seconds: number;
  local_backup_interval_seconds: number;
  device_allowlist_enabled: boolean;
  share_link_default_days: number;
}

const DEFAULT_POLICY: MosiSecurityPolicy = {
  security_pin_enabled: true,
  security_gesture_enabled: true,
  autosave_interval_seconds: 30,
  local_backup_interval_seconds: 60,
  device_allowlist_enabled: true,
  share_link_default_days: 30,
};

export async function getSecurityPolicy(): Promise<MosiSecurityPolicy> {
  try {
    const { data, error } = await supabase.rpc('get_mosi_security_policy');
    if (error || !data) return DEFAULT_POLICY;
    return {
      ...DEFAULT_POLICY,
      ...data,
      autosave_interval_seconds: Math.max(30, Number(data.autosave_interval_seconds ?? 30)),
      local_backup_interval_seconds: Math.max(60, Number(data.local_backup_interval_seconds ?? 60)),
      share_link_default_days: Math.max(0, Number(data.share_link_default_days ?? 30)),
    };
  } catch {
    return DEFAULT_POLICY;
  }
}

export async function setSecurityPolicy(key: keyof MosiSecurityPolicy, value: boolean | number): Promise<boolean> {
  const normalized = typeof value === 'number'
    ? (key === 'autosave_interval_seconds' ? Math.max(30, value) : key === 'local_backup_interval_seconds' ? Math.max(60, value) : value)
    : value;
  const { error } = await supabase.rpc('set_mosi_security_policy', { p_key: key, p_value: normalized });
  return !error;
}

export async function getOrCreateDeviceId(): Promise<string> {
  let value = await SecureStore.getItemAsync(DEVICE_ID_KEY);
  if (!value) {
    value = Crypto.randomUUID();
    await SecureStore.setItemAsync(DEVICE_ID_KEY, value, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
  }
  return value;
}

export async function initializeMosiDevice(): Promise<{ deviceId: string; approved: boolean; message: string }> {
  const deviceId = await getOrCreateDeviceId();
  // Supabase PostgREST reads this header from request.headers in RLS functions.
  const client: any = supabase as any;
  if (client.rest?.headers) client.rest.headers['x-mosi-device-id'] = deviceId;
  if (client.realtime?.setHeaders) client.realtime.setHeaders({ 'x-mosi-device-id': deviceId });

  try {
    const { data, error } = await supabase.rpc('register_mosi_device', {
      p_device_id: deviceId,
      p_device_name: `${Platform.OS === 'web' ? 'Web' : Platform.OS === 'ios' ? 'iPhone/iPad' : 'Android'} · 墨思`,
      p_platform: Platform.OS,
      p_app_version: '1.2.0-v4.1',
    });
    if (error) return { deviceId, approved: false, message: '设备已登记，等待管理员授权' };
    const row = Array.isArray(data) ? data[0] : data;
    return { deviceId, approved: Boolean(row?.approved), message: row?.message || '设备状态未知' };
  } catch {
    return { deviceId, approved: false, message: '设备授权服务暂不可用' };
  }
}

export async function getPin(): Promise<string | null> {
  return SecureStore.getItemAsync(PIN_KEY);
}

export async function savePinCode(pin: string): Promise<boolean> {
  if (!/^\d{4,6}$/.test(pin)) return false;
  await SecureStore.setItemAsync(PIN_KEY, pin, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
  return true;
}

export async function disablePinCode(): Promise<void> {
  await SecureStore.deleteItemAsync(PIN_KEY);
}

export async function verifyPinCode(pin: string): Promise<boolean> {
  const stored = await SecureStore.getItemAsync(PIN_KEY);
  return !!stored && stored === pin;
}

export async function getGesturePattern(): Promise<string | null> {
  return SecureStore.getItemAsync(GESTURE_KEY);
}

export async function saveGesturePattern(pattern: number[]): Promise<boolean> {
  const normalized = pattern.join('-');
  if (pattern.length < 4 || new Set(pattern).size !== pattern.length) return false;
  await SecureStore.setItemAsync(GESTURE_KEY, normalized, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
  return true;
}

export async function verifyGesturePattern(pattern: number[]): Promise<boolean> {
  const stored = await SecureStore.getItemAsync(GESTURE_KEY);
  return !!stored && stored === pattern.join('-');
}

export async function clearGesturePattern(): Promise<void> {
  await SecureStore.deleteItemAsync(GESTURE_KEY);
}

export async function getProtectionStatus(): Promise<{ pin: boolean; gesture: boolean }> {
  const [pin, gesture, policy] = await Promise.all([getPin(), getGesturePattern(), getSecurityPolicy()]);
  return {
    pin: Boolean(policy.security_pin_enabled && pin),
    gesture: Boolean(policy.security_gesture_enabled && gesture),
  };
}

export async function getBiometricEnabled(): Promise<boolean> {
  return (await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY)) === 'true';
}

export async function setBiometricEnabled(enabled: boolean): Promise<void> {
  if (enabled) await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, 'true');
  else await SecureStore.deleteItemAsync(BIOMETRIC_ENABLED_KEY);
}

export async function authenticateWithBiometrics(promptMessage = '请验证身份'): Promise<boolean> {
  const compatible = await LocalAuthentication.hasHardwareAsync();
  const enrolled = await LocalAuthentication.isEnrolledAsync();
  if (!compatible || !enrolled) return false;
  const result = await LocalAuthentication.authenticateAsync({ promptMessage, fallbackLabel: '使用设备密码' });
  return result.success;
}

export async function getBiometryType(): Promise<'指纹' | '面容' | '生物识别'> {
  const type = await LocalAuthentication.supportedAuthenticationTypesAsync();
  if (type.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) return '面容';
  if (type.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) return '指纹';
  return '生物识别';
}
