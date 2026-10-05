import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { JournalFilterParams, getTagCatalogDB, TagItem } from '@/services/api';
import { Filter, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react-native';

interface TagFilterProps {
  filter: JournalFilterParams;
  onFilterChange: (newFilter: JournalFilterParams) => void;
}

export const TagFilterBar: React.FC<TagFilterProps> = ({ filter, onFilterChange }) => {
  const { colors } = useTheme();
  const [expanded, setExpanded] = useState(false);

  // 从数据库动态加载的标签
  const [dbTags, setDbTags] = useState<TagItem[]>([]);

  useEffect(() => {
    getTagCatalogDB().then((tags) => {
      setDbTags(tags);
    });
  }, []);

  const themeList = dbTags.filter((t) => t.category === 'theme');
  const moodList = dbTags.filter((t) => t.category === 'mood');
  const weatherList = dbTags.filter((t) => t.category === 'weather');

  // 主题标签（动态从数据库加载）
  const THEME_TAGS = ['全部', ...themeList.map((t) => (t.emoji ? `${t.emoji} ${t.name}` : t.name))];
  const CONTENT_TYPES = [
    { label: '全部', value: undefined },
    { label: '对话片段', value: 'dialogue' },
    { label: '含图片', value: 'with_image' },
    { label: '纯文字', value: 'pure_text' },
  ];
  const MOOD_TAGS = ['全部', ...moodList.map((t) => (t.emoji ? `${t.emoji} ${t.name}` : t.name))];
  const WEATHER_TAGS = ['全部', ...weatherList.map((t) => (t.emoji ? `${t.emoji} ${t.name}` : t.name))];
  const LOCATION_TAGS = ['全部', '许昌', '家中', '旅途', '书房', '咖啡馆'];

  // 辅助函数：根据包含 emoji 的显示名匹配纯标签名
  const getRawTagName = (label: string) => {
    if (label === '全部') return undefined;
    const parts = label.trim().split(' ');
    return parts.length > 1 ? parts.slice(1).join(' ') : parts[0];
  };

  const hasActiveFilter = Boolean(
    filter.themeTag ||
    filter.contentType ||
    filter.moodTag ||
    filter.weatherTag ||
    filter.locationTag
  );

  const resetFilter = () => {
    onFilterChange({});
  };

  return (
    <View
      className="border-b"
      style={{
        backgroundColor: colors.cardBg,
        borderColor: colors.cardBorder,
      }}
    >
      {/* 顶部常用主题标签横向滚动条 */}
      <View className="py-2.5 px-3 flex-row items-center">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-1">
          {THEME_TAGS.map((tagLabel) => {
            const rawName = getRawTagName(tagLabel);
            const isSelected = (!filter.themeTag && tagLabel === '全部') || filter.themeTag === rawName;
            return (
              <Pressable
                key={tagLabel}
                onPress={() => {
                  onFilterChange({
                    ...filter,
                    themeTag: rawName,
                  });
                }}
                className="px-3 py-1.5 rounded-full mr-2 border active:opacity-75"
                style={{
                  backgroundColor: isSelected ? colors.accent : colors.tagBg,
                  borderColor: isSelected ? colors.accent : colors.cardBorder,
                }}
              >
                <Text
                  className="text-xs font-medium"
                  style={{
                    color: isSelected ? '#FFFFFF' : colors.tagText,
                  }}
                >
                  {tagLabel}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <Pressable
          onPress={() => setExpanded(!expanded)}
          className="flex-row items-center px-2.5 py-1.5 rounded-lg border ml-2 active:opacity-70"
          style={{
            borderColor: hasActiveFilter ? colors.accent : colors.cardBorder,
            backgroundColor: hasActiveFilter ? colors.accentBg : colors.bg,
          }}
        >
          <Filter size={13} color={hasActiveFilter ? colors.accent : colors.textSecondary} />
          <Text
            className="text-xs ml-1 font-medium"
            style={{ color: hasActiveFilter ? colors.accent : colors.textSecondary }}
          >
            筛选
          </Text>
          {expanded ? (
            <ChevronUp size={14} color={hasActiveFilter ? colors.accent : colors.textSecondary} className="ml-0.5" />
          ) : (
            <ChevronDown size={14} color={hasActiveFilter ? colors.accent : colors.textSecondary} className="ml-0.5" />
          )}
        </Pressable>
      </View>

      {/* 展开的更多维度筛选面板 */}
      {expanded && (
        <View className="px-4 py-3 border-t gap-3" style={{ borderColor: colors.cardBorder, backgroundColor: colors.bg }}>
          {/* 内容形态 */}
          <View>
            <Text className="text-[11px] font-semibold mb-1.5" style={{ color: colors.textMuted }}>
              【内容形态】
            </Text>
            <View className="flex-row flex-wrap gap-1.5">
              {CONTENT_TYPES.map((item) => {
                const isSelected = filter.contentType === item.value;
                return (
                  <Pressable
                    key={item.label}
                    onPress={() => onFilterChange({ ...filter, contentType: item.value })}
                    className="px-2.5 py-1 rounded-md border text-xs"
                    style={{
                      backgroundColor: isSelected ? colors.accentBg : colors.cardBg,
                      borderColor: isSelected ? colors.accent : colors.cardBorder,
                    }}
                  >
                    <Text
                      className="text-xs"
                      style={{ color: isSelected ? colors.accent : colors.textSecondary }}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* 情绪心境 */}
          <View>
            <Text className="text-[11px] font-semibold mb-1.5" style={{ color: colors.textMuted }}>
              【情绪心境】
            </Text>
            <View className="flex-row flex-wrap gap-1.5">
              {MOOD_TAGS.map((tagLabel) => {
                const rawName = getRawTagName(tagLabel);
                const isSelected = (!filter.moodTag && tagLabel === '全部') || filter.moodTag === rawName;
                return (
                  <Pressable
                    key={tagLabel}
                    onPress={() => onFilterChange({ ...filter, moodTag: rawName })}
                    className="px-2.5 py-1 rounded-md border text-xs"
                    style={{
                      backgroundColor: isSelected ? colors.accentBg : colors.cardBg,
                      borderColor: isSelected ? colors.accent : colors.cardBorder,
                    }}
                  >
                    <Text
                      className="text-xs"
                      style={{ color: isSelected ? colors.accent : colors.textSecondary }}
                    >
                      {tagLabel}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* 天气与地点 */}
          <View className="flex-row justify-between">
            <View className="flex-1 mr-2">
              <Text className="text-[11px] font-semibold mb-1.5" style={{ color: colors.textMuted }}>
                【天气】
              </Text>
              <View className="flex-row flex-wrap gap-1.5">
                {WEATHER_TAGS.map((tagLabel) => {
                  const rawName = getRawTagName(tagLabel);
                  const isSelected = (!filter.weatherTag && tagLabel === '全部') || filter.weatherTag === rawName;
                  return (
                    <Pressable
                      key={tagLabel}
                      onPress={() => onFilterChange({ ...filter, weatherTag: rawName })}
                      className="px-2 py-0.5 rounded border"
                      style={{
                        backgroundColor: isSelected ? colors.accentBg : colors.cardBg,
                        borderColor: isSelected ? colors.accent : colors.cardBorder,
                      }}
                    >
                      <Text
                        className="text-[11px]"
                        style={{ color: isSelected ? colors.accent : colors.textSecondary }}
                      >
                        {tagLabel}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View className="flex-1">
              <Text className="text-[11px] font-semibold mb-1.5" style={{ color: colors.textMuted }}>
                【思辨地点】
              </Text>
              <View className="flex-row flex-wrap gap-1.5">
                {LOCATION_TAGS.map((tag) => {
                  const isSelected = (!filter.locationTag && tag === '全部') || filter.locationTag === tag;
                  return (
                    <Pressable
                      key={tag}
                      onPress={() => onFilterChange({ ...filter, locationTag: tag === '全部' ? undefined : tag })}
                      className="px-2 py-0.5 rounded border"
                      style={{
                        backgroundColor: isSelected ? colors.accentBg : colors.cardBg,
                        borderColor: isSelected ? colors.accent : colors.cardBorder,
                      }}
                    >
                      <Text
                        className="text-[11px]"
                        style={{ color: isSelected ? colors.accent : colors.textSecondary }}
                      >
                        {tag}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>

          {/* 重置筛选条件 */}
          {hasActiveFilter && (
            <View className="flex-row justify-end pt-1">
              <Pressable
                onPress={resetFilter}
                className="flex-row items-center px-3 py-1 rounded-full active:opacity-70"
                style={{ backgroundColor: colors.cardBorder }}
              >
                <RotateCcw size={12} color={colors.textSecondary} />
                <Text className="text-xs ml-1" style={{ color: colors.textSecondary }}>
                  重置筛选条件
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      )}
    </View>
  );
};
