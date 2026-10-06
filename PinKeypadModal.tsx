import React, { useState } from 'react';
import { View, Text, Pressable, Modal } from 'react-native';
import { Lock, Delete } from 'lucide-react-native';
import { useTheme } from '@/context/ThemeContext';

interface PinKeypadModalProps {
  visible: boolean;
  title?: string;
  subtitle?: string;
  targetPin?: string; // 若传入 targetPin，则进行匹配验证；若未传入，则用于录入/设置PIN
  pinLength?: number;
  onSuccess?: (enteredPin: string) => void;
  onConfirm?: (enteredPin: string) => void;
  onCancel?: () => void;
  onLockout?: () => void;
  allowCancel?: boolean;
}

export const PinKeypadModal: React.FC<PinKeypadModalProps> = ({
  visible,
  title = '请输入PIN码',
  subtitle = '为了保护私密思辨日志，切回前台需验证身份',
  targetPin,
  pinLength = 4,
  onSuccess,
  onConfirm,
  onCancel,
  onLockout,
  allowCancel = false,
}) => {
  const { colors } = useTheme();
  const [pin, setPin] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [failedAttempts, setFailedAttempts] = useState(0);

  const triggerSuccess = (completedPin: string) => {
    if (onConfirm) onConfirm(completedPin);
    if (onSuccess) onSuccess(completedPin);
  };

  const handleKeyPress = (num: string) => {
    if (pin.length >= 6) return;
    const newPin = pin + num;
    setPin(newPin);
    setErrorMsg('');

    // 如果设置了目标长度或比对
    if (targetPin) {
      if (newPin.length === targetPin.length) {
        if (newPin === targetPin) {
          setTimeout(() => {
            setPin('');
            setFailedAttempts(0);
            triggerSuccess(newPin);
          }, 150);
        } else {
          const nextFailures = failedAttempts + 1;
          setFailedAttempts(nextFailures);
          setErrorMsg(nextFailures >= 5 ? 'PIN 连续错误 5 次，已退出当前会话' : `PIN 码错误，还可尝试 ${5 - nextFailures} 次`);
          setTimeout(() => {
            setPin('');
            if (nextFailures >= 5) onLockout?.();
          }, 500);
        }
      }
    } else {
      if (newPin.length === pinLength) {
        setTimeout(() => {
          setPin('');
          triggerSuccess(newPin);
        }, 150);
      }
    }
  };

  const handleDelete = () => {
    if (pin.length > 0) {
      setPin(pin.slice(0, -1));
      setErrorMsg('');
    }
  };

  const currentLength = targetPin ? targetPin.length : pinLength;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View className="flex-1 justify-center items-center bg-black/65 px-6">
        <View
          className="w-full max-w-sm rounded-3xl p-6 shadow-2xl border items-center"
          style={{ backgroundColor: colors.cardBg, borderColor: colors.cardBorder }}
        >
          <View
            className="w-12 h-12 rounded-2xl items-center justify-center mb-3 shadow-sm"
            style={{ backgroundColor: colors.accentBg }}
          >
            <Lock size={24} color={colors.accent} />
          </View>

          <Text className="text-lg font-bold mb-1 text-center" style={{ color: colors.textPrimary }}>
            {title}
          </Text>
          <Text className="text-xs text-center mb-5 leading-relaxed" style={{ color: colors.textMuted }}>
            {subtitle}
          </Text>

          {/* PIN 码圆点指示器 */}
          <View className="flex-row gap-3 mb-4">
            {Array.from({ length: currentLength }).map((_, idx) => {
              const isFilled = idx < pin.length;
              return (
                <View
                  key={idx}
                  className="w-4 h-4 rounded-full border transition-all"
                  style={{
                    backgroundColor: isFilled ? colors.accent : 'transparent',
                    borderColor: isFilled ? colors.accent : colors.cardBorder,
                    transform: [{ scale: isFilled ? 1.15 : 1 }],
                  }}
                />
              );
            })}
          </View>

          {/* 错误提示 */}
          <View className="h-5 mb-4">
            {errorMsg ? (
              <Text className="text-xs text-red-500 font-semibold text-center">{errorMsg}</Text>
            ) : null}
          </View>

          {/* 自定义 3x4 数字键盘（1-9、删除、0、确认/取消） */}
          <View className="w-full max-w-[260px] gap-3 mb-3">
            {[
              ['1', '2', '3'],
              ['4', '5', '6'],
              ['7', '8', '9'],
              ['delete', '0', 'confirm_or_cancel'],
            ].map((row, rIdx) => (
              <View key={rIdx} className="flex-row justify-between">
                {row.map((item, cIdx) => {
                  if (item === 'confirm_or_cancel') {
                    return (
                      <Pressable
                        key={cIdx}
                        onPress={() => {
                          if (pin.length >= (targetPin ? targetPin.length : pinLength)) {
                            triggerSuccess(pin);
                          } else if (allowCancel && onCancel) {
                            onCancel();
                          }
                        }}
                        className="w-16 h-14 rounded-2xl items-center justify-center border active:opacity-60"
                        style={{
                          backgroundColor: pin.length >= (targetPin ? targetPin.length : pinLength) ? colors.accent : colors.bg,
                          borderColor: pin.length >= (targetPin ? targetPin.length : pinLength) ? colors.accent : colors.cardBorder,
                        }}
                      >
                        <Text
                          className="text-xs font-bold"
                          style={{
                            color: pin.length >= (targetPin ? targetPin.length : pinLength) ? '#FFFFFF' : colors.textSecondary,
                          }}
                        >
                          {pin.length >= (targetPin ? targetPin.length : pinLength) ? '确认' : (allowCancel ? '取消' : '确认')}
                        </Text>
                      </Pressable>
                    );
                  }

                  if (item === 'delete') {
                    return (
                      <Pressable
                        key={cIdx}
                        onPress={handleDelete}
                        className="w-16 h-14 rounded-2xl items-center justify-center border active:opacity-60"
                        style={{ backgroundColor: colors.bg, borderColor: colors.cardBorder }}
                      >
                        <Delete size={20} color={colors.textSecondary} />
                      </Pressable>
                    );
                  }

                  return (
                    <Pressable
                      key={cIdx}
                      onPress={() => handleKeyPress(item)}
                      className="w-16 h-14 rounded-2xl items-center justify-center border shadow-sm active:opacity-75"
                      style={{ backgroundColor: colors.bg, borderColor: colors.cardBorder }}
                    >
                      <Text className="text-xl font-bold" style={{ color: colors.textPrimary }}>
                        {item}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
};
