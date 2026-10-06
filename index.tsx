import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import { useSession } from '@/ctx';
import {
  Journal,
  JournalFilterParams,
  getJournals,
  checkIsAdmin,
} from '@/services/api';
import { ThemeSelector } from '@/components/ThemeSelector';
import {
  TagFilterBar,
} from '@/components/TagFilterBar';
import { TagItem, getTagCatalogDB } from '@/services/api';
import { JournalCard } from '@/components/JournalCard';
import { FloatingAudioPlayer } from '@/components/FloatingAudioPlayer';
import {
  Search,
  PenSquare,
  ShieldCheck,
  User,
  Sparkles,
  BookOpen,
  Compass,
  PlusCircle,
  Home,
  Feather,
  Database,
} from 'lucide-react-native';

export default function HomeScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { session, isLoading: isSessionLoading } = useSession();

  const [journals, setJournals] = useState<Journal[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [filter, setFilter] = useState<JournalFilterParams>({});

  const loadData = useCallback(async (currentFilter: JournalFilterParams) => {
    try {
      const data = await getJournals(currentFilter);
      setJournals(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (session) {
        loadData(filter);
        checkIsAdmin().then((res) => setIsAdmin(res));
      } else {
        setLoading(false);
      }
    }, [filter, loadData, session])
  );

  const handleRefresh = () => {
    if (!session) return;
    setRefreshing(true);
    loadData(filter);
  };

  const handleTagClick = (tag: string) => {
    setFilter((prev) => ({ ...prev, themeTag: tag }));
  };

  // 1. 若会话初始化中，显示优雅加载态
  if (isSessionLoading) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: colors.bg }}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  // 2. 严格访问控制拦截：未登录用户一律显示友好提示页面，拒绝访问任何思辨记述与功能
  if (!session) {
    return (
      <SafeAreaView edges={['top', 'bottom']} className="flex-1" style={{ backgroundColor: colors.bg }}>
        <View className="flex-1 items-center justify-center px-8">
          <View
            className="w-20 h-20 rounded-3xl items-center justify-center mb-6 shadow-sm"
            style={{ backgroundColor: colors.accentBg }}
          >
            <BookOpen size={40} color={colors.accent} />
          </View>

          <Text className="text-2xl font-bold tracking-wider mb-3 text-center" style={{ color: colors.textPrimary }}>
            墨思 - 私人空间
          </Text>

          <View
            className="px-4 py-2.5 rounded-full border mb-6"
            style={{ backgroundColor: colors.cardBg, borderColor: colors.cardBorder }}
          >
            <Text className="text-xs font-medium text-center" style={{ color: colors.textSecondary }}>
              墨思为私人空间，需邀请码方可访问
            </Text>
          </View>

          <Text className="text-xs text-center leading-relaxed mb-8 max-w-[280px]" style={{ color: colors.textMuted }}>
            这里沉淀了关于生命、自由、宿命与艺术的深刻思辨记述。为了保护私密思考氛围，所有访客均需通过有效邀请码注册并登录后方可浏览与研读。
          </Text>

          <View className="w-full max-w-[280px] gap-3">
            <Pressable
              onPress={() => router.push('/login' as any)}
              className="w-full py-3.5 rounded-2xl items-center justify-center shadow active:opacity-85"
              style={{ backgroundColor: colors.accent }}
            >
              <Text className="text-sm font-bold text-white tracking-wide">使用邀请码注册 / 登录</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} className="flex-1" style={{ backgroundColor: colors.bg }}>
      {/* 顶部导航栏 */}
      <View
        className="px-4 py-3 flex-row items-center justify-between border-b"
        style={{
          backgroundColor: colors.cardBg,
          borderColor: colors.cardBorder,
        }}
      >
        <View className="flex-row items-center">
          <View
            className="w-8 h-8 rounded-lg items-center justify-center mr-2.5"
            style={{ backgroundColor: colors.accentBg }}
          >
            <BookOpen size={18} color={colors.accent} />
          </View>
          <View>
            <Text className="text-xl font-bold tracking-wider" style={{ color: colors.textPrimary }}>
              墨思
            </Text>
            <Text className="text-[10px] tracking-widest" style={{ color: colors.textMuted }}>
              用笔墨记录思考
            </Text>
          </View>
        </View>

        {/* 右侧动作区：主题切换器、搜索归档、个人中心/登录 */}
        <View className="flex-row items-center gap-2">
          <ThemeSelector />

          <Pressable
            onPress={() => router.push('/search-archive' as any)}
            className="p-2 rounded-full border active:opacity-70"
            style={{ borderColor: colors.cardBorder, backgroundColor: colors.cardBg }}
          >
            <Search size={16} color={colors.textSecondary} />
          </Pressable>

          <Pressable
            onPress={() => router.push('/thought-database' as any)}
            className="p-2 rounded-full border active:opacity-70"
            style={{ borderColor: colors.cardBorder, backgroundColor: colors.cardBg }}
          >
            <Database size={16} color={colors.textSecondary} />
          </Pressable>

          {/* 管理员或已登录用户专属个人中心入口 */}
          {session ? (
            <Pressable
              onPress={() => router.push('/profile' as any)}
              className="px-2.5 py-1.5 rounded-full border flex-row items-center active:opacity-70"
              style={{ borderColor: colors.accent, backgroundColor: colors.accentBg }}
            >
              <User size={15} color={colors.accent} />
              <Text className="text-xs font-bold ml-1" style={{ color: colors.accent }}>
                我的
              </Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={() => router.push('/login' as any)}
              className="p-2 rounded-full border active:opacity-70"
              style={{ borderColor: colors.cardBorder, backgroundColor: colors.cardBg }}
            >
              <User size={16} color={colors.textSecondary} />
            </Pressable>
          )}
        </View>
      </View>

      {/* 多维标签体系筛选栏 */}
      <TagFilterBar filter={filter} onFilterChange={setFilter} />

      {/* 主体列表 */}
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.accent} />
          <Text className="text-xs mt-3" style={{ color: colors.textMuted }}>
            正沉浸加载思辨卷轴...
          </Text>
        </View>
      ) : (
        <FlatList
          data={journals}
          keyExtractor={(item) => item.id}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={{ padding: 16, paddingBottom: 110 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.accent} />
          }
          ListHeaderComponent={
            <View className="mb-4">
              <View className="flex-row items-center mb-1">
                <Sparkles size={14} color={colors.accent} />
                <Text className="text-xs font-semibold ml-1 uppercase tracking-wider" style={{ color: colors.accent }}>
                  TIMELINE ARCHIVE
                </Text>
              </View>
              <Text className="text-sm" style={{ color: colors.textSecondary }}>
                在不确定性中沉淀反思，共收录 {journals.length} 篇思辨记述
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <JournalCard journal={item} onTagClick={handleTagClick} />
          )}
          ListEmptyComponent={
            <View className="items-center justify-center py-16 px-6">
              <View
                className="w-16 h-16 rounded-2xl items-center justify-center mb-4 shadow-sm"
                style={{ backgroundColor: colors.accentBg }}
              >
                <Feather size={28} color={colors.accent} />
              </View>
              <Text className="text-base font-bold mb-1.5" style={{ color: colors.textPrimary }}>
                {Object.keys(filter).length > 0 ? '暂无匹配的思辨日志' : '墨卷待书 · 静候心语'}
              </Text>
              <Text className="text-xs text-center mb-5 max-w-[260px] leading-relaxed" style={{ color: colors.textMuted }}>
                {Object.keys(filter).length > 0
                  ? '当前所选的多维标签暂无收录内容，您可以尝试重置筛选'
                  : '万籁俱寂，心绪初萌。点击下方「创作」开启属于您的第一篇墨思哲学笔记与深度思辨。'}
              </Text>

              {Object.keys(filter).length > 0 ? (
                <Pressable
                  onPress={() => setFilter({})}
                  className="px-5 py-2.5 rounded-full shadow active:opacity-85"
                  style={{ backgroundColor: colors.accent }}
                >
                  <Text className="text-xs font-semibold text-white">重置所有多维筛选</Text>
                </Pressable>
              ) : (
                <Pressable
                  onPress={() => router.push(isAdmin ? ('/editor' as any) : ('/login' as any))}
                  className="px-5 py-2.5 rounded-full shadow flex-row items-center active:opacity-85"
                  style={{ backgroundColor: colors.accent }}
                >
                  <PenSquare size={14} color="#FFFFFF" />
                  <Text className="text-xs font-semibold text-white ml-1.5">
                    {isAdmin ? '开始首篇创作' : '登录开启私人书写'}
                  </Text>
                </Pressable>
              )}
            </View>
          }
        />
      )}

      {/* 底部悬浮伴读音乐播放器 (位于底栏上方) */}
      <View style={{ bottom: 62 }} className="absolute left-0 right-0 z-20">
        <FloatingAudioPlayer />
      </View>

      {/* 底部导航栏：首页 / 发现归档 / 创作 / 我的 */}
      <View
        className="flex-row items-center justify-around py-2 border-t z-30"
        style={{ backgroundColor: colors.cardBg, borderColor: colors.cardBorder }}
      >
        <Pressable
          onPress={() => {}}
          className="items-center py-1 flex-1 active:opacity-75"
        >
          <Home size={20} color={colors.accent} />
          <Text className="text-[11px] font-bold mt-1" style={{ color: colors.accent }}>
            首页
          </Text>
        </Pressable>

        <Pressable
          onPress={() => router.push('/search-archive' as any)}
          className="items-center py-1 flex-1 active:opacity-75"
        >
          <Compass size={20} color={colors.textSecondary} />
          <Text className="text-[11px] font-medium mt-1" style={{ color: colors.textSecondary }}>
            发现归档
          </Text>
        </Pressable>

        <Pressable
          onPress={() => {
            if (isAdmin) {
              router.push('/editor' as any);
            } else if (session) {
              router.push('/editor' as any);
            } else {
              router.push('/login' as any);
            }
          }}
          className="items-center py-1 flex-1 active:opacity-75"
        >
          <View
            className="w-8 h-8 rounded-full items-center justify-center -mt-2 shadow"
            style={{ backgroundColor: colors.accent }}
          >
            <PlusCircle size={22} color="#FFFFFF" />
          </View>
          <Text className="text-[11px] font-medium mt-0.5" style={{ color: colors.textSecondary }}>
            创作
          </Text>
        </Pressable>

        <Pressable
          onPress={() => {
            if (session) {
              router.push('/profile' as any);
            } else {
              router.push('/login' as any);
            }
          }}
          className="items-center py-1 flex-1 active:opacity-75"
        >
          <User size={20} color={colors.textSecondary} />
          <Text className="text-[11px] font-medium mt-1" style={{ color: colors.textSecondary }}>
            我的
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
