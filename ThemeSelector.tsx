import React, { useState } from 'react';
import { View, Text, Pressable, Modal } from 'react-native';
import { useTheme, THEMES, ThemeKey } from '@/context/ThemeContext';
import { Palette, Check, X } from 'lucide-react-native';

export const ThemeSelector: React.FC = () => {
  const { themeKey, setThemeKey, colors } = useTheme();
  const [modalVisible, setModalVisible] = useState(false);

  const themeList: { key: ThemeKey; name: string; preview: string; isDark: boolean }[] = [
    { key: 'warm_book', name: '暖色书卷', preview: '#F5F2EB', isDark: false },
    { key: 'blue_ocean', name: '蓝色海洋', preview: '#EDF5FB', isDark: false },
    { key: 'green_forest', name: '绿色森林', preview: '#EEF6F2', isDark: false },
    { key: 'sunset', name: '渐变晚霞', preview: '#FAF0ED', isDark: false },
    { key: 'dark_minimal', name: '暗黑极简', preview: '#181A1F', isDark: true },
    { key: 'system', name: '跟随系统', preview: '#E2E4E8', isDark: false },
  ];

  return (
    <>
      <Pressable
        onPress={() => setModalVisible(true)}
        className="flex-row items-center px-3 py-1.5 rounded-full border active:opacity-70"
        style={{
          borderColor: colors.cardBorder,
          backgroundColor: colors.cardBg,
        }}
      >
        <Palette size={16} color={colors.accent} />
        <Text className="ml-1.5 text-xs font-medium" style={{ color: colors.textPrimary }}>
          {THEMES[themeKey]?.name || '主题'}
        </Text>
      </Pressable>

      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <Pressable
          className="flex-1 justify-center items-center bg-black/40 px-6"
          onPress={() => setModalVisible(false)}
        >
          <Pressable
            className="w-full max-w-sm rounded-2xl p-5 shadow-xl"
            style={{
              backgroundColor: colors.cardBg,
              borderColor: colors.cardBorder,
              borderWidth: 1,
            }}
            onPress={(e) => e.stopPropagation()}
          >
            <View className="flex-row items-center justify-between pb-4 border-b" style={{ borderColor: colors.cardBorder }}>
              <View className="flex-row items-center">
                <Palette size={18} color={colors.accent} />
                <Text className="text-base font-bold ml-2" style={{ color: colors.textPrimary }}>
                  选择伴读主题
                </Text>
              </View>
              <Pressable onPress={() => setModalVisible(false)} className="p-1">
                <X size={18} color={colors.textMuted} />
              </Pressable>
            </View>

            <View className="py-3 gap-2">
              {themeList.map((item) => {
                const isSelected = themeKey === item.key;
                return (
                  <Pressable
                    key={item.key}
                    onPress={() => {
                      setThemeKey(item.key);
                      setModalVisible(false);
                    }}
                    className="flex-row items-center justify-between p-3 rounded-xl border active:opacity-80"
                    style={{
                      borderColor: isSelected ? colors.accent : colors.cardBorder,
                      backgroundColor: isSelected ? colors.accentBg : colors.bg,
                    }}
                  >
                    <View className="flex-row items-center">
                      <View
                        className="w-6 h-6 rounded-full border mr-3 items-center justify-center"
                        style={{
                          backgroundColor: item.preview,
                          borderColor: colors.cardBorder,
                        }}
                      />
                      <Text
                        className="text-sm font-medium"
                        style={{ color: isSelected ? colors.accent : colors.textPrimary }}
                      >
                        {item.name}
                      </Text>
                    </View>
                    {isSelected && <Check size={18} color={colors.accent} />}
                  </Pressable>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
};
