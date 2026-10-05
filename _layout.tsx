import * as Sentry from '@sentry/react-native';
import { Stack } from 'expo-router';
import { PortalHost } from '@rn-primitives/portal';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ActivityIndicator, View, AppState, Platform } from 'react-native';
import React, { useState, useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';

import { SessionProvider, useSession } from '@/ctx';
import { ThemeProvider, useTheme } from '@/context/ThemeContext';
import { AudioPlayerProvider } from '@/context/AudioPlayerContext';
import { PinKeypadModal } from '@/components/PinKeypadModal';
import { getPinStatus } from '@/utils/security';
import "../global.css";

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
});

function RootLayoutNav() {
  const { session, isLoading } = useSession();
  const { colors } = useTheme();

  // PIN 码切后台拦截状态
  const [pinRequired, setPinRequired] = useState(false);
  const [targetPin, setTargetPin] = useState<string | null>(null);
  const appState = useRef(AppState.currentState);

  // 监听 AppState 切后台到前台
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextState) => {
      if (appState.current.match(/inactive|background/) && nextState === 'active') {
        // 切回前台，检查是否启用了 PIN 码
        const status = await getPinStatus();
        if (status.enabled && status.pin && session) {
          setTargetPin(status.pin);
          setPinRequired(true);
        }
      }
      appState.current = nextState;
    });

    return () => {
      subscription.remove();
    };
  }, [session]);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-[#F9F8F6]">
        <ActivityIndicator size="large" color="#B85D3A" />
      </View>
    );
  }

  return (
    <>
      <StatusBar style={colors.isDark ? 'light' : 'dark'} backgroundColor={colors.bg} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="journal/[id]" options={{ presentation: 'card' }} />
        <Stack.Screen name="search-archive" options={{ presentation: 'card' }} />
        <Stack.Screen name="editor" options={{ presentation: 'card' }} />
        <Stack.Screen name="profile" options={{ presentation: 'card' }} />
        <Stack.Screen name="admin" options={{ presentation: 'card' }} />
        <Stack.Screen name="login" options={{ presentation: 'formSheet' }} />
      </Stack>

      {/* 切回前台 PIN 码验证模态框 */}
      {pinRequired && targetPin && (
        <PinKeypadModal
          visible={pinRequired}
          targetPin={targetPin}
          onSuccess={() => {
            setPinRequired(false);
          }}
        />
      )}
    </>
  );
}

const RootLayout: React.FC = () => {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SessionProvider>
        <ThemeProvider>
          <AudioPlayerProvider>
            <RootLayoutNav />
            <PortalHost />
          </AudioPlayerProvider>
        </ThemeProvider>
      </SessionProvider>
    </GestureHandlerRootView>
  );
};

export default Sentry.wrap(RootLayout);
