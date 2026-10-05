import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import { Journal, getJournals, getJournalDisplayTitle, getJournalSummary } from '@/services/api';
import { FloatingAudioPlayer } from '@/components/FloatingAudioPlayer';
import {
  Search,
  ChevronLeft,
  Calendar,
  Archive,
  ChevronDown,
  ChevronRight,
  Sparkles,
  BookOpen,
} from 'lucide-react-native';

export default function SearchArchiveScreen() {
  const router = useRouter();
  const { colors } = useTheme();

  const [activeTab, setActiveTab] = useState<'search' | 'archive'>('search');
  const [keyword, setKeyword] = useState('');
  const [allJournals, setAllJournals] = useState<Journal[]>([]);
  const [searchResults, setSearchResults] = useState<Journal[]>([]);
  const [loading, setLoading] = useState(true);

  // 年月归档分组状态: { "2026": { "09": [Journal, ...], "08": [...] } }
  const [archiveMap, setArchiveMap] = useState<Record<string, Record<string, Journal[]>>>({});
  const [expandedYears, setExpandedYears] = useState<Record<string, boolean>>({});

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const list = await getJournals();
        setAllJournals(list);
        setSearchResults(list);

        // 构建归档分组
        const map: Record<string, Record<string, Journal[]>> = {};
        list.forEach((j) => {
          const d = new Date(j.created_at);
          const y = String(d.getFullYear());
          const m = String(d.getMonth() + 1).padStart(2, '0');
          if (!map[y]) map[y] = {};
          if (!map[y][m]) map[y][m] = [];
          map[y][m].push(j);
        });
        setArchiveMap(map);

        // 默认展开所有年份
        const exp: Record<string, boolean> = {};
        Object.keys(map).forEach((y) => {
          exp[y] = true;
        });
        setExpandedYears(exp);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // 搜索过滤与高亮
  const handleSearch = (text: string) => {
    setKeyword(text);
    if (!text.trim()) {
      setSearchResults(allJournals);
      return;
    }
    const kw = text.toLowerCase().trim();
    const filtered = allJournals.filter(
      (j) => j.title.toLowerCase().includes(kw) || j.content.toLowerCase().includes(kw)
    );
    setSearchResults(filtered);
  };

  const toggleYear = (y: string) => {
    setExpandedYears((prev) => ({ ...prev, [y]: !prev[y] }));
  };

  // 高亮显示检索词的纯文本段落
  const renderHighlightedText = (text: string, kw: string) => {
    if (!kw.trim()) return <Text style={{ color: colors.textSecondary }}>{text}</Text>;
    const parts = text.split(new RegExp(`(${kw})`, 'gi'));
    return (
      <Text style={{ color: colors.textSecondary }}>
        {parts.map((part, idx) =>
          part.toLowerCase() === kw.toLowerCase() ? (
            <Text key={idx} style={{ color: colors.accent, fontWeight: 'bold' }}>
              {part}
            </Text>
          ) : (
            part
          )
        )}
      </Text>
    );
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1" style={{ backgroundColor: colors.bg }}>
      {/* 顶栏 */}
      <View
        className="px-4 py-3 flex-row items-center justify-between border-b"
        style={{ backgroundColor: colors.cardBg, borderColor: colors.cardBorder }}
      >
        <Pressable
          onPress={() => router.back()}
          className="flex-row items-center p-1 rounded-lg active:opacity-70"
        >
          <ChevronLeft size={22} color={colors.textPrimary} />
          <Text className="text-sm font-medium ml-1" style={{ color: colors.textPrimary }}>
            返回
          </Text>
        </Pressable>

        {/* 顶部 Tab 切换：全文检索 / 年月归档 */}
        <View className="flex-row rounded-full p-1 border" style={{ backgroundColor: colors.bg, borderColor: colors.cardBorder }}>
          <Pressable
            onPress={() => setActiveTab('search')}
            className="px-4 py-1.5 rounded-full"
            style={{ backgroundColor: activeTab === 'search' ? colors.accent : 'transparent' }}
          >
            <Text
              className="text-xs font-semibold"
              style={{ color: activeTab === 'search' ? '#FFFFFF' : colors.textSecondary }}
            >
              全文搜索
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setActiveTab('archive')}
            className="px-4 py-1.5 rounded-full"
            style={{ backgroundColor: activeTab === 'archive' ? colors.accent : 'transparent' }}
          >
            <Text
              className="text-xs font-semibold"
              style={{ color: activeTab === 'archive' ? '#FFFFFF' : colors.textSecondary }}
            >
              年月归档
            </Text>
          </Pressable>
        </View>

        <View className="w-8" />
      </View>

      {/* 搜索模式视图 */}
      {activeTab === 'search' && (
        <View className="flex-1">
          <View className="p-4 border-b" style={{ backgroundColor: colors.cardBg, borderColor: colors.cardBorder }}>
            <View
              className="flex-row items-center px-3 py-2 rounded-xl border"
              style={{ backgroundColor: colors.bg, borderColor: colors.cardBorder }}
            >
              <Search size={18} color={colors.textMuted} />
              <TextInput
                placeholder="搜索篇目、思辨正文或哲思关键词..."
                placeholderTextColor={colors.textMuted}
                value={keyword}
                onChangeText={handleSearch}
                className="flex-1 ml-2 text-sm"
                style={{ color: colors.textPrimary }}
              />
            </View>
          </View>

          {loading ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator size="small" color={colors.accent} />
            </View>
          ) : (
            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 110 }}>
              <Text className="text-xs font-medium mb-3" style={{ color: colors.textMuted }}>
                共检索到 {searchResults.length} 篇思辨内容
              </Text>

              {searchResults.length === 0 ? (
                <View className="items-center justify-center py-16">
                  <BookOpen size={32} color={colors.textMuted} />
                  <Text className="text-sm mt-3" style={{ color: colors.textMuted }}>
                    未找到包含关键词的思辨记录
                  </Text>
                </View>
              ) : (
                searchResults.map((j) => {
                  const title = getJournalDisplayTitle(j);
                  const summary = getJournalSummary(j.content, 120);
                  return (
                    <Pressable
                      key={j.id}
                      onPress={() => router.push(`/journal/${j.id}` as any)}
                      className="p-4 rounded-xl border mb-3 active:opacity-80"
                      style={{ backgroundColor: colors.cardBg, borderColor: colors.cardBorder }}
                    >
                      <View className="flex-row items-center justify-between mb-1">
                        <Text className="text-xs" style={{ color: colors.textMuted }}>
                          {new Date(j.created_at).toLocaleDateString()}
                        </Text>
                        <Text className="text-xs font-semibold" style={{ color: colors.accent }}>
                          {j.theme_tags?.[0] ? `#${j.theme_tags[0]}` : '思辨'}
                        </Text>
                      </View>

                      <Text className="text-base font-bold mb-1.5" style={{ color: colors.textPrimary }}>
                        {renderHighlightedText(title, keyword)}
                      </Text>

                      <Text numberOfLines={3} className="text-xs leading-relaxed">
                        {renderHighlightedText(summary, keyword)}
                      </Text>
                    </Pressable>
                  );
                })
              )}
            </ScrollView>
          )}
        </View>
      )}

      {/* 年月归档视图 */}
      {activeTab === 'archive' && (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 110 }} className="flex-1">
          <View className="flex-row items-center mb-4">
            <Archive size={16} color={colors.accent} />
            <Text className="text-sm font-bold ml-1.5" style={{ color: colors.textPrimary }}>
              岁月如流 · 思辨年鉴
            </Text>
          </View>

          {Object.keys(archiveMap).length === 0 ? (
            <Text className="text-xs text-center py-10" style={{ color: colors.textMuted }}>
              暂无归档记录
            </Text>
          ) : (
            Object.keys(archiveMap)
              .sort((a, b) => Number(b) - Number(a))
              .map((year) => {
                const isYearExpanded = expandedYears[year];
                const yearData = archiveMap[year];
                const totalYearCount = Object.values(yearData).reduce((acc, cur) => acc + cur.length, 0);

                return (
                  <View
                    key={year}
                    className="mb-4 rounded-2xl border overflow-hidden"
                    style={{ backgroundColor: colors.cardBg, borderColor: colors.cardBorder }}
                  >
                    {/* 年份表头 */}
                    <Pressable
                      onPress={() => toggleYear(year)}
                      className="p-4 flex-row items-center justify-between"
                      style={{ backgroundColor: colors.accentBg }}
                    >
                      <View className="flex-row items-center">
                        <Calendar size={16} color={colors.accent} />
                        <Text className="text-base font-bold ml-2" style={{ color: colors.textPrimary }}>
                          {year} 年
                        </Text>
                        <View className="ml-2 px-2 py-0.5 rounded-full bg-white/70">
                          <Text className="text-[11px] font-semibold" style={{ color: colors.accent }}>
                            {totalYearCount} 篇
                          </Text>
                        </View>
                      </View>
                      {isYearExpanded ? (
                        <ChevronDown size={18} color={colors.accent} />
                      ) : (
                        <ChevronRight size={18} color={colors.accent} />
                      )}
                    </Pressable>

                    {/* 月份及篇目展开 */}
                    {isYearExpanded && (
                      <View className="p-3 gap-3">
                        {Object.keys(yearData)
                          .sort((a, b) => Number(b) - Number(a))
                          .map((month) => {
                            const monthList = yearData[month];
                            return (
                              <View key={month} className="border-l-2 pl-3 ml-2" style={{ borderColor: colors.accent }}>
                                <Text className="text-xs font-bold mb-2" style={{ color: colors.accent }}>
                                  {month} 月 ({monthList.length} 篇)
                                </Text>

                                <View className="gap-2">
                                  {monthList.map((j) => (
                                    <Pressable
                                      key={j.id}
                                      onPress={() => router.push(`/journal/${j.id}` as any)}
                                      className="p-2.5 rounded-lg border flex-row items-center justify-between active:opacity-75"
                                      style={{ backgroundColor: colors.bg, borderColor: colors.cardBorder }}
                                    >
                                      <View className="flex-1 mr-2">
                                        <Text
                                          numberOfLines={1}
                                          className="text-xs font-semibold"
                                          style={{ color: colors.textPrimary }}
                                        >
                                          {getJournalDisplayTitle(j)}
                                        </Text>
                                        <Text className="text-[10px] mt-0.5" style={{ color: colors.textMuted }}>
                                          {new Date(j.created_at).toLocaleDateString()} · {j.views_count} 阅
                                        </Text>
                                      </View>
                                      <ChevronRight size={14} color={colors.textMuted} />
                                    </Pressable>
                                  ))}
                                </View>
                              </View>
                            );
                          })}
                      </View>
                    )}
                  </View>
                );
              })
          )}
        </ScrollView>
      )}

      {/* 底部悬浮伴读留声机 */}
      <FloatingAudioPlayer />
    </SafeAreaView>
  );
}
