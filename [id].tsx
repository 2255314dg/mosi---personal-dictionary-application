import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Share,
  Modal,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '@/context/ThemeContext';
import {
  Journal,
  Comment,
  getJournalById,
  getJournals,
  incrementJournalViews,
  getComments,
  addComment,
  checkIsAdmin,
  deleteComment,
  getJournalDisplayTitle,
  createShareLink,
  deleteJournal,
  JournalEntityLink,
  getJournalEntities,
} from '@/services/api';
import { MarkdownRenderer } from '@/components/MarkdownRenderer';
import { Image } from 'expo-image';
import { speakMosiArticle, stopMosiReading } from '@/utils/reading';
import { FloatingAudioPlayer } from '@/components/FloatingAudioPlayer';
import {
  ChevronLeft,
  Share2,
  Calendar,
  Eye,
  MessageSquare,
  ListTree,
  Send,
  Trash2,
  ArrowUp,
  ChevronRight,
  Sparkles,
  FileDown,
  X,
  Check,
  Database,
} from 'lucide-react-native';

export default function JournalDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();

  const [journal, setJournal] = useState<Journal | null>(null);
  const [allJournals, setAllJournals] = useState<Journal[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  // 目录导航
  const [toc, setToc] = useState<{ id: string; title: string; level: number }[]>([]);
  const [showTocModal, setShowTocModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareUrl, setShareUrl] = useState('');

  // 留言输入
  const [nickname, setNickname] = useState('');
  const [commentContent, setCommentContent] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [commentSuccess, setCommentSuccess] = useState(false);

  // 滚动与返回顶部
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [isReading, setIsReading] = useState(false);
  const [thoughtEntities, setThoughtEntities] = useState<JournalEntityLink[]>([]);
  const scrollViewRef = useRef<ScrollView>(null);

  // 加载数据 (需登录验证)
  useEffect(() => {
    if (!id) return;
    let isMounted = true;

    async function fetchData() {
      setLoading(true);
      try {
        const { data: { session } } = await import('@/client/supabase').then(m => m.supabase.auth.getSession());
        if (!session) {
          if (isMounted) setLoading(false);
          return;
        }

        const [curJournal, journalsList, comms, adminStatus] = await Promise.all([
          getJournalById(id!),
          getJournals(),
          getComments(id!),
          checkIsAdmin(),
        ]);

        if (isMounted) {
          setJournal(curJournal);
          if (curJournal) setThoughtEntities(await getJournalEntities(curJournal.id));
          setAllJournals(journalsList);
          setComments(comms);
          setIsAdmin(adminStatus);

          // 解析正文 H2/H3 目录
          if (curJournal) {
            const lines = curJournal.content.split('\n');
            const extracted: { id: string; title: string; level: number }[] = [];
            lines.forEach((line, index) => {
              const trimmed = line.trim();
              if (/^#\s+/.test(trimmed)) extracted.push({ id:`h1-${index}`, title:trimmed.replace(/^#\s+/,''), level:1 });
            });
            setToc(extracted);
          }
        }
        // 递增阅读量
        incrementJournalViews(id!);
      } catch (err) {
        console.error(err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [id]);

  // 计算上一篇、下一篇
  const curIdx = allJournals.findIndex((j) => j.id === id);
  const prevJournal = curIdx > 0 ? allJournals[curIdx - 1] : null;
  const nextJournal = curIdx >= 0 && curIdx < allJournals.length - 1 ? allJournals[curIdx + 1] : null;

  // 提交评论
  const handleAddComment = async () => {
    if (!commentContent.trim() || !id) return;
    setSubmittingComment(true);
    try {
      const res = await addComment({
        journal_id: id,
        nickname: nickname.trim() || '过客',
        content: commentContent.trim(),
      });
      if (res.data) {
        setComments([...comments, res.data]);
        setCommentContent('');
        setCommentSuccess(true);
        setTimeout(() => setCommentSuccess(false), 3000);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSubmittingComment(false);
    }
  };

  // 管理员删除留言
  const handleDeleteComment = async (commId: string) => {
    const ok = await deleteComment(commId);
    if (ok) {
      setComments(comments.filter((c) => c.id !== commId));
    }
  };

  // 系统分享与复制链接
  const handleShare = async () => {
    if (!journal || !isAdmin) return;
    const result = await createShareLink(journal.id, 30);
    if (result?.url) { setShareUrl(result.url); setShowShareModal(true); }
  };

  // 左右切篇逻辑
  const goToPrev = () => {
    if (prevJournal) {
      router.replace(`/journal/${prevJournal.id}` as any);
    }
  };

  const goToNext = () => {
    if (nextJournal) {
      router.replace(`/journal/${nextJournal.id}` as any);
    }
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center" style={{ backgroundColor: colors.bg }}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text className="text-xs mt-3" style={{ color: colors.textMuted }}>
          正展开思辨长卷...
        </Text>
      </SafeAreaView>
    );
  }

  // 严格邀请码与登录权限拦截
  if (!journal) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center p-8" style={{ backgroundColor: colors.bg }}>
        <View
          className="w-16 h-16 rounded-3xl items-center justify-center mb-5"
          style={{ backgroundColor: colors.accentBg }}
        >
          <Sparkles size={32} color={colors.accent} />
        </View>
        <Text className="text-xl font-bold mb-2 tracking-wider text-center" style={{ color: colors.textPrimary }}>
          墨思 - 私人空间
        </Text>
        <Text className="text-xs font-semibold mb-6 px-3 py-1.5 rounded-full border" style={{ color: colors.accent, backgroundColor: colors.accentBg, borderColor: colors.accent }}>
          墨思为私人空间，需邀请码方可访问
        </Text>
        <Text className="text-xs text-center leading-relaxed mb-6 max-w-[260px]" style={{ color: colors.textMuted }}>
          若您尚未通过邀请码注册并登录，请先验证邀请码或登录账号以开启阅读。
        </Text>
        <Pressable
          onPress={() => router.replace('/login')}
          className="w-full max-w-[240px] py-3 rounded-2xl items-center justify-center active:opacity-85 shadow"
          style={{ backgroundColor: colors.accent }}
        >
          <Text className="text-xs font-bold text-white">前往登录 / 验证邀请码</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const title = getJournalDisplayTitle(journal);

  return (
    <SafeAreaView edges={['top']} className="flex-1" style={{ backgroundColor: colors.bg }}>
      {/* 顶部操作导航栏 */}
      <View
        className="px-4 py-3 flex-row items-center justify-between border-b"
        style={{
          backgroundColor: colors.cardBg,
          borderColor: colors.cardBorder,
        }}
      >
        <Pressable
          onPress={() => router.back()}
          className="flex-row items-center p-1.5 rounded-lg active:opacity-70"
        >
          <ChevronLeft size={22} color={colors.textPrimary} />
          <Text className="text-sm font-medium ml-1" style={{ color: colors.textPrimary }}>
            时间线
          </Text>
        </Pressable>

        <View className="flex-row items-center gap-2">
          {toc.length > 0 && (
            <Pressable
              onPress={() => setShowTocModal(true)}
              className="p-2 rounded-full border active:opacity-70"
              style={{ borderColor: colors.cardBorder, backgroundColor: colors.cardBg }}
            >
              <ListTree size={17} color={colors.accent} />
            </Pressable>
          )}

          <Pressable
            onPress={async()=>{if(isReading){await stopMosiReading();setIsReading(false)}else{await speakMosiArticle(journal.content,()=>setIsReading(true),()=>setIsReading(false));}}}
            className="px-2.5 py-1.5 rounded-full border active:opacity-70"
            style={{ borderColor: isReading ? colors.accent : colors.cardBorder, backgroundColor: isReading ? colors.accentBg : colors.cardBg }}
          >
            <Text className="text-[11px] font-bold" style={{color:isReading?colors.accent:colors.textSecondary}}>{isReading?'停止朗读':'朗读'}</Text>
          </Pressable>
          <Pressable
            onPress={handleShare}
            className="p-2 rounded-full border active:opacity-70"
            style={{ borderColor: colors.cardBorder, backgroundColor: colors.cardBg }}
          >
            <Share2 size={17} color={colors.textSecondary} />
          </Pressable>

          {isAdmin && (
            <Pressable onPress={async()=>{const ok=deleteJournal(journal.id);if(await ok)router.replace('/' as any)}} className="p-2 rounded-full border active:opacity-70" style={{borderColor:'#FCA5A5',backgroundColor:'#FEF2F2'}}><Trash2 size={17} color="#DC2626"/></Pressable>
          )}
          {isAdmin && (
            <Pressable
              onPress={() => router.push(`/editor?id=${journal.id}` as any)}
              className="px-3 py-1.5 rounded-full border active:opacity-70"
              style={{ borderColor: colors.accent, backgroundColor: colors.accentBg }}
            >
              <Text className="text-xs font-semibold" style={{ color: colors.accent }}>
                编辑
              </Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* 主阅读滚动区域 */}
      <ScrollView
        ref={scrollViewRef}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: 20, paddingBottom: 120 }}
        onScroll={(e) => {
          const y = e.nativeEvent.contentOffset.y;
          setShowBackToTop(y > 350);
        }}
        scrollEventThrottle={100}
      >
        {/* 日志头部元信息 */}
        <View className="mb-6">
          <Text
            className="text-2xl font-bold tracking-wide leading-tight mb-3"
            style={{ color: colors.textPrimary }}
          >
            {title}
          </Text>

          {/* 属性与标签行 */}
          <View className="flex-row flex-wrap items-center gap-2 mb-3">
            <View className="flex-row items-center">
              <Calendar size={13} color={colors.accent} />
              <Text className="text-xs ml-1" style={{ color: colors.textMuted }}>
                {new Date(journal.created_at).toLocaleDateString()}
              </Text>
            </View>

            <View className="flex-row items-center ml-2">
              <Eye size={13} color={colors.textMuted} />
              <Text className="text-xs ml-1" style={{ color: colors.textMuted }}>
                {journal.views_count} 次阅读
              </Text>
            </View>

            {journal.mood_tag && (
              <View className="px-2 py-0.5 rounded-full" style={{ backgroundColor: colors.accentBg }}>
                <Text className="text-[11px] font-medium" style={{ color: colors.accent }}>
                  心境·{journal.mood_tag}
                </Text>
              </View>
            )}

            {journal.weather_tag && (
              <View className="px-2 py-0.5 rounded-full" style={{ backgroundColor: colors.tagBg }}>
                <Text className="text-[11px]" style={{ color: colors.tagText }}>
                  天气·{journal.weather_tag}
                </Text>
              </View>
            )}

            {journal.location_tag && (
              <View className="px-2 py-0.5 rounded-full" style={{ backgroundColor: colors.tagBg }}>
                <Text className="text-[11px]" style={{ color: colors.tagText }}>
                  思于·{journal.location_tag}
                </Text>
              </View>
            )}
          </View>

          {/* 主题标签组 */}
          {journal.theme_tags && journal.theme_tags.length > 0 && (
            <View className="flex-row flex-wrap gap-1.5 pt-1">
              {journal.theme_tags.map((t) => (
                <View
                  key={t}
                  className="px-2.5 py-0.5 rounded-full border"
                  style={{ backgroundColor: colors.tagBg, borderColor: colors.cardBorder }}
                >
                  <Text className="text-xs font-medium" style={{ color: colors.tagText }}>
                    #{t}
                  </Text>
                </View>
              ))}
            </View>
          )}

          <View className="h-0.5 w-full mt-4" style={{ backgroundColor: colors.cardBorder }} />
        </View>

        {/* 正文渲染区 (支持对话、图文、引用、7种下划线) */}
        {thoughtEntities.length > 0 && (
          <View className="mb-5 rounded-2xl border p-4" style={{ borderColor: colors.cardBorder, backgroundColor: colors.cardBg }}>
            <View className="flex-row items-center justify-between mb-3">
              <View className="flex-row items-center"><Database size={16} color={colors.accent} /><Text className="text-sm font-bold ml-2" style={{ color: colors.textPrimary }}>思想实体</Text></View>
              <Pressable onPress={() => router.push(`/thought-database?journalId=${journal.id}` as any)}><Text className="text-xs font-semibold" style={{ color: colors.accent }}>管理</Text></Pressable>
            </View>
            <View className="flex-row flex-wrap gap-2">
              {thoughtEntities.map((item) => (
                <View key={item.id} className="px-2.5 py-1.5 rounded-full border" style={{ borderColor: colors.cardBorder, backgroundColor: colors.accentBg }}>
                  <Text className="text-[11px] font-medium" style={{ color: colors.accent }}>{item.entity?.name || item.entity?.statement || item.entity_id.slice(0, 8)}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
        <MarkdownRenderer content={journal.content} />

        {/* 底部前后篇切换卡片 */}
        <View className="my-8 pt-6 border-t" style={{ borderColor: colors.cardBorder }}>
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-xs font-semibold tracking-wider" style={{ color: colors.textMuted }}>
              上下篇目 · 思想漫游
            </Text>
          </View>
          <View className="flex-row gap-3">
            {prevJournal ? (
              <Pressable
                onPress={goToPrev}
                className="flex-1 p-3 rounded-xl border active:opacity-75"
                style={{ backgroundColor: colors.cardBg, borderColor: colors.cardBorder }}
              >
                <Text className="text-[10px] mb-1 font-semibold" style={{ color: colors.accent }}>
                  ← 上一篇
                </Text>
                <Text numberOfLines={1} className="text-xs font-medium" style={{ color: colors.textPrimary }}>
                  {getJournalDisplayTitle(prevJournal)}
                </Text>
              </Pressable>
            ) : (
              <View
                className="flex-1 p-3 rounded-xl border opacity-50"
                style={{ backgroundColor: colors.bg, borderColor: colors.cardBorder }}
              >
                <Text className="text-[10px] mb-1" style={{ color: colors.textMuted }}>
                  ← 上一篇
                </Text>
                <Text className="text-xs" style={{ color: colors.textMuted }}>
                  已是最初篇目
                </Text>
              </View>
            )}

            {nextJournal ? (
              <Pressable
                onPress={goToNext}
                className="flex-1 p-3 rounded-xl border text-right active:opacity-75"
                style={{ backgroundColor: colors.cardBg, borderColor: colors.cardBorder }}
              >
                <Text className="text-[10px] mb-1 font-semibold text-right" style={{ color: colors.accent }}>
                  下一篇 →
                </Text>
                <Text numberOfLines={1} className="text-xs font-medium text-right" style={{ color: colors.textPrimary }}>
                  {getJournalDisplayTitle(nextJournal)}
                </Text>
              </Pressable>
            ) : (
              <View
                className="flex-1 p-3 rounded-xl border opacity-50"
                style={{ backgroundColor: colors.bg, borderColor: colors.cardBorder }}
              >
                <Text className="text-[10px] mb-1 text-right" style={{ color: colors.textMuted }}>
                  下一篇 →
                </Text>
                <Text className="text-xs text-right" style={{ color: colors.textMuted }}>
                  已至最新篇目
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* 读者留言互动区 (免注册即可填写昵称发表) */}
        <View className="mt-4 pt-6 border-t" style={{ borderColor: colors.cardBorder }}>
          <View className="flex-row items-center justify-between mb-4">
            <View className="flex-row items-center">
              <MessageSquare size={16} color={colors.accent} />
              <Text className="text-base font-bold ml-2" style={{ color: colors.textPrimary }}>
                回响与留言 ({comments.length})
              </Text>
            </View>
            <Text className="text-xs" style={{ color: colors.textMuted }}>
              免注册即可发表思辨回响
            </Text>
          </View>

          {/* 留言输入框 */}
          <View
            className="p-4 rounded-2xl border mb-6 shadow-sm"
            style={{ backgroundColor: colors.cardBg, borderColor: colors.cardBorder }}
          >
            <TextInput
              placeholder="您的称谓 / 笔名（留空默认为“过客”）"
              placeholderTextColor={colors.textMuted}
              value={nickname}
              onChangeText={setNickname}
              className="text-xs py-2 px-3 rounded-lg border mb-2.5"
              style={{
                backgroundColor: colors.bg,
                borderColor: colors.cardBorder,
                color: colors.textPrimary,
              }}
            />

            <TextInput
              placeholder="写下你对此篇思辨的共鸣、异见或遐思..."
              placeholderTextColor={colors.textMuted}
              value={commentContent}
              onChangeText={setCommentContent}
              multiline
              numberOfLines={3}
              className="text-sm py-2 px-3 rounded-lg border min-h-[70px] mb-3"
              style={{
                backgroundColor: colors.bg,
                borderColor: colors.cardBorder,
                color: colors.textPrimary,
              }}
            />

            <View className="flex-row items-center justify-between">
              {commentSuccess ? (
                <View className="flex-row items-center">
                  <Check size={14} color="#10B981" />
                  <Text className="text-xs text-emerald-600 ml-1">留言发表成功！</Text>
                </View>
              ) : (
                <Text className="text-[11px]" style={{ color: colors.textMuted }}>
                  理性交流，共探真理
                </Text>
              )}

              <Pressable
                onPress={handleAddComment}
                disabled={submittingComment || !commentContent.trim()}
                className="flex-row items-center px-4 py-2 rounded-xl active:opacity-80"
                style={{
                  backgroundColor: commentContent.trim() ? colors.accent : colors.tagBg,
                }}
              >
                {submittingComment ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Send size={13} color={commentContent.trim() ? '#FFFFFF' : colors.textMuted} />
                    <Text
                      className="text-xs font-semibold ml-1.5"
                      style={{ color: commentContent.trim() ? '#FFFFFF' : colors.textMuted }}
                    >
                      发表回响
                    </Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>

          {/* 留言列表 */}
          {comments.length === 0 ? (
            <View className="py-8 items-center justify-center">
              <Text className="text-xs" style={{ color: colors.textMuted }}>
                尚无回响，做第一位留白处的对谈者吧
              </Text>
            </View>
          ) : (
            <View className="gap-3">
              {comments.map((comm) => (
                <View
                  key={comm.id}
                  className="p-3.5 rounded-xl border"
                  style={{ backgroundColor: colors.cardBg, borderColor: colors.cardBorder }}
                >
                  <View className="flex-row items-center justify-between mb-1.5">
                    <View className="flex-row items-center">
                      <View
                        className="w-5 h-5 rounded-full items-center justify-center mr-2"
                        style={{ backgroundColor: colors.accentBg }}
                      >
                        <Text className="text-[10px] font-bold" style={{ color: colors.accent }}>
                          {comm.nickname.charAt(0)}
                        </Text>
                      </View>
                      <Text className="text-xs font-semibold" style={{ color: colors.textPrimary }}>
                        {comm.nickname}
                      </Text>
                    </View>

                    <View className="flex-row items-center gap-2">
                      <Text className="text-[10px]" style={{ color: colors.textMuted }}>
                        {new Date(comm.created_at).toLocaleDateString()}
                      </Text>
                      {isAdmin && (
                        <Pressable onPress={() => handleDeleteComment(comm.id)} className="p-1">
                          <Trash2 size={13} color="#EF4444" />
                        </Pressable>
                      )}
                    </View>
                  </View>

                  <Text className="text-sm leading-relaxed" style={{ color: colors.textSecondary }}>
                    {comm.content}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* 返回顶部悬浮按钮 */}
      {showBackToTop && (
        <Pressable
          onPress={() => scrollViewRef.current?.scrollTo({ y: 0, animated: true })}
          className="absolute right-5 bottom-24 w-10 h-10 rounded-full items-center justify-center shadow-lg border active:opacity-70 z-30"
          style={{ backgroundColor: colors.cardBg, borderColor: colors.cardBorder }}
        >
          <ArrowUp size={18} color={colors.accent} />
        </Pressable>
      )}

      {/* 目录导航侧边弹窗 */}
      {showTocModal && (
        <Pressable
          className="absolute inset-0 bg-black/40 z-50 justify-end"
          onPress={() => setShowTocModal(false)}
        >
          <Pressable
            className="rounded-t-3xl p-6 max-h-[70%]"
            style={{ backgroundColor: colors.cardBg }}
            onPress={(e) => e.stopPropagation()}
          >
            <View className="flex-row items-center justify-between pb-4 border-b" style={{ borderColor: colors.cardBorder }}>
              <View className="flex-row items-center">
                <ListTree size={18} color={colors.accent} />
                <Text className="text-base font-bold ml-2" style={{ color: colors.textPrimary }}>
                  思辨提纲目录
                </Text>
              </View>
              <Pressable onPress={() => setShowTocModal(false)}>
                <X size={18} color={colors.textSecondary} />
              </Pressable>
            </View>

            <ScrollView className="py-4">
              {toc.map((item, idx) => (
                <Pressable
                  key={item.id || idx}
                  onPress={() => {
                    setShowTocModal(false);
                    // 点击平滑滚动
                    scrollViewRef.current?.scrollTo({ y: (idx + 1) * 200, animated: true });
                  }}
                  className="py-2.5 px-2 rounded-lg flex-row items-center active:opacity-70"
                  style={{ paddingLeft: 8 }}
                >
                  <Text
                    className="text-sm font-medium flex-1"
                    style={{ color: item.level === 2 ? colors.textPrimary : colors.textSecondary }}
                  >
                    {item.title}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      )}

      {/* 底部悬浮伴读音乐 */}
      <FloatingAudioPlayer />
    </SafeAreaView>
  );
}
