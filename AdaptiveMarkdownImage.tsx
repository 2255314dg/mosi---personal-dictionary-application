import React, { useState, useEffect } from 'react';
import {
  View,
  LayoutChangeEvent,
  useWindowDimensions,
  ActivityIndicator,
  Modal,
  Pressable,
  Image as RNImage,
} from 'react-native';
import { Image } from 'expo-image';
import { useTheme } from '@/context/ThemeContext';
import { X, ZoomIn } from 'lucide-react-native';

interface AdaptiveMarkdownImageProps {
  uri: string;
}

export const AdaptiveMarkdownImage: React.FC<AdaptiveMarkdownImageProps> = ({ uri }) => {
  const { colors } = useTheme();
  const { width: windowWidth } = useWindowDimensions();

  // 默认容器宽度为屏幕宽度减去页面两侧 padding (通常为 32-40)
  const defaultWidth = Math.max(280, windowWidth - 40);
  const [containerWidth, setContainerWidth] = useState<number>(defaultWidth);

  // 默认将比例设为手机竖向照片标准比例 3/4 = 0.75，加载前不产生横向拉伸变形
  const [aspectRatio, setAspectRatio] = useState<number>(0.75);
  const [loaded, setLoaded] = useState<boolean>(false);
  const [previewVisible, setPreviewVisible] = useState<boolean>(false);

  // 微信小程序/各端兼容：优先通过 React Native 原生 Image.getSize 异步获取图片真实宽与高
  useEffect(() => {
    let isMounted = true;
    if (uri) {
      try {
        RNImage.getSize(
          uri,
          (w, h) => {
            if (isMounted && w > 0 && h > 0) {
              const r = w / h;
              setAspectRatio(r);
              setLoaded(true);
            }
          },
          () => {
            // 获取失败回退
          }
        );
      } catch {
        // ignore
      }

      // Fallback 超时机制：若 8 秒内未收到 onload 回调，强制停止 loading，使用标准 3/4 呈现
      const timer = setTimeout(() => {
        if (isMounted && !loaded) {
          setLoaded(true);
        }
      }, 8000);

      return () => {
        isMounted = false;
        clearTimeout(timer);
      };
    }
  }, [uri]);

  const handleLayout = (e: LayoutChangeEvent) => {
    const width = e.nativeEvent.layout.width;
    if (width > 0 && Math.abs(width - containerWidth) > 2) {
      setContainerWidth(width);
    }
  };

  // 根据容器宽度与真实图片宽高比计算出高度，不设固定高度或过小的截断限制
  const calculatedHeight = containerWidth > 0 && aspectRatio > 0 ? containerWidth / aspectRatio : undefined;

  return (
    <>
      <View
        onLayout={handleLayout}
        className="w-full rounded-2xl overflow-hidden border self-center relative"
        style={{
          width: '100%',
          maxWidth: '100%',
          marginVertical: 12,
          borderColor: colors.cardBorder,
          backgroundColor: colors.cardBg,
          minHeight: loaded ? undefined : 200,
        }}
      >
        {/* 图片加载状态指示器 */}
        {!loaded && (
          <View className="absolute inset-0 items-center justify-center z-10 py-10">
            <ActivityIndicator size="small" color={colors.accent} />
          </View>
        )}

        <Pressable
          onPress={() => setPreviewVisible(true)}
          className="w-full active:opacity-90"
        >
          <Image
            source={{ uri }}
            style={{
              width: '100%',
              maxWidth: '100%',
              height: calculatedHeight,
              aspectRatio: calculatedHeight ? undefined : aspectRatio,
            }}
            contentFit="contain"
            transition={300}
            onLoad={(e) => {
              setLoaded(true);
              if (e.source?.width && e.source?.height) {
                const ratio = e.source.width / e.source.height;
                if (ratio > 0) {
                  setAspectRatio(ratio);
                }
              }
            }}
            onError={() => {
              setLoaded(true);
            }}
          />

          {/* 右下角轻量放大提示指示 */}
          {loaded && (
            <View
              className="absolute bottom-2 right-2 p-1.5 rounded-full shadow"
              style={{ backgroundColor: 'rgba(0, 0, 0, 0.45)' }}
            >
              <ZoomIn size={14} color="#FFFFFF" />
            </View>
          )}
        </Pressable>
      </View>

      {/* 点击全屏大图预览弹窗（确保整张图超大清晰查看，不遗漏任何细节） */}
      <Modal
        visible={previewVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewVisible(false)}
      >
        <View className="flex-1 bg-black justify-center items-center relative">
          <Pressable
            onPress={() => setPreviewVisible(false)}
            className="absolute top-12 right-6 z-20 p-2.5 rounded-full bg-white/20 active:bg-white/40"
          >
            <X size={22} color="#FFFFFF" />
          </Pressable>

          <Pressable
            onPress={() => setPreviewVisible(false)}
            className="w-full h-full justify-center items-center px-2"
          >
            <Image
              source={{ uri }}
              style={{ width: '100%', height: '88%' }}
              contentFit="contain"
            />
          </Pressable>
        </View>
      </Modal>
    </>
  );
};
