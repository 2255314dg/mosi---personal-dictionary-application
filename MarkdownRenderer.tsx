import React from 'react';
import { View, Text, Linking, ScrollView } from 'react-native';
import { Image } from 'expo-image';
import { useTheme } from '@/context/ThemeContext';
import { StyledUnderlineSvg, UnderlineStyleType } from './StyledUnderlineSvg';
import { AdaptiveMarkdownImage } from './AdaptiveMarkdownImage';
import { MessageSquareQuote, Code } from 'lucide-react-native';

interface MarkdownRendererProps {
  content: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  const { colors } = useTheme();

  // 将内容分块解析为段落、标题、引用块、对话、下划线标记等
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];

  let i = 0;
  while (i < lines.length) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    if (!trimmed) {
      elements.push(<View key={`spacer-${i}`} className="h-3" />);
      i++;
      continue;
    }

    // 0. 多行代码块 (```)
    if (trimmed.startsWith('```')) {
      const codeLanguage = trimmed.replace(/^```/, '').trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length && lines[i].trim().startsWith('```')) {
        i++; // 跳过闭合的 ```
      }

      elements.push(
        <View
          key={`codeblock-${i}`}
          className="my-3 p-3.5 rounded-2xl border"
          style={{
            backgroundColor: colors.cardBg,
            borderColor: colors.cardBorder,
          }}
        >
          {codeLanguage ? (
            <View className="flex-row items-center justify-between pb-2 mb-2 border-b" style={{ borderColor: colors.cardBorder }}>
              <View className="flex-row items-center">
                <Code size={13} color={colors.accent} />
                <Text className="text-[11px] font-mono font-bold uppercase ml-1.5" style={{ color: colors.accent }}>
                  {codeLanguage}
                </Text>
              </View>
              <Text className="text-[10px]" style={{ color: colors.textMuted }}>
                代码片段
              </Text>
            </View>
          ) : null}
          <Text
            className="text-xs leading-relaxed font-mono"
            style={{
              color: colors.textPrimary,
              fontFamily: 'monospace',
            }}
          >
            {codeLines.join('\n')}
          </Text>
        </View>
      );
      continue;
    }

    // 1. 标题 H1 / H2 / H3
    if (trimmed.startsWith('# ')) {
      elements.push(
        <Text
          key={`h1-${i}`}
          className="text-2xl font-bold my-3 tracking-wide"
          style={{ color: colors.textPrimary }}
        >
          {trimmed.replace(/^#\s+/, '')}
        </Text>
      );
      i++;
      continue;
    }
    if (trimmed.startsWith('## ')) {
      elements.push(
        <View key={`h2-${i}`} className="mt-5 mb-2.5">
          <Text
            className="text-xl font-bold tracking-wide"
            style={{ color: colors.textPrimary }}
          >
            {trimmed.replace(/^##\s+/, '')}
          </Text>
          <View className="h-0.5 w-10 mt-1.5 rounded-full" style={{ backgroundColor: colors.accent }} />
        </View>
      );
      i++;
      continue;
    }
    if (trimmed.startsWith('### ')) {
      elements.push(
        <Text
          key={`h3-${i}`}
          className="text-base font-bold mt-4 mb-1.5"
          style={{ color: colors.accent }}
        >
          {trimmed.replace(/^###\s+/, '')}
        </Text>
      );
      i++;
      continue;
    }

    // 2. 引用块 Blockquote (支持对话)
    if (trimmed.startsWith('>')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quoteLines.push(lines[i].trim().replace(/^>\s*/, ''));
        i++;
      }
      elements.push(
        <View
          key={`quote-${i}`}
          className="my-3 p-4 rounded-xl border-l-4"
          style={{
            backgroundColor: colors.accentBg,
            borderLeftColor: colors.accent,
          }}
        >
          <View className="flex-row items-center mb-1">
            <MessageSquareQuote size={16} color={colors.accent} />
            <Text className="text-[11px] font-semibold ml-1.5 tracking-wider" style={{ color: colors.accent }}>
              沉思对谈
            </Text>
          </View>
          {quoteLines.map((ql, qIdx) => (
            <Text
              key={qIdx}
              className="text-sm leading-relaxed my-0.5"
              style={{ color: colors.textPrimary }}
            >
              {renderInlineStyles(ql, colors)}
            </Text>
          ))}
        </View>
      );
      continue;
    }

    // 3. 图片插入 ![alt](url) (支持首尾有空格或前后有包裹)
    const imgMatch = trimmed.match(/^!\[(.*?)\]\((.*?)\)$/);
    if (imgMatch) {
      const rawAlt = imgMatch[1]?.trim() || '';
      const imgUrl = imgMatch[2]?.trim() || '';

      // 无论 Markdown 中包含任何数字编号 alt（如 1000260009）或空 alt，均不渲染任何文字或编号标签，整张图片独立完整自适应呈现
      elements.push(
        <AdaptiveMarkdownImage
          key={`img-${i}`}
          uri={imgUrl}
        />
      );
      i++;
      continue;
    }

    // 4. 列表项 (*, -, 1.)
    if (/^[\*\-]\s+/.test(trimmed)) {
      elements.push(
        <View key={`li-${i}`} className="flex-row items-start my-1 px-2">
          <Text className="text-sm mr-2" style={{ color: colors.accent }}>
            •
          </Text>
          <Text className="text-sm flex-1 leading-relaxed" style={{ color: colors.textPrimary }}>
            {renderInlineStyles(trimmed.replace(/^[\*\-]\s+/, ''), colors)}
          </Text>
        </View>
      );
      i++;
      continue;
    }
    if (/^\d+\.\s+/.test(trimmed)) {
      const numMatch = trimmed.match(/^(\d+)\.\s+/);
      const num = numMatch ? numMatch[1] : '1';
      elements.push(
        <View key={`oli-${i}`} className="flex-row items-start my-1 px-2">
          <Text className="text-xs font-bold mr-2 mt-0.5 px-1.5 py-0.5 rounded" style={{ backgroundColor: colors.accentBg, color: colors.accent }}>
            {num}
          </Text>
          <Text className="text-sm flex-1 leading-relaxed" style={{ color: colors.textPrimary }}>
            {renderInlineStyles(trimmed.replace(/^\d+\.\s+/, ''), colors)}
          </Text>
        </View>
      );
      i++;
      continue;
    }

    // 5. 分隔线 (---)
    if (trimmed === '---' || trimmed === '***') {
      elements.push(
        <View key={`hr-${i}`} className="my-5 items-center justify-center">
          <View className="h-0.5 w-full rounded" style={{ backgroundColor: colors.cardBorder }} />
        </View>
      );
      i++;
      continue;
    }

    // 5.5 表格支持 (| col1 | col2 |)
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const tableRows: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
        const row = lines[i].trim();
        // 忽略纯分隔线行如 |---|---|
        const isSeparator = /^\|(\s*:?-+:?\s*\|)+$/.test(row);
        if (!isSeparator) {
          tableRows.push(row);
        }
        i++;
      }

      if (tableRows.length > 0) {
        elements.push(
          <ScrollView
            key={`table-${i}`}
            horizontal
            showsHorizontalScrollIndicator={false}
            className="my-3 rounded-xl border overflow-hidden"
            style={{
              borderColor: colors.cardBorder,
              backgroundColor: colors.cardBg,
            }}
          >
            <View className="min-w-full">
              {tableRows.map((rowStr, rowIdx) => {
                // 拆分单元格并过滤首尾空串
                const cells = rowStr
                  .split('|')
                  .slice(1, -1)
                  .map((c) => c.trim());
                const isHeader = rowIdx === 0;

                return (
                  <View
                    key={`tr-${rowIdx}`}
                    className={`flex-row border-b ${isHeader ? 'py-2.5 font-bold' : 'py-2'}`}
                    style={{
                      borderColor: colors.cardBorder,
                      backgroundColor: isHeader ? colors.tagBg : 'transparent',
                    }}
                  >
                    {cells.map((cellText, cellIdx) => (
                      <View
                        key={`td-${cellIdx}`}
                        className="px-3 min-w-[90px] justify-center"
                        style={{ borderRightWidth: cellIdx < cells.length - 1 ? 1 : 0, borderColor: colors.cardBorder }}
                      >
                        <Text
                          className={`text-xs ${isHeader ? 'font-bold' : ''}`}
                          style={{ color: isHeader ? colors.textPrimary : colors.textSecondary }}
                        >
                          {renderInlineStyles(cellText, colors)}
                        </Text>
                      </View>
                    ))}
                  </View>
                );
              })}
            </View>
          </ScrollView>
        );
        continue;
      }
    }

    // 6. 普通段落 (支持内嵌7种下划线语法，例如: ~u[text]{wavy}~ 或 粗体 **text**、代码 `code`)
    elements.push(
      <View key={`p-${i}`} className="my-1.5">
        <Text className="text-base leading-relaxed text-justify" style={{ color: colors.textPrimary }}>
          {renderInlineStyles(trimmed, colors)}
        </Text>
      </View>
    );

    i++;
  }

  return <View className="py-2">{elements}</View>;
};

// 内联样式解析辅助器 (处理超链接、粗体、斜体、行内代码、7种下划线标记)
function renderInlineStyles(text: string, colors: any): React.ReactNode {
  // 正则检测超链接 [text](url)、特殊下划线标记: ~u[内容]{lineType}~、粗体 **text**、斜体 *text*、代码 `code`
  const parts = text.split(/(\[.*?\]\(.*?\)|\~u\[.*?\]\{.*?\}~|\*\*.*?\*\*|\*.*?\*|`.*?`)/g);

  return parts.map((part, idx) => {
    if (!part) return null;

    // 超链接 [text](url)
    const linkMatch = part.match(/^\[(.*?)\]\((.*?)\)$/);
    if (linkMatch) {
      const linkText = linkMatch[1];
      const linkUrl = linkMatch[2];
      return (
        <Text
          key={idx}
          className="underline font-medium"
          style={{ color: colors.accent }}
          onPress={() => {
            if (linkUrl) {
              Linking.openURL(linkUrl).catch((err) =>
                console.warn('无法打开链接:', linkUrl, err)
              );
            }
          }}
        >
          {linkText}
        </Text>
      );
    }

    // 7种下划线标记
    const uMatch = part.match(/^~u\[(.*?)\]\{(.*?)\}~$/);
    if (uMatch) {
      const uText = uMatch[1];
      const uType = uMatch[2] as UnderlineStyleType;
      return (
        <Text key={idx} className="font-medium" style={{ color: colors.accent }}>
          {uText}
        </Text>
      );
    }

    // 粗体 **bold**
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <Text key={idx} className="font-bold" style={{ color: colors.textPrimary }}>
          {part.slice(2, -2)}
        </Text>
      );
    }

    // 斜体 *italic*
    if (part.startsWith('*') && part.endsWith('*')) {
      return (
        <Text key={idx} className="italic" style={{ color: colors.textSecondary }}>
          {part.slice(1, -1)}
        </Text>
      );
    }

    // 行内代码 `code`
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <Text
          key={idx}
          className="text-xs px-1.5 py-0.5 rounded font-mono"
          style={{ backgroundColor: colors.accentBg, color: colors.accent }}
        >
          {part.slice(1, -1)}
        </Text>
      );
    }

    // 对话人物高亮 (如 "学者："、"青年：")
    if (/(学者|青年|苏格拉底|斐多)[:：]/.test(part)) {
      return (
        <Text key={idx} className="font-bold tracking-wide" style={{ color: colors.accent }}>
          {part}
        </Text>
      );
    }

    return part;
  });
}
