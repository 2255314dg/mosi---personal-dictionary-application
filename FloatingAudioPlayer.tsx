import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  ScrollView,
  Animated,
  Easing,
  LayoutChangeEvent,
} from 'react-native';
import { useAudioPlayer, PlayMode } from '@/context/AudioPlayerContext';
import { useTheme } from '@/context/ThemeContext';
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Volume2,
  VolumeX,
  Volume1,
  Repeat,
  Repeat1,
  Shuffle,
  Music,
  ChevronDown,
  ListMusic,
  Disc,
} from 'lucide-react-native';

export const FloatingAudioPlayer: React.FC = () => {
  const {
    tracks,
    currentTrackIndex,
    currentTrack,
    isPlaying,
    position,
    duration,
    volume,
    playMode,
    togglePlay,
    nextTrack,
    prevTrack,
    selectTrack,
    seekTo,
    setVolume,
    togglePlayMode,
  } = useAudioPlayer();

  const { colors } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const [showList, setShowList] = useState(false);
  const [isMiniCollapsed, setIsMiniCollapsed] = useState(false);
  const [showVolumePanel, setShowVolumePanel] = useState(false);

  // 测量进度条与音量条宽度，确保精准计算
  const [progressBarWidth, setProgressBarWidth] = useState<number>(300);
  const [volumeBarWidth, setVolumeBarWidth] = useState<number>(200);

  // 3. 使用 Animated.Value 驱动高度动画，过渡时间 300ms，easing: Easing.inOut(Easing.ease)
  // 展开迷你栏高度 68px，收缩迷你条高度 50px
  const heightAnim = useRef(new Animated.Value(68)).current;

  useEffect(() => {
    Animated.timing(heightAnim, {
      toValue: isMiniCollapsed ? 50 : 68,
      duration: 300,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: false,
    }).start();
  }, [isMiniCollapsed, heightAnim]);

  // 3. 5秒无交互自动收缩为迷你条计时器（onPressIn / onTouchStart 重置）
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetIdleTimer = useCallback(() => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
    // 播放状态下，如果5秒内没有与播放器交互，自动收缩为迷你条
    if (isPlaying && !expanded) {
      idleTimerRef.current = setTimeout(() => {
        setIsMiniCollapsed(true);
      }, 5000);
    }
  }, [isPlaying, expanded]);

  useEffect(() => {
    resetIdleTimer();
    return () => {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
      }
    };
  }, [resetIdleTimer]);

  if (!currentTrack) return null;

  // 5. 时间格式化函数：如果 !duration || duration <= 0，返回 "00:00"
  const formatTime = (secs?: number) => {
    if (!secs || secs <= 0 || Number.isNaN(secs)) {
      return '00:00';
    }
    const safeSecs = Math.floor(secs);
    const m = Math.floor(safeSecs / 60);
    const s = safeSecs % 60;
    const mStr = m < 10 ? `0${m}` : `${m}`;
    const sStr = s < 10 ? `0${s}` : `${s}`;
    return `${mStr}:${sStr}`;
  };

  const getPlayModeIcon = () => {
    switch (playMode) {
      case 'single_loop':
        return <Repeat1 size={18} color={colors.accent} />;
      case 'random':
        return <Shuffle size={18} color={colors.accent} />;
      case 'list_loop':
      default:
        return <Repeat size={18} color={colors.accent} />;
    }
  };

  const getPlayModeText = () => {
    switch (playMode) {
      case 'single_loop':
        return '单曲循环';
      case 'random':
        return '随机播放';
      case 'sequence':
        return '顺序播放';
      case 'list_loop':
      default:
        return '列表循环';
    }
  };

  // 5. 进度安全计算：Slider value = positionMillis / (durationMillis || 1)，避免除以0
  const durationSecs = duration > 0 ? duration : (currentTrack.duration || 180);
  const positionSecs = position >= 0 ? position : 0;
  const sliderProgressRatio = Math.max(0, Math.min(1, positionSecs / (durationSecs || 1)));
  const progressPercent = sliderProgressRatio * 100;

  // 5. 拖动结束 seekTo：position = sliderValue * durationMillis
  const handleSeekPress = (e: any) => {
    resetIdleTimer();
    const { locationX } = e.nativeEvent;
    const width = progressBarWidth > 0 ? progressBarWidth : 300;
    const ratio = Math.max(0, Math.min(1, locationX / width));
    seekTo(ratio * durationSecs);
  };

  // 2. 音量滑块：value 是 0.0-1.0 的浮点数，不要取整，直接传递
  const handleVolumeBarPress = (e: any) => {
    resetIdleTimer();
    const { locationX } = e.nativeEvent;
    const width = volumeBarWidth > 0 ? volumeBarWidth : 200;
    const ratio = Math.max(0, Math.min(1, locationX / width));
    // step 为 0.01 精度
    const rawStepValue = Math.round(ratio / 0.01) * 0.01;
    const clamped = Math.max(0, Math.min(1, Number(rawStepValue.toFixed(2))));
    setVolume(clamped);
  };

  const getVolumeIcon = () => {
    if (volume <= 0.01) return <VolumeX size={18} color={colors.textSecondary} />;
    if (volume < 0.5) return <Volume1 size={18} color={colors.textSecondary} />;
    return <Volume2 size={18} color={colors.textSecondary} />;
  };

  return (
    <>
      {/* 底部悬浮控制条：使用 Animated.Value 驱动高度动画 */}
      <Animated.View
        className="absolute bottom-4 left-4 right-4 rounded-2xl shadow-lg border z-40 overflow-hidden"
        style={{
          height: heightAnim,
          backgroundColor: colors.cardBg,
          borderColor: colors.cardBorder,
        }}
        onTouchStart={resetIdleTimer}
      >
        {/* 顶部极细进度指示 */}
        <View className="h-0.5 w-full bg-black/5 overflow-hidden">
          <View
            className="h-full"
            style={{
              width: `${progressPercent}%`,
              backgroundColor: colors.accent,
            }}
          />
        </View>

        {isMiniCollapsed ? (
          /* 3. 迷你条：高度约50px，播放/暂停按钮居中固定，曲目名与状态围绕布局 */
          <Pressable
            className="flex-1 flex-row items-center px-3"
            style={{ position: 'relative' }}
            onPressIn={resetIdleTimer}
            onPress={() => {
              setIsMiniCollapsed(false);
              resetIdleTimer();
            }}
          >
            {/* 左侧曲目与旋转黑胶图标 */}
            <View className="flex-row items-center flex-1 mr-14">
              <View
                className="w-7 h-7 rounded-full items-center justify-center mr-2.5"
                style={{ backgroundColor: colors.accentBg }}
              >
                <Disc
                  size={16}
                  color={colors.accent}
                  style={{
                    transform: [{ rotate: isPlaying ? '45deg' : '0deg' }],
                  }}
                />
              </View>
              <Text
                numberOfLines={1}
                className="text-xs font-medium flex-1"
                style={{ color: colors.textPrimary }}
              >
                {currentTrack.title}
              </Text>
            </View>

            {/* 核心需求：播放/暂停图标按钮容器固定尺寸 44x44，永远绝对居中固定 */}
            <View
              pointerEvents="box-none"
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: 0,
                right: 0,
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <Pressable
                onPressIn={resetIdleTimer}
                onPress={(e) => {
                  e.stopPropagation();
                  togglePlay();
                  resetIdleTimer();
                }}
                className="active:opacity-80"
                style={{
                  width: 44,
                  height: 44,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <View
                  className="rounded-full shadow-sm"
                  style={{
                    width: 36,
                    height: 36,
                    backgroundColor: colors.accent,
                    position: 'relative',
                    justifyContent: 'center',
                    alignItems: 'center',
                    padding: 0,
                    margin: 0,
                  }}
                >
                  <View
                    pointerEvents="none"
                    style={{
                      position: 'absolute',
                      top: 0,
                      bottom: 0,
                      left: 0,
                      right: 0,
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}
                  >
                    {isPlaying ? (
                      <Pause size={18} color="#FFFFFF" />
                    ) : (
                      <Play size={18} color="#FFFFFF" fill="#FFFFFF" style={{ marginLeft: 5 }} />
                    )}
                  </View>
                </View>
              </Pressable>
            </View>

            {/* 右侧展开提示 */}
            <View className="ml-auto pl-2">
              <Text className="text-[10px]" style={{ color: colors.textMuted }}>
                展开
              </Text>
            </View>
          </Pressable>
        ) : (
          /* 悬浮面板：标准高度栏目，播放/暂停按钮居中固定，两侧环绕曲目信息与控制按键 */
          <View
            className="flex-1 flex-row items-center px-3 py-2"
            style={{ position: 'relative' }}
          >
            {/* 左侧曲目与旋转黑胶 */}
            <Pressable
              className="flex-row items-center flex-1 mr-14"
              onPressIn={resetIdleTimer}
              onPress={() => {
                setExpanded(true);
                setIsMiniCollapsed(false);
              }}
            >
              <View
                className="w-10 h-10 rounded-full items-center justify-center mr-3"
                style={{ backgroundColor: colors.accentBg }}
              >
                <Disc
                  size={20}
                  color={colors.accent}
                  style={{
                    transform: [{ rotate: isPlaying ? '45deg' : '0deg' }],
                  }}
                />
              </View>
              <View className="flex-1">
                <Text
                  numberOfLines={1}
                  className="text-sm font-semibold"
                  style={{ color: colors.textPrimary }}
                >
                  {currentTrack.title}
                </Text>
                <Text
                  numberOfLines={1}
                  className="text-xs"
                  style={{ color: colors.textMuted }}
                >
                  {currentTrack.artist} · 伴读音乐
                </Text>
              </View>
            </Pressable>

            {/* 核心需求：播放/暂停图标按钮容器固定尺寸 44x44，无论展开还是收缩，永远居于面板正中心 */}
            <View
              pointerEvents="box-none"
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: 0,
                right: 0,
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <Pressable
                onPressIn={resetIdleTimer}
                onPress={() => {
                  togglePlay();
                  resetIdleTimer();
                }}
                className="active:opacity-80"
                style={{
                  width: 44,
                  height: 44,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <View
                  className="rounded-full shadow-sm"
                  style={{
                    width: 36,
                    height: 36,
                    backgroundColor: colors.accent,
                    position: 'relative',
                    justifyContent: 'center',
                    alignItems: 'center',
                    padding: 0,
                    margin: 0,
                  }}
                >
                  <View
                    pointerEvents="none"
                    style={{
                      position: 'absolute',
                      top: 0,
                      bottom: 0,
                      left: 0,
                      right: 0,
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}
                  >
                    {isPlaying ? (
                      <Pause size={18} color="#FFFFFF" />
                    ) : (
                      <Play size={18} color="#FFFFFF" fill="#FFFFFF" style={{ marginLeft: 5 }} />
                    )}
                  </View>
                </View>
              </Pressable>
            </View>

            {/* 右侧上一曲/下一曲切换按键围绕居中播放按钮布局 */}
            <View className="flex-row items-center ml-auto">
              <Pressable
                onPressIn={resetIdleTimer}
                onPress={() => {
                  prevTrack();
                  resetIdleTimer();
                }}
                className="w-8 h-10 items-center justify-center active:opacity-60 mr-1"
              >
                <SkipBack size={18} color={colors.textSecondary} />
              </Pressable>

              <Pressable
                onPressIn={resetIdleTimer}
                onPress={() => {
                  nextTrack();
                  resetIdleTimer();
                }}
                className="w-8 h-10 items-center justify-center active:opacity-60"
              >
                <SkipForward size={18} color={colors.textSecondary} />
              </Pressable>
            </View>
          </View>
        )}
      </Animated.View>

      {/* 展开的完整全屏/大卡片播放器 Modal */}
      <Modal visible={expanded} transparent animationType="slide" onRequestClose={() => setExpanded(false)}>
        <View className="flex-1 justify-end bg-black/50">
          <View
            className="w-full rounded-t-3xl p-6 shadow-2xl"
            style={{
              backgroundColor: colors.cardBg,
              borderColor: colors.cardBorder,
              borderTopWidth: 1,
            }}
          >
            {/* 顶栏控制 */}
            <View className="flex-row items-center justify-between mb-6">
              <Pressable onPress={() => setExpanded(false)} className="p-1">
                <ChevronDown size={24} color={colors.textSecondary} />
              </Pressable>
              <Text className="text-base font-bold" style={{ color: colors.textPrimary }}>
                墨思 · 伴读留声机
              </Text>
              <Pressable onPress={() => setShowList(!showList)} className="p-1">
                <ListMusic size={22} color={showList ? colors.accent : colors.textSecondary} />
              </Pressable>
            </View>

            {showList ? (
              /* 播放列表视图 */
              <View className="h-72">
                <Text className="text-xs font-semibold mb-2" style={{ color: colors.textMuted }}>
                  播放队列 ({tracks.length}首)
                </Text>
                <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                  {tracks.map((track, idx) => {
                    const isCur = idx === currentTrackIndex;
                    return (
                      <Pressable
                        key={track.id || idx}
                        onPress={() => {
                          selectTrack(idx);
                          setShowList(false);
                        }}
                        className="flex-row items-center justify-between p-3 rounded-xl mb-1.5 border"
                        style={{
                          backgroundColor: isCur ? colors.accentBg : colors.bg,
                          borderColor: isCur ? colors.accent : colors.cardBorder,
                        }}
                      >
                        <View className="flex-row items-center flex-1 mr-2">
                          <Music size={16} color={isCur ? colors.accent : colors.textMuted} />
                          <View className="ml-3 flex-1">
                            <Text
                              numberOfLines={1}
                              className="text-sm font-medium"
                              style={{ color: isCur ? colors.accent : colors.textPrimary }}
                            >
                              {track.title}
                            </Text>
                            <Text numberOfLines={1} className="text-xs" style={{ color: colors.textMuted }}>
                              {track.artist}
                            </Text>
                          </View>
                        </View>
                        {isCur && isPlaying && (
                          <Text className="text-xs font-semibold" style={{ color: colors.accent }}>
                            播放中
                          </Text>
                        )}
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            ) : (
              /* 唱片大图与主播放界面 */
              <View className="items-center py-2">
                <View
                  className="w-44 h-44 rounded-full items-center justify-center shadow-xl border-4 mb-5"
                  style={{
                    backgroundColor: colors.bg,
                    borderColor: colors.cardBorder,
                  }}
                >
                  <View
                    className="w-36 h-36 rounded-full items-center justify-center border-2"
                    style={{ borderColor: colors.accentBg }}
                  >
                    <Disc
                      size={72}
                      color={colors.accent}
                      style={{
                        transform: [{ rotate: isPlaying ? '45deg' : '0deg' }],
                      }}
                    />
                  </View>
                </View>

                <Text className="text-lg font-bold mb-1" style={{ color: colors.textPrimary }}>
                  {currentTrack.title}
                </Text>
                <Text className="text-sm mb-4" style={{ color: colors.textMuted }}>
                  {currentTrack.artist}
                </Text>

                {/* 5. 进度条与时间：如果 !duration || duration <= 0，返回 00:00，避免除以0，拖动 seekTo */}
                <View className="w-full mb-3">
                  <Pressable
                    className="h-7 justify-center"
                    onLayout={(e: LayoutChangeEvent) => {
                      const w = e.nativeEvent.layout.width;
                      if (w > 0) setProgressBarWidth(w);
                    }}
                    onPress={handleSeekPress}
                  >
                    <View className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: colors.tagBg }}>
                      <View
                        className="h-full rounded-full"
                        style={{
                          width: `${progressPercent}%`,
                          backgroundColor: colors.accent,
                        }}
                      />
                    </View>
                  </Pressable>
                  <View className="flex-row justify-between mt-1">
                    <Text className="text-xs" style={{ color: colors.textMuted }}>
                      {formatTime(positionSecs)}
                    </Text>
                    <Text className="text-xs" style={{ color: colors.textMuted }}>
                      {formatTime(durationSecs)}
                    </Text>
                  </View>
                </View>

                {/* 控制按钮组 */}
                <View className="flex-row items-center justify-between w-full px-2 mb-3">
                  <Pressable onPress={togglePlayMode} className="p-2 items-center">
                    {getPlayModeIcon()}
                    <Text className="text-[10px] mt-1" style={{ color: colors.textMuted }}>
                      {getPlayModeText()}
                    </Text>
                  </Pressable>

                  <Pressable onPress={prevTrack} className="p-3 active:opacity-60">
                    <SkipBack size={26} color={colors.textPrimary} />
                  </Pressable>

                  {/* 1. 主播放/暂停按钮容器固定尺寸 64x64，flex 居中对齐 */}
                  <Pressable
                    onPress={togglePlay}
                    className="w-16 h-16 items-center justify-center"
                  >
                    <View
                      className="w-16 h-16 rounded-full items-center justify-center shadow-md active:opacity-80"
                      style={{ backgroundColor: colors.accent }}
                    >
                      {isPlaying ? (
                        <Pause size={30} color="#FFFFFF" />
                      ) : (
                        <Play size={30} color="#FFFFFF" fill="#FFFFFF" style={{ marginLeft: 5 }} />
                      )}
                    </View>
                  </Pressable>

                  <Pressable onPress={nextTrack} className="p-3 active:opacity-60">
                    <SkipForward size={26} color={colors.textPrimary} />
                  </Pressable>

                  <Pressable
                    onPress={() => setShowVolumePanel(!showVolumePanel)}
                    className="p-2 items-center"
                  >
                    {getVolumeIcon()}
                    <Text className="text-[10px] mt-1" style={{ color: colors.textMuted }}>
                      {Math.round(volume * 100)}%
                    </Text>
                  </Pressable>
                </View>

                {/* 2. 平滑音量调节条：0.0 - 1.0 浮点数，直接传递，step={0.01} */}
                {showVolumePanel && (
                  <View
                    className="w-full flex-row items-center px-4 py-2.5 rounded-xl border mt-1"
                    style={{ backgroundColor: colors.bg, borderColor: colors.cardBorder }}
                  >
                    <Pressable
                      onPress={() => {
                        const next = Math.max(0, Math.min(1, Number((volume - 0.05).toFixed(2))));
                        setVolume(next);
                      }}
                      className="p-1 active:opacity-60"
                    >
                      <VolumeX size={16} color={colors.textSecondary} />
                    </Pressable>
                    <Pressable
                      className="flex-1 mx-3 h-6 justify-center"
                      onLayout={(e: LayoutChangeEvent) => {
                        const w = e.nativeEvent.layout.width;
                        if (w > 0) setVolumeBarWidth(w);
                      }}
                      onPress={handleVolumeBarPress}
                    >
                      <View className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: colors.tagBg }}>
                        <View
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.round(volume * 100)}%`,
                            backgroundColor: colors.accent,
                          }}
                        />
                      </View>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        const next = Math.max(0, Math.min(1, Number((volume + 0.05).toFixed(2))));
                        setVolume(next);
                      }}
                      className="p-1 active:opacity-60"
                    >
                      <Volume2 size={16} color={colors.textSecondary} />
                    </Pressable>
                    <Text className="text-xs font-medium ml-2 w-10 text-right" style={{ color: colors.textPrimary }}>
                      {Math.round(volume * 100)}%
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
};
