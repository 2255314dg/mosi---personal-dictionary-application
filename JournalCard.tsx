import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Journal, getJournalDisplayTitle, getJournalSummary } from '@/services/api';
import { useTheme } from '@/context/ThemeContext';
import { Calendar, Eye, MessageSquare, Compass, Sun, MapPin, Smile } from 'lucide-react-native';

interface JournalCardProps {
  journal: Journal;
  onTagClick?: (tag: string) => void;
}

export const JournalCard: React.FC<JournalCardProps> = ({ journal, onTagClick }) => {
  const router = useRouter();
  const { colors } = useTheme();

  const title = getJournalDisplayTitle(journal);
  const summary = getJournalSummary(journal.content, 160);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  };

  const getContentTypeBadge = (type: string) => {
    switch (type) {
      case 'dialogue':
        return '对话思辨';
      case 'with_image':
        return '图文沉思';
      default:
        return '纯粹心绪';
    }
  };

  return (
    <Pressable
      onPress={() => router.push(`/journal/${journal.id}` as any)}
      className="mb-4 rounded-2xl p-5 border shadow-sm active:opacity-90"
      style={{
        backgroundColor: colors.cardBg,
        borderColor: colors.cardBorder,
      }}
    >
      {/* 顶部信息行：时间线与内容形态 */}
      <View className="flex-row items-center justify-between mb-2.5">
        <View className="flex-row items-center">
          <Calendar size={13} color={colors.accent} />
          <Text className="text-xs ml-1.5 font-medium tracking-wider" style={{ color: colors.textMuted }}>
            {formatDate(journal.created_at)}
          </Text>
        </View>
        <View
          className="px-2 py-0.5 rounded-full"
          style={{ backgroundColor: colors.accentBg }}
        >
          <Text className="text-[11px] font-semibold" style={{ color: colors.accent }}>
            {getContentTypeBadge(journal.content_type)}
          </Text>
        </View>
      </View>

      {/* 标题 */}
      <Text
        className="text-lg font-bold mb-2 leading-snug"
        style={{ color: colors.textPrimary }}
      >
        {title}
      </Text>

      {/* 摘要正文 */}
      <Text
        numberOfLines={4}
        className="text-sm leading-relaxed mb-4 text-justify"
        style={{ color: colors.textSecondary }}
      >
        {summary}
      </Text>

      {/* 多维标签融合展示行 */}
      <View className="flex-row flex-wrap gap-1.5 mb-3">
        {/* 主题标签 */}
        {journal.theme_tags?.map((t) => (
          <Pressable
            key={t}
            onPress={(e) => {
              e.stopPropagation();
              onTagClick?.(t);
            }}
            className="flex-row items-center px-2.5 py-1 rounded-full border"
            style={{
              backgroundColor: colors.tagBg,
              borderColor: colors.cardBorder,
            }}
          >
            <Compass size={11} color={colors.tagText} />
            <Text className="text-[11px] ml-1 font-medium" style={{ color: colors.tagText }}>
              {t}
            </Text>
          </Pressable>
        ))}

        {/* 情绪标签 */}
        {journal.mood_tag && (
          <View
            className="flex-row items-center px-2 py-1 rounded-full"
            style={{ backgroundColor: colors.accentBg }}
          >
            <Smile size={11} color={colors.accent} />
            <Text className="text-[11px] ml-1 font-medium" style={{ color: colors.accent }}>
              {journal.mood_tag}
            </Text>
          </View>
        )}

        {/* 天气标签 */}
        {journal.weather_tag && (
          <View
            className="flex-row items-center px-2 py-1 rounded-full"
            style={{ backgroundColor: colors.tagBg }}
          >
            <Sun size={11} color={colors.tagText} />
            <Text className="text-[11px] ml-1" style={{ color: colors.tagText }}>
              {journal.weather_tag}
            </Text>
          </View>
        )}

        {/* 地点标签 */}
        {journal.location_tag && (
          <View
            className="flex-row items-center px-2 py-1 rounded-full"
            style={{ backgroundColor: colors.tagBg }}
          >
            <MapPin size={11} color={colors.tagText} />
            <Text className="text-[11px] ml-1" style={{ color: colors.tagText }}>
              {journal.location_tag}
            </Text>
          </View>
        )}
      </View>

      {/* 底部阅读与互动 */}
      <View
        className="flex-row items-center justify-between pt-3 border-t"
        style={{ borderColor: colors.cardBorder }}
      >
        <View className="flex-row items-center gap-3">
          <View className="flex-row items-center">
            <Eye size={13} color={colors.textMuted} />
            <Text className="text-xs ml-1" style={{ color: colors.textMuted }}>
              {journal.views_count || 0} 阅读
            </Text>
          </View>
        </View>

        <Text className="text-xs font-medium" style={{ color: colors.accent }}>
          细读思辨 →
        </Text>
      </View>
    </Pressable>
  );
};
