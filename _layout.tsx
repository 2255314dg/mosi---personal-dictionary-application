import * as Sentry from '@sentry/react-native';
import { Stack } from 'expo-router';
import { PortalHost } from '@rn-primitives/portal';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ActivityIndicator, View, AppState, Text, Pressable } from 'react-native';
import React, { useState, useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SessionProvider, useSession } from '@/ctx';
import { ThemeProvider, useTheme } from '@/context/ThemeContext';
import { AudioPlayerProvider } from '@/context/AudioPlayerContext';
import { PinKeypadModal } from '@/components/PinKeypadModal';
import { GesturePatternModal } from '@/components/GesturePatternModal';
import { getPin, getGesturePattern, getSecurityPolicy, initializeMosiDevice, verifyPinCode, verifyGesturePattern } from '@/utils/security';
import { startAutomaticBackupLoop, stopAutomaticBackupLoop, createLocalBackup } from '@/utils/backup';
import { supabase } from '@/client/supabase';
import '../global.css';

Sentry.init({ dsn: process.env.EXPO_PUBLIC_SENTRY_DSN });

function RootLayoutNav() {
  const { session, isLoading } = useSession();
  const { colors } = useTheme();
  const [pinRequired, setPinRequired] = useState(false);
  const [gestureRequired, setGestureRequired] = useState(false);
  const [targetPin, setTargetPin] = useState<string | null>(null);
  const [targetGesture, setTargetGesture] = useState<number[] | null>(null);
  const [deviceApproved, setDeviceApproved] = useState(true);
  const [deviceMessage, setDeviceMessage] = useState('');
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!session) { setDeviceApproved(true); return; }
      const result = await initializeMosiDevice();
      if (!mounted) return;
      setDeviceApproved(result.approved);
      setDeviceMessage(result.message);
      if (result.approved) await startAutomaticBackupLoop();
    })();
    return () => { mounted = false; stopAutomaticBackupLoop(); };
  }, [session]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextState) => {
      if (nextState === 'background' && session && deviceApproved) { createLocalBackup().catch(()=>undefined); }
      if (appState.current.match(/inactive|background/) && nextState === 'active' && session && deviceApproved) {
        const policy = await getSecurityPolicy();
        if (policy.security_pin_enabled) {
          const pin = await getPin();
          if (pin) { setTargetPin(pin); setPinRequired(true); return; }
        }
        if (policy.security_gesture_enabled) {
          const gesture = await getGesturePattern();
          if (gesture) { setTargetGesture(gesture.split('-').map(Number)); setGestureRequired(true); }
        }
      }
      appState.current = nextState;
    });
    return () => subscription.remove();
  }, [session, deviceApproved]);

  if (isLoading) return <View className="flex-1 items-center justify-center" style={{backgroundColor:colors.bg}}><ActivityIndicator size="large" color={colors.accent}/></View>;

  if (session && !deviceApproved) return <View className="flex-1 items-center justify-center px-8" style={{backgroundColor:colors.bg}}>
    <Text style={{color:colors.textPrimary,fontSize:22,fontWeight:'800'}}>设备尚未授权</Text>
    <Text style={{color:colors.textMuted,fontSize:13,textAlign:'center',marginTop:12,lineHeight:22}}>{deviceMessage || '当前设备没有进入墨思私人数据区的权限。请联系管理员在设备管理中授权。'}</Text>
    <Pressable onPress={()=>supabase.auth.signOut()} style={{marginTop:24,paddingHorizontal:24,paddingVertical:12,borderRadius:14,backgroundColor:colors.accent}}><Text style={{color:'#fff',fontWeight:'700'}}>退出当前账号</Text></Pressable>
  </View>;

  return <>
    <StatusBar style={colors.isDark?'light':'dark'} backgroundColor={colors.bg}/>
    <Stack screenOptions={{headerShown:false,contentStyle:{backgroundColor:colors.bg}}}>
      <Stack.Screen name="index"/><Stack.Screen name="journal/[id]" options={{presentation:'card'}}/><Stack.Screen name="search-archive" options={{presentation:'card'}}/><Stack.Screen name="editor" options={{presentation:'card'}}/><Stack.Screen name="profile" options={{presentation:'card'}}/><Stack.Screen name="admin" options={{presentation:'card'}}/><Stack.Screen name="login" options={{presentation:'formSheet'}}/><Stack.Screen name="share/[token]" options={{presentation:'card'}}/>
    </Stack>

    {pinRequired && targetPin ? <PinKeypadModal visible={pinRequired} targetPin={targetPin} onSuccess={async()=>{setPinRequired(false);setTargetPin(null);const policy=await getSecurityPolicy();if(policy.security_gesture_enabled){const gesture=await getGesturePattern();if(gesture){setTargetGesture(gesture.split('-').map(Number));setGestureRequired(true);}}}} onLockout={async()=>{setPinRequired(false);setTargetPin(null);await supabase.auth.signOut()}}/> : null}
    {gestureRequired && targetGesture ? <GesturePatternModal visible={gestureRequired} mode="verify" targetPattern={targetGesture} onSuccess={()=>{setGestureRequired(false);setTargetGesture(null)}}/> : null}
  </>;
}

export default Sentry.wrap(function RootLayout() {
  return <GestureHandlerRootView style={{flex:1}}><SessionProvider><ThemeProvider><AudioPlayerProvider><RootLayoutNav/><PortalHost/></AudioPlayerProvider></ThemeProvider></SessionProvider></GestureHandlerRootView>;
});
