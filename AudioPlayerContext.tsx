import React, { createContext, useContext, useState, useEffect, useRef } from 'react';

export interface Track {
  id: string;
  title: string;
  artist: string;
  url: string;
  duration?: number;
}

export type PlayMode = 'sequence' | 'list_loop' | 'single_loop' | 'random';

// 5首内置高可用伴读音乐（采用自建 Supabase Storage 托管，保障微信小程序与各端稳定发声）
export const BUILTIN_TRACKS: Track[] = [
  {
    id: 'track_1',
    title: '静心思辨',
    artist: '墨思伴读',
    url: 'https://backend.miaoda.online/projects/supabase361364904269103104/storage/v1/object/public/music/SoundHelix-Song-1.mp3',
    duration: 180,
  },
  {
    id: 'track_2',
    title: '微风与古卷',
    artist: '墨思伴读',
    url: 'https://backend.miaoda.online/projects/supabase361364904269103104/storage/v1/object/public/music/SoundHelix-Song-2.mp3',
    duration: 210,
  },
  {
    id: 'track_3',
    title: '深邃夜思',
    artist: '墨思伴读',
    url: 'https://backend.miaoda.online/projects/supabase361364904269103104/storage/v1/object/public/music/SoundHelix-Song-3.mp3',
    duration: 240,
  },
  {
    id: 'track_4',
    title: '晨曦之悟',
    artist: '墨思伴读',
    url: 'https://backend.miaoda.online/projects/supabase361364904269103104/storage/v1/object/public/music/SoundHelix-Song-4.mp3',
    duration: 195,
  },
  {
    id: 'track_5',
    title: '时间的河流',
    artist: '墨思伴读',
    url: 'https://backend.miaoda.online/projects/supabase361364904269103104/storage/v1/object/public/music/SoundHelix-Song-5.mp3',
    duration: 220,
  },
];

interface AudioPlayerContextType {
  tracks: Track[];
  currentTrackIndex: number;
  currentTrack: Track | null;
  isPlaying: boolean;
  position: number;
  duration: number;
  volume: number;
  playMode: PlayMode;
  isExpanded: boolean;
  setIsExpanded: (expanded: boolean) => void;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  nextTrack: () => void;
  prevTrack: () => void;
  selectTrack: (index: number) => void;
  seekTo: (seconds: number) => void;
  setVolume: (val: number) => void;
  togglePlayMode: () => void;
  addCustomTrack: (track: Track) => void;
  removeTrack: (id: string) => void;
}

const AudioPlayerContext = createContext<AudioPlayerContextType>({
  tracks: BUILTIN_TRACKS,
  currentTrackIndex: 0,
  currentTrack: BUILTIN_TRACKS[0],
  isPlaying: false,
  position: 0,
  duration: 180,
  volume: 0.8,
  playMode: 'list_loop',
  isExpanded: false,
  setIsExpanded: () => {},
  play: () => {},
  pause: () => {},
  togglePlay: () => {},
  nextTrack: () => {},
  prevTrack: () => {},
  selectTrack: () => {},
  seekTo: () => {},
  setVolume: () => {},
  togglePlayMode: () => {},
  addCustomTrack: () => {},
  removeTrack: () => {},
});

export const AudioPlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tracks, setTracks] = useState<Track[]>(BUILTIN_TRACKS);
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [position, setPosition] = useState<number>(0);
  const [duration, setDuration] = useState<number>(180);
  const [volume, setVolumeState] = useState<number>(0.8);
  const [playMode, setPlayMode] = useState<PlayMode>('list_loop');
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  // Web Audio Element
  const webAudioRef = useRef<HTMLAudioElement | null>(null);

  // 微信小程序原生背景音频或内部音频实例适配引用
  const wxAudioRef = useRef<any>(null);

  // Load saved state from storage
  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const savedIndex = window.localStorage.getItem('mosi_music_index');
        const savedVolume = window.localStorage.getItem('mosi_music_volume');
        const savedMode = window.localStorage.getItem('mosi_music_mode');
        const savedCustom = window.localStorage.getItem('mosi_custom_tracks');

        if (savedIndex !== null) setCurrentTrackIndex(Number(savedIndex) || 0);
        if (savedVolume !== null) setVolumeState(Number(savedVolume) || 0.8);
        if (savedMode) setPlayMode(savedMode as PlayMode);
        if (savedCustom) {
          const parsed = JSON.parse(savedCustom);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setTracks([...BUILTIN_TRACKS, ...parsed]);
          }
        }
      }
    } catch {
      // ignore
    }
  }, []);

  const currentTrack = tracks[currentTrackIndex] || tracks[0] || null;

  // 微信小程序环境兼容检测与初始化
  useEffect(() => {
    try {
      const globalObj = typeof globalThis !== 'undefined' ? (globalThis as any) : (typeof window !== 'undefined' ? (window as any) : null);
      const wxGlobal = globalObj?.wx;
      if (wxGlobal) {
        // 设置后台播放支持
        if (typeof wxGlobal.setAudioMode === 'function') {
          wxGlobal.setAudioMode({
            staysActiveInBackground: true,
            mixWithOtherAudio: false,
          });
        }
        if (typeof wxGlobal.getBackgroundAudioManager === 'function') {
          wxAudioRef.current = wxGlobal.getBackgroundAudioManager();
          const bgAudio = wxAudioRef.current;
          bgAudio.onTimeUpdate(() => {
            const cur = bgAudio.currentTime;
            if (typeof cur === 'number' && !Number.isNaN(cur)) {
              setPosition(cur);
            }
            const dur = bgAudio.duration;
            if (typeof dur === 'number' && !Number.isNaN(dur) && dur > 0) {
              setDuration(dur);
            }
          });
          bgAudio.onEnded(() => {
            handleTrackEnded();
          });
          bgAudio.onError((res: any) => {
            console.warn('WX Audio Error:', res);
            // 发生错误时自动切下一首
            handleTrackEnded();
          });
        }
      }
    } catch (e) {
      console.warn('WX audio init error', e);
    }
  }, []);

  // Web / H5 / WebView 原生播放器生命周期与事件监听
  useEffect(() => {
    if (typeof window === 'undefined' || typeof Audio === 'undefined') return;

    if (!webAudioRef.current) {
      webAudioRef.current = new Audio();
      webAudioRef.current.preload = 'auto';
    }
    const audio = webAudioRef.current;

    const onTimeUpdate = () => {
      const cur = audio.currentTime;
      if (typeof cur === 'number' && !Number.isNaN(cur)) {
        setPosition(cur);
      }
      const dur = audio.duration;
      if (typeof dur === 'number' && !Number.isNaN(dur) && dur > 0) {
        setDuration(dur);
      }
    };

    const onEnded = () => {
      handleTrackEnded();
    };

    const onError = (e: any) => {
      console.warn('Audio playback error event, switching to next track:', e);
      handleTrackEnded();
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
    };
  }, [playMode, tracks, currentTrackIndex]);

  // 音频曲目切换与播放/暂停控制（附带15秒无响应超时保护）
  useEffect(() => {
    if (typeof window === 'undefined' || typeof Audio === 'undefined') return;
    const audio = webAudioRef.current;
    if (!audio || !currentTrack) return;

    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    if (audio.src !== currentTrack.url) {
      audio.src = currentTrack.url;
      audio.load();
      setPosition(0);
    }
    audio.volume = Math.max(0, Math.min(1, volume));

    if (isPlaying) {
      // 15秒音频加载/播放超时检测
      timeoutId = setTimeout(() => {
        if (audio.readyState < 2 && audio.currentTime === 0) {
          console.warn('Audio 15s load timeout, auto nextTrack:', currentTrack.title);
          handleTrackEnded();
        }
      }, 15000);

      audio.play().catch((err) => {
        console.warn('Audio play() rejected or interrupted:', err);
      });
    } else {
      audio.pause();
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [currentTrack, isPlaying, volume]);

  // 定时器辅助（处理部分无时长上报的流）
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (isPlaying && (!webAudioRef.current || !webAudioRef.current.duration)) {
      interval = setInterval(() => {
        setPosition((prev) => {
          if (prev >= duration) {
            handleTrackEnded();
            return 0;
          }
          return prev + 1;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying, duration, currentTrackIndex]);

  const handleTrackEnded = () => {
    if (playMode === 'single_loop') {
      if (webAudioRef.current) {
        webAudioRef.current.currentTime = 0;
        webAudioRef.current.play().catch(() => {});
      }
      if (wxAudioRef.current && currentTrack) {
        wxAudioRef.current.src = currentTrack.url;
        wxAudioRef.current.title = currentTrack.title;
      }
      setPosition(0);
    } else if (playMode === 'random') {
      const randomIndex = Math.floor(Math.random() * tracks.length);
      setCurrentTrackIndex(randomIndex);
    } else if (playMode === 'list_loop') {
      setCurrentTrackIndex((prev) => (prev + 1) % tracks.length);
    } else {
      if (currentTrackIndex < tracks.length - 1) {
        setCurrentTrackIndex((prev) => prev + 1);
      } else {
        setIsPlaying(false);
      }
    }
  };

  const play = () => {
    setIsPlaying(true);
    // 微信小程序背景音频
    if (wxAudioRef.current && currentTrack) {
      wxAudioRef.current.title = currentTrack.title;
      wxAudioRef.current.epname = '墨思伴读';
      wxAudioRef.current.singer = currentTrack.artist;
      wxAudioRef.current.src = currentTrack.url;
      return;
    }

    if (webAudioRef.current) {
      webAudioRef.current.play().catch(() => {});
    }
  };

  const pause = () => {
    setIsPlaying(false);
    if (wxAudioRef.current) {
      wxAudioRef.current.pause();
    }
    if (webAudioRef.current) {
      webAudioRef.current.pause();
    }
  };

  const togglePlay = () => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  };

  const nextTrack = () => {
    if (playMode === 'random') {
      const randomIndex = Math.floor(Math.random() * tracks.length);
      setCurrentTrackIndex(randomIndex);
    } else {
      setCurrentTrackIndex((prev) => (prev + 1) % tracks.length);
    }
    setPosition(0);
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('mosi_music_index', String((currentTrackIndex + 1) % tracks.length));
    }
  };

  const prevTrack = () => {
    setCurrentTrackIndex((prev) => (prev - 1 + tracks.length) % tracks.length);
    setPosition(0);
  };

  const selectTrack = (index: number) => {
    if (index >= 0 && index < tracks.length) {
      setCurrentTrackIndex(index);
      setPosition(0);
      setIsPlaying(true);
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('mosi_music_index', String(index));
      }
    }
  };

  const seekTo = (seconds: number) => {
    if (typeof seconds !== 'number' || Number.isNaN(seconds) || seconds < 0) {
      return;
    }
    const maxDur = duration > 0 ? duration : 180;
    const clamped = Math.min(seconds, maxDur);
    setPosition(clamped);
    if (webAudioRef.current) {
      try {
        webAudioRef.current.currentTime = clamped;
      } catch (e) {
        console.warn('Seek error:', e);
      }
    }
    if (wxAudioRef.current && typeof wxAudioRef.current.seek === 'function') {
      try {
        wxAudioRef.current.seek(clamped);
      } catch (e) {
        console.warn('WX seek error:', e);
      }
    }
  };

  const setVolume = (val: number) => {
    if (typeof val !== 'number' || Number.isNaN(val)) return;
    const clamped = Math.max(0, Math.min(1, val));
    setVolumeState(clamped);
    if (webAudioRef.current) {
      webAudioRef.current.volume = clamped;
    }
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('mosi_music_volume', String(clamped));
    }
  };

  const togglePlayMode = () => {
    const modes: PlayMode[] = ['sequence', 'list_loop', 'single_loop', 'random'];
    const nextIdx = (modes.indexOf(playMode) + 1) % modes.length;
    const nextMode = modes[nextIdx];
    setPlayMode(nextMode);
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('mosi_music_mode', nextMode);
    }
  };

  const addCustomTrack = (track: Track) => {
    const newTracks = [...tracks, track];
    setTracks(newTracks);
    const customList = newTracks.filter((t) => !BUILTIN_TRACKS.some((b) => b.id === t.id));
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('mosi_custom_tracks', JSON.stringify(customList));
    }
  };

  const removeTrack = (id: string) => {
    const newTracks = tracks.filter((t) => t.id !== id);
    if (newTracks.length === 0) return;
    setTracks(newTracks);
    if (currentTrackIndex >= newTracks.length) {
      setCurrentTrackIndex(0);
    }
  };

  return (
    <AudioPlayerContext.Provider
      value={{
        tracks,
        currentTrackIndex,
        currentTrack,
        isPlaying,
        position: typeof position === 'number' && !Number.isNaN(position) ? position : 0,
        duration: typeof duration === 'number' && !Number.isNaN(duration) && duration > 0 ? duration : (currentTrack?.duration || 180),
        volume,
        playMode,
        isExpanded,
        setIsExpanded,
        play,
        pause,
        togglePlay,
        nextTrack,
        prevTrack,
        selectTrack,
        seekTo,
        setVolume,
        togglePlayMode,
        addCustomTrack,
        removeTrack,
      }}
    >
      {children}
    </AudioPlayerContext.Provider>
  );
};

export const useAudioPlayer = () => useContext(AudioPlayerContext);
