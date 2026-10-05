import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';

export type ThemeKey = 'warm_book' | 'blue_ocean' | 'green_forest' | 'sunset' | 'dark_minimal' | 'system';

export interface ThemeColors {
  id: ThemeKey;
  name: string;
  previewColor: string;
  bg: string;
  cardBg: string;
  cardBorder: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  accentBg: string;
  tagBg: string;
  tagText: string;
  isDark: boolean;
  bgPattern?: string;
}

export const THEMES: Record<ThemeKey, ThemeColors> = {
  warm_book: {
    id: 'warm_book',
    name: '暖色书卷',
    previewColor: '#F5F2EB',
    bg: '#F9F8F6',
    cardBg: '#FFFFFF',
    cardBorder: '#EFECE6',
    textPrimary: '#2C2523',
    textSecondary: '#6B5E59',
    textMuted: '#9E928C',
    accent: '#B85D3A', // 典雅赭红/陶土橙
    accentBg: '#FAF1ED',
    tagBg: '#F3EFEA',
    tagText: '#594C46',
    isDark: false,
  },
  blue_ocean: {
    id: 'blue_ocean',
    name: '蓝色海洋',
    previewColor: '#EDF5FB',
    bg: '#F2F7FA',
    cardBg: '#FFFFFF',
    cardBorder: '#E0EDF5',
    textPrimary: '#1E2D3D',
    textSecondary: '#4A6278',
    textMuted: '#849EAF',
    accent: '#2B6CB0',
    accentBg: '#EBF4FF',
    tagBg: '#E6F0F8',
    tagText: '#2B577E',
    isDark: false,
  },
  green_forest: {
    id: 'green_forest',
    name: '绿色森林',
    previewColor: '#EEF6F2',
    bg: '#F3F8F5',
    cardBg: '#FFFFFF',
    cardBorder: '#DEECE4',
    textPrimary: '#1C3328',
    textSecondary: '#416353',
    textMuted: '#7E9E8F',
    accent: '#2E7D5B',
    accentBg: '#E8F5EE',
    tagBg: '#E6F2EB',
    tagText: '#285842',
    isDark: false,
  },
  sunset: {
    id: 'sunset',
    name: '渐变晚霞',
    previewColor: '#FAF0ED',
    bg: '#FCF5F3',
    cardBg: '#FFFFFF',
    cardBorder: '#F5E4E0',
    textPrimary: '#3A2024',
    textSecondary: '#72474E',
    textMuted: '#A67D84',
    accent: '#C84B5B',
    accentBg: '#FDF0F2',
    tagBg: '#F9E9EC',
    tagText: '#873543',
    isDark: false,
  },
  dark_minimal: {
    id: 'dark_minimal',
    name: '暗黑极简',
    previewColor: '#181A1F',
    bg: '#121418',
    cardBg: '#1C1F26',
    cardBorder: '#2D323E',
    textPrimary: '#E8EAED',
    textSecondary: '#9BA3AF',
    textMuted: '#68707D',
    accent: '#D97746',
    accentBg: '#2D231F',
    tagBg: '#262A33',
    tagText: '#D1D5DB',
    isDark: true,
  },
  system: {
    id: 'system',
    name: '跟随系统',
    previewColor: '#E2E4E8',
    bg: '#F9F8F6',
    cardBg: '#FFFFFF',
    cardBorder: '#EFECE6',
    textPrimary: '#2C2523',
    textSecondary: '#6B5E59',
    textMuted: '#9E928C',
    accent: '#B85D3A',
    accentBg: '#FAF1ED',
    tagBg: '#F3EFEA',
    tagText: '#594C46',
    isDark: false,
  },
};

interface ThemeContextType {
  themeKey: ThemeKey;
  setThemeKey: (key: ThemeKey) => void;
  colors: ThemeColors;
}

const ThemeContext = createContext<ThemeContextType>({
  themeKey: 'warm_book',
  setThemeKey: () => {},
  colors: THEMES.warm_book,
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themeKey, setThemeKeyState] = useState<ThemeKey>('warm_book');
  const systemScheme = useColorScheme();

  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const saved = window.localStorage.getItem('mosi_theme_key');
        if (saved && saved in THEMES) {
          setThemeKeyState(saved as ThemeKey);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  const setThemeKey = (key: ThemeKey) => {
    setThemeKeyState(key);
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('mosi_theme_key', key);
      }
    } catch {
      // ignore
    }
  };

  const getEffectiveColors = (): ThemeColors => {
    if (themeKey === 'system') {
      return systemScheme === 'dark' ? THEMES.dark_minimal : THEMES.warm_book;
    }
    return THEMES[themeKey] || THEMES.warm_book;
  };

  return (
    <ThemeContext.Provider value={{ themeKey, setThemeKey, colors: getEffectiveColors() }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
