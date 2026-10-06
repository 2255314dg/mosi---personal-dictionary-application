import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, Share } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import { getSharedJournal } from '@/services/api';
import { MarkdownRenderer } from '@/components/MarkdownRenderer';
import { BookOpen, Download, MessageSquare, ShieldCheck } from 'lucide-react-native';

export default function SharedJournalScreen() {
  const { token } = useLocalSearchParams<{token:string}>();
  const { colors } = useTheme();
  const router = useRouter();
  const [journal,setJournal]=useState<any>(null); const [loading,setLoading]=useState(true);
  useEffect(()=>{(async()=>{setJournal(await getSharedJournal(String(token||'')));setLoading(false)})()},[token]);
  if(loading)return <SafeAreaView className="flex-1 items-center justify-center" style={{backgroundColor:colors.bg}}><ActivityIndicator color={colors.accent}/></SafeAreaView>;
  if(!journal)return <SafeAreaView className="flex-1 items-center justify-center px-8" style={{backgroundColor:colors.bg}}><Text className="text-xl font-bold" style={{color:colors.textPrimary}}>这份墨思分享已失效</Text><Text className="text-xs text-center mt-3" style={{color:colors.textMuted}}>链接可能已过期、被撤销，或不存在。</Text></SafeAreaView>;
  return <SafeAreaView className="flex-1" style={{backgroundColor:colors.bg}}>
    <View className="px-4 py-3 border-b flex-row items-center justify-between" style={{backgroundColor:colors.cardBg,borderColor:colors.cardBorder}}><View className="flex-row items-center"><View className="w-8 h-8 rounded-lg items-center justify-center mr-2" style={{backgroundColor:colors.accentBg}}><BookOpen size={17} color={colors.accent}/></View><View><Text className="text-sm font-bold" style={{color:colors.textPrimary}}>墨思 · 公开分享</Text><Text className="text-[10px]" style={{color:colors.textMuted}}>只读阅读，不暴露私人数据库</Text></View></View></View>
    <ScrollView contentContainerStyle={{padding:18,paddingBottom:120}}><Text className="text-2xl font-bold leading-relaxed" style={{color:colors.textPrimary}}>{journal.title}</Text><Text className="text-xs mt-2 mb-6" style={{color:colors.textMuted}}>{new Date(journal.created_at).toLocaleDateString()} · {journal.theme_tags?.join(' · ')}</Text><MarkdownRenderer content={journal.content}/>
      <View className="mt-8 p-5 rounded-3xl border" style={{backgroundColor:colors.cardBg,borderColor:colors.cardBorder}}><View className="flex-row items-center"><ShieldCheck size={18} color={colors.accent}/><Text className="text-sm font-bold ml-2" style={{color:colors.textPrimary}}>这是“墨思”的分享副本</Text></View><Text className="text-xs leading-relaxed mt-2" style={{color:colors.textMuted}}>你可以在微信、QQ或浏览器中直接阅读。评论、收藏、版本追踪、深入探索等功能需要安装墨思并登录已授权账号。</Text><Pressable onPress={()=>router.push('/login' as any)} className="mt-4 py-3 rounded-2xl flex-row items-center justify-center" style={{backgroundColor:colors.accent}}><Download size={15} color="#fff"/><Text className="text-xs font-bold text-white ml-1.5">进入墨思深入探索</Text></Pressable></View>
      <Pressable onPress={()=>Share.share({title:`墨思 · ${journal.title}`,message:`《${journal.title}》\n墨思公开分享`})} className="mt-3 py-3 rounded-2xl border flex-row items-center justify-center" style={{backgroundColor:colors.cardBg,borderColor:colors.cardBorder}}><MessageSquare size={15} color={colors.accent}/><Text className="text-xs font-bold ml-1.5" style={{color:colors.accent}}>继续分享</Text></Pressable>
    </ScrollView>
  </SafeAreaView>;
}
