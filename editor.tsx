import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import {
  saveJournal,
  getJournalById,
  getJournalVersions,
  JournalVersion,
  detectContentType,
  uploadJournalImage,
  getTagCatalogDB,
  checkIsAdmin,
  TagItem,
} from '@/services/api';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { getEditorDraft, saveEditorDraft, clearEditorDraft } from '@/utils/backup';
import { getSecurityPolicyDB } from '@/services/api';
import {
  ChevronLeft,
  Undo2,
  Redo2,
  Type,
  Palette,
  ChevronDown,
  Save,
  Bold,
  Italic,
  Code,
  Heading2,
  Heading3,
  Quote,
  List,
  Minus,
  Underline,
  Image as ImageIcon,
  Images,
  History,
  FileText,
  Link,
  Table,
  Terminal,
  Check,
  X,
  Compass,
  Smile,
  Sun,
  MapPin,
  AlertCircle,
} from 'lucide-react-native';

export default function EditorScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { colors } = useTheme();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [themeTags, setThemeTags] = useState<string[]>(['自我认知']);
  const [moodTag, setMoodTag] = useState('平静');
  const [weatherTag, setWeatherTag] = useState('晴');
  const [locationTag, setLocationTag] = useState('许昌');
  const [versionNote, setVersionNote] = useState('');
  const contentInputRef = useRef<TextInput>(null);
  const historyRef = useRef<{ past: string[]; future: string[] }>({ past: [], future: [] });
  const historyReadyRef = useRef(false);
  const [historyVersion, setHistoryVersion] = useState(0);
  const [autosaveStatus, setAutosaveStatus] = useState('');
  const [selectedFont, setSelectedFont] = useState('system');
  const [selectedColor, setSelectedColor] = useState('#FFFFFF');
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [quoteSpeaker, setQuoteSpeaker] = useState('');
  const [quoteText, setQuoteText] = useState('');
  const [showFontModal, setShowFontModal] = useState(false);
  const [showColorModal, setShowColorModal] = useState(false);

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  // 插入超链接弹窗
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkText, setLinkText] = useState('');
  const [linkUrl, setLinkUrl] = useState('');

  // 插入表格弹窗
  const [showTableModal, setShowTableModal] = useState(false);
  const [tableRows, setTableRows] = useState('3');
  const [tableCols, setTableCols] = useState('3');

  // 插入代码块弹窗
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [showCodeLanguagePicker, setShowCodeLanguagePicker] = useState(false);
  const [codeLanguage, setCodeLanguage] = useState('typescript');
  const [codeContent, setCodeContent] = useState('');

  // 插入图片/链接弹窗
  const [showImageModal, setShowImageModal] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [imageAlt, setImageAlt] = useState('');

  // 从相册选择照片并上传状态
  const [uploadingGalleryImages, setUploadingGalleryImages] = useState(false);
  const [galleryUploadError, setGalleryUploadError] = useState('');
  // 记录光标位置（selection）
  const [cursorSelection, setCursorSelection] = useState<{ start: number; end: number }>({
    start: 0,
    end: 0,
  });

  // 文档/链接导入弹窗
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState('');

  // 历史版本弹窗
  const [showVersionModal, setShowVersionModal] = useState(false);
  const [versions, setVersions] = useState<JournalVersion[]>([]);

  // 动态分类标签（从数据库加载）
  const [catalogTags, setCatalogTags] = useState<TagItem[]>([]);
  const themeItems = catalogTags.filter((t) => t.category === 'theme');
  const moodItems = catalogTags.filter((t) => t.category === 'mood');
  const weatherItems = catalogTags.filter((t) => t.category === 'weather');

  const availableThemes = themeItems.map((t) => t.name);
  const availableMoods = moodItems.map((t) => t.name);
  const availableWeathers = weatherItems.map((t) => t.name);

  // 加载已有日志内容与标签字典
  useEffect(() => {
    (async () => {
      if (!(await checkIsAdmin())) {
        router.replace('/' as any);
        return;
      }
      const tags = await getTagCatalogDB();
      setCatalogTags(tags);

      if (!id) {
        const draft = await getEditorDraft();
        if (draft && (draft.title || draft.content)) {
          setTitle(draft.title || '');
          setContent(draft.content || '');
          historyReadyRef.current = true;
          setAutosaveStatus(`已恢复本机草稿 · ${new Date(draft.savedAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}`);
        } else {
          historyReadyRef.current = true;
        }
      }

      if (id) {
        setLoading(true);
        Promise.all([getJournalById(id), getJournalVersions(id)])
          .then(([j, vList]) => {
            if (j) {
              setTitle(j.title);
              setContent(j.content);
              historyRef.current = { past: [], future: [] };
              historyReadyRef.current = true;
              if (j.theme_tags?.length) setThemeTags(j.theme_tags);
              if (j.mood_tag) setMoodTag(j.mood_tag);
              if (j.weather_tag) setWeatherTag(j.weather_tag);
              if (j.location_tag) setLocationTag(j.location_tag);
            }
            setVersions(vList);
          })
          .finally(() => setLoading(false));
      }
    })();
  }, [id]);

  // 在光标处插入文本（如果未定位光标，则默认追加到末尾）
  const updateContent = (next: string) => {
    setContent((prev) => {
      if (prev === next) return prev;
      if (historyReadyRef.current) {
        historyRef.current.past.push(prev);
        if (historyRef.current.past.length > 100) historyRef.current.past.shift();
        historyRef.current.future = [];
        setHistoryVersion(v => v + 1);
      }
      return next;
    });
  };

  const insertAtCursor = (textToInsert: string) => {
    const { start, end } = cursorSelection;
    const before = content.slice(0, Math.max(0, start));
    const after = content.slice(Math.max(start, end));
    const next = before + textToInsert + after;
    updateContent(next);
    const caret = before.length + textToInsert.length;
    requestAnimationFrame(() => contentInputRef.current?.focus());
    setTimeout(() => setCursorSelection({ start: caret, end: caret }), 0);
  };

  const undo = () => {
    const past = historyRef.current.past;
    if (!past.length) return;
    const previous = past[past.length - 1];
    historyRef.current.past = past.slice(0, -1);
    historyRef.current.future.unshift(content);
    setContent(previous);
    setHistoryVersion(v => v + 1);
  };

  const redo = () => {
    const future = historyRef.current.future;
    if (!future.length) return;
    const next = future[0];
    historyRef.current.future = future.slice(1);
    historyRef.current.past.push(content);
    setContent(next);
    setHistoryVersion(v => v + 1);
  };

  // 快捷在光标处插入 Markdown 语法
  const insertSyntax = (prefix: string, suffix = '') => {
    const { start, end } = cursorSelection;
    if (typeof start === 'number' && start >= 0 && end > start && start <= content.length) {
      // 包含选中文本，包裹选中文本
      const selected = content.slice(start, end);
      insertAtCursor(prefix + selected + suffix);
    } else {
      insertAtCursor(prefix + suffix);
    }
  };

  // 点击下划线：直接在光标处插入下划线语法 (类似 Ctrl+U)
  const handleUnderlinePress = () => {
    const { start, end } = cursorSelection;
    if (typeof start === 'number' && start >= 0 && end > start && start <= content.length) {
      const selected = content.slice(start, end);
      insertAtCursor(`<u>${selected}</u>`);
    } else {
      insertAtCursor('<u></u>');
    }
  };

  // 调起超链接插入弹窗
  const openLinkModal = () => {
    const { start, end } = cursorSelection;
    if (typeof start === 'number' && start >= 0 && end > start && start <= content.length) {
      setLinkText(content.slice(start, end));
    } else {
      setLinkText('');
    }
    setLinkUrl('');
    setShowLinkModal(true);
  };

  // 插入超链接
  const handleInsertLink = () => {
    if (!linkUrl.trim()) return;
    const txt = linkText.trim() || '链接说明';
    const url = linkUrl.trim();
    insertAtCursor(`[${txt}](${url})`);
    setShowLinkModal(false);
  };

  // 插入表格
  const handleInsertTable = () => {
    const r = Math.max(1, parseInt(tableRows, 10) || 3);
    const c = Math.max(1, parseInt(tableCols, 10) || 3);
    let md = '\n';
    // 表头
    md += '| ' + Array.from({ length: c }, (_, i) => '').join(' | ') + ' |\n';
    // 分割线
    md += '| ' + Array.from({ length: c }, () => '---').join(' | ') + ' |\n';
    // 数据行
    for (let i = 0; i < r; i++) {
      md += '| ' + Array.from({ length: c }, (_, j) => '').join(' | ') + ' |\n';
    }
    md += '\n';
    insertAtCursor(md);
    setShowTableModal(false);
  };

  // 插入代码块
  const handleInsertCode = () => {
    const lang = codeLanguage.trim() || 'text';
    const body = codeContent;
    const md = `\n\`\`\`${lang}\n${body}\n\`\`\`\n`;
    insertAtCursor(md);
    setShowCodeModal(false);
    setCodeContent('');
  };

  // 插入图片 (URL 模式)
  const handleInsertImage = () => {
    if (!imageUrl.trim()) return;
    const markdown = `\n\n![${imageAlt.trim() || '思辨配图'}](${imageUrl.trim()})\n\n`;
    insertAtCursor(markdown);
    setShowImageModal(false);
    setImageUrl('');
    setImageAlt('');
  };

  // 从手机相册选择照片（支持多选）并压缩上传到 journal-images
  const handlePickFromGallery = async () => {
    setGalleryUploadError('');
    try {
      // 1. 请求相册读取权限
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        setGalleryUploadError('需要相册访问权限以挑选配图，请在系统设置中开启');
        return;
      }

      // 2. 启动相册选择器（支持多选，若平台支持）
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        quality: 0.8,
        selectionLimit: 5,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      setUploadingGalleryImages(true);
      const uploadedMarkdownList: string[] = [];

      for (const asset of result.assets) {
        try {
          // 3. 压缩图片至合适尺寸与体积
          const manipResult = await manipulateAsync(
            asset.uri,
            [{ resize: { width: 1280 } }],
            { compress: 0.75, format: SaveFormat.JPEG }
          );

          // 4. 上传至 Storage journal-images bucket
          const publicUrl = await uploadJournalImage(manipResult.uri, `${(asset.fileName || 'photo').replace(/\.[^/.]+$/, '')}.jpg`);
          const altName = asset.fileName?.replace(/\.[^/.]+$/, '') || '思辨配图';
          uploadedMarkdownList.push(`\n\n![${altName}](${publicUrl})\n\n`);
        } catch (uploadErr: any) {
          console.warn('单张图片上传失败:', uploadErr);
        }
      }

      if (uploadedMarkdownList.length > 0) {
        // 5. 在光标处插入 Markdown 图片语法
        insertAtCursor(uploadedMarkdownList.join(''));
      } else {
        setGalleryUploadError('图片上传失败，请重试');
      }
    } catch (err: any) {
      setGalleryUploadError(err?.message || '读取或上传相册照片失败');
    } finally {
      setUploadingGalleryImages(false);
    }
  };

  // 导入文档内容
  const handleImportContent = () => {
    if (!importText.trim()) return;
    setContent((prev) => prev + (prev ? '\n\n' : '') + importText.trim());
    setShowImportModal(false);
    setImportText('');
  };

  // 切换主题标签
  const toggleThemeTag = (tag: string) => {
    if (themeTags.includes(tag)) {
      setThemeTags(themeTags.filter((t) => t !== tag));
    } else {
      setThemeTags([...themeTags, tag]);
    }
  };

  // 保存日志
  const handleSave = async () => {
    if (!content.trim()) return;
    setSaving(true);
    try {
      const res = await saveJournal({
        id: id || undefined,
        title: title.trim(),
        content: content.trim(),
        content_type: detectContentType(content),
        theme_tags: themeTags,
        mood_tag: moodTag,
        weather_tag: weatherTag,
        location_tag: locationTag,
        version_note: versionNote.trim() || (id ? '修订思考' : '首次记述'),
      });

      if (res.data) {
        await clearEditorDraft();
        setAutosaveStatus('已保存');
        setSaveSuccess(true);
        setTimeout(() => {
          setSaveSuccess(false);
          router.replace('/');
        }, 1000);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const applyTextStyle = (font?: string, color?: string) => {
    const { start, end } = cursorSelection;
    if (!(end > start)) return;
    const selected = content.slice(start, end);
    const attrs = [color ? `data-mosi-color="${color}"` : '', font ? `data-mosi-font="${font}"` : ''].filter(Boolean).join(' ');
    insertAtCursor(`<span ${attrs}>${selected}</span>`);
  };

  const editorSnapshotRef = useRef({ title:'', content:'', themeTags:['自我认知'] as string[], moodTag:'平静', weatherTag:'晴', locationTag:'许昌' });
  useEffect(() => { editorSnapshotRef.current = { title, content, themeTags, moodTag, weatherTag, locationTag }; }, [title, content, themeTags, moodTag, weatherTag, locationTag]);

  // 至少每30秒保存一次：本地加密草稿 + 已有文章云端静默保存；自动保存不创建版本历史。
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    (async () => {
      const policy = await getSecurityPolicyDB();
      const interval = Math.max(30, Number(policy?.autosave_interval_seconds || 30));
      const tick = async () => {
        const snap = editorSnapshotRef.current;
        if (!snap.content.trim() && !snap.title.trim()) return;
        await saveEditorDraft({ id: id || undefined, title:snap.title, content:snap.content, savedAt:Date.now() });
        if (id && snap.content.trim()) {
          const res = await saveJournal({ id, title:snap.title.trim(), content:snap.content.trim(), content_type:detectContentType(snap.content), theme_tags:snap.themeTags, mood_tag:snap.moodTag, weather_tag:snap.weatherTag, location_tag:snap.locationTag, version_note:'自动保存', createVersion:false });
          setAutosaveStatus(res.error ? '本地草稿已保存，云端稍后重试' : `自动保存 · ${new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}`);
        } else setAutosaveStatus(`本地自动保存 · ${new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}`);
      };
      timer = setInterval(tick, interval * 1000);
    })();
    return () => { if (timer) clearInterval(timer); };
  }, [id]);

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center" style={{ backgroundColor: colors.bg }}>
        <ActivityIndicator size="large" color={colors.accent} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} className="flex-1" style={{ backgroundColor: colors.bg }}>
      {/* 顶部操作条 */}
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
            取消
          </Text>
        </Pressable>

        <Text className="text-base font-bold" style={{ color: colors.textPrimary }}>
          {id ? '编辑思辨日志' : '抒写思辨长卷'}
        </Text>

        <View className="flex-row items-center gap-2">
          {id && versions.length > 0 && (
            <Pressable
              onPress={() => setShowVersionModal(true)}
              className="p-2 rounded-full border active:opacity-70"
              style={{ borderColor: colors.cardBorder, backgroundColor: colors.cardBg }}
            >
              <History size={16} color={colors.accent} />
            </Pressable>
          )}

          <Pressable
            onPress={handleSave}
            disabled={saving || !content.trim()}
            className="flex-row items-center px-4 py-1.5 rounded-full active:opacity-85 shadow"
            style={{
              backgroundColor: content.trim() ? colors.accent : colors.tagBg,
            }}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : saveSuccess ? (
              <Check size={16} color="#FFFFFF" />
            ) : (
              <>
                <Save size={15} color={content.trim() ? '#FFFFFF' : colors.textMuted} />
                <Text
                  className="text-xs font-bold ml-1"
                  style={{ color: content.trim() ? '#FFFFFF' : colors.textMuted }}
                >
                  发布
                </Text>
              </>
            )}
          </Pressable>
        </View>
      </View>

      {/* 富文本排版快捷工具栏 */}
      <View
        className="px-3 py-2 border-b flex-row items-center justify-between"
        style={{ backgroundColor: colors.bg, borderColor: colors.cardBorder }}
      >
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-1"><Pressable onPress={undo} disabled={!historyRef.current.past.length} className="p-1.5 rounded-lg border mr-2" style={{ backgroundColor:colors.cardBg, borderColor:colors.cardBorder, opacity:historyRef.current.past.length?1:.4 }}><Undo2 size={16} color={colors.textPrimary}/></Pressable><Pressable onPress={redo} disabled={!historyRef.current.future.length} className="p-1.5 rounded-lg border mr-2" style={{ backgroundColor:colors.cardBg, borderColor:colors.cardBorder, opacity:historyRef.current.future.length?1:.4 }}><Redo2 size={16} color={colors.textPrimary}/></Pressable><Pressable onPress={()=>setShowFontModal(true)} className="flex-row items-center px-2 py-1 rounded-lg border mr-2" style={{backgroundColor:colors.cardBg,borderColor:colors.cardBorder}}><Type size={14} color={colors.textPrimary}/><Text className="text-xs ml-1" style={{color:colors.textPrimary}}>字体</Text><ChevronDown size={12} color={colors.textMuted}/></Pressable><Pressable onPress={()=>setShowColorModal(true)} className="flex-row items-center px-2 py-1 rounded-lg border mr-2" style={{backgroundColor:colors.cardBg,borderColor:colors.cardBorder}}><Palette size={14} color={selectedColor === '#FFFFFF' ? colors.textPrimary : selectedColor}/><Text className="text-xs ml-1" style={{color:colors.textPrimary}}>文字色</Text></Pressable>
          {/* 下划线直接插入按钮 (Ctrl+U 效果，不再弹出7种样式选择) */}
          <Pressable
            onPress={handleUnderlinePress}
            className="flex-row items-center px-2 py-1 rounded-lg border mr-2"
            style={{ backgroundColor: colors.cardBg, borderColor: colors.cardBorder }}
          >
            <Underline size={15} color={colors.textPrimary} />
            <Text className="text-xs ml-1" style={{ color: colors.textPrimary }}>
              下划线
            </Text>
          </Pressable>

          {/* 超链接插入按钮 */}
          <Pressable
            onPress={openLinkModal}
            className="flex-row items-center px-2 py-1 rounded-lg border mr-2"
            style={{ backgroundColor: colors.cardBg, borderColor: colors.cardBorder }}
          >
            <Link size={15} color={colors.textPrimary} />
            <Text className="text-xs ml-1" style={{ color: colors.textPrimary }}>
              超链接
            </Text>
          </Pressable>

          {/* 表格插入按钮 */}
          <Pressable
            onPress={() => setShowTableModal(true)}
            className="flex-row items-center px-2 py-1 rounded-lg border mr-2"
            style={{ backgroundColor: colors.cardBg, borderColor: colors.cardBorder }}
          >
            <Table size={15} color={colors.textPrimary} />
            <Text className="text-xs ml-1" style={{ color: colors.textPrimary }}>
              表格
            </Text>
          </Pressable>

          {/* 代码块插入按钮 */}
          <Pressable
            onPress={() => setShowCodeModal(true)}
            className="flex-row items-center px-2 py-1 rounded-lg border mr-2"
            style={{ backgroundColor: colors.cardBg, borderColor: colors.cardBorder }}
          >
            <Terminal size={15} color={colors.textPrimary} />
            <Text className="text-xs ml-1" style={{ color: colors.textPrimary }}>
              代码块
            </Text>
          </Pressable>

          <Pressable
            onPress={() => insertSyntax('## 标题二\n')}
            className="p-1.5 rounded-lg border mr-2"
            style={{ backgroundColor: colors.cardBg, borderColor: colors.cardBorder }}
          >
            <Heading2 size={16} color={colors.textPrimary} />
          </Pressable>

          <Pressable
            onPress={() => insertSyntax('### 标题三\n')}
            className="p-1.5 rounded-lg border mr-2"
            style={{ backgroundColor: colors.cardBg, borderColor: colors.cardBorder }}
          >
            <Heading3 size={16} color={colors.textPrimary} />
          </Pressable>

          <Pressable
            onPress={() => setShowQuoteModal(true)}
            className="p-1.5 rounded-lg border mr-2"
            style={{ backgroundColor: colors.cardBg, borderColor: colors.cardBorder }}
          >
            <Quote size={16} color={colors.textPrimary} />
          </Pressable>

          <Pressable
            onPress={() => insertSyntax('**', '**')}
            className="p-1.5 rounded-lg border mr-2"
            style={{ backgroundColor: colors.cardBg, borderColor: colors.cardBorder }}
          >
            <Bold size={16} color={colors.textPrimary} />
          </Pressable>

          <Pressable
            onPress={() => insertSyntax('*', '*')}
            className="p-1.5 rounded-lg border mr-2"
            style={{ backgroundColor: colors.cardBg, borderColor: colors.cardBorder }}
          >
            <Italic size={16} color={colors.textPrimary} />
          </Pressable>

          <Pressable
            onPress={() => insertSyntax('`', '`')}
            className="p-1.5 rounded-lg border mr-2"
            style={{ backgroundColor: colors.cardBg, borderColor: colors.cardBorder }}
          >
            <Code size={16} color={colors.textPrimary} />
          </Pressable>

          <Pressable
            onPress={() => insertSyntax('* 第一要点\n* 第二要点\n')}
            className="p-1.5 rounded-lg border mr-2"
            style={{ backgroundColor: colors.cardBg, borderColor: colors.cardBorder }}
          >
            <List size={16} color={colors.textPrimary} />
          </Pressable>

          <Pressable
            onPress={() => { insertSyntax('\n---\n'); requestAnimationFrame(() => contentInputRef.current?.focus()); }}
            className="p-1.5 rounded-lg border mr-2"
            style={{ backgroundColor: colors.cardBg, borderColor: colors.cardBorder }}
          >
            <Minus size={16} color={colors.textPrimary} />
          </Pressable>

          {/* 网络图片 URL 插入按钮 */}
          <Pressable
            onPress={() => setShowImageModal(true)}
            className="flex-row items-center px-2 py-1 rounded-lg border mr-2"
            style={{ backgroundColor: colors.cardBg, borderColor: colors.cardBorder }}
          >
            <ImageIcon size={14} color={colors.textPrimary} />
            <Text className="text-xs ml-1" style={{ color: colors.textPrimary }}>
              网络图片
            </Text>
          </Pressable>

          {/* 从相册选择并上传按钮（与原有网络图片并存） */}
          <Pressable
            onPress={handlePickFromGallery}
            disabled={uploadingGalleryImages}
            className="flex-row items-center px-2.5 py-1 rounded-lg border mr-2 active:opacity-80"
            style={{
              backgroundColor: colors.accentBg,
              borderColor: colors.accent,
            }}
          >
            {uploadingGalleryImages ? (
              <ActivityIndicator size="small" color={colors.accent} />
            ) : (
              <Images size={14} color={colors.accent} />
            )}
            <Text className="text-xs font-semibold ml-1" style={{ color: colors.accent }}>
              {uploadingGalleryImages ? '上传中...' : '相册'}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setShowImportModal(true)}
            className="flex-row items-center px-2 py-1 rounded-lg border mr-2"
            style={{ backgroundColor: colors.cardBg, borderColor: colors.cardBorder }}
          >
            <FileText size={14} color={colors.textPrimary} />
            <Text className="text-xs ml-1" style={{ color: colors.textPrimary }}>
              导入文本/文档
            </Text>
          </Pressable>
        </ScrollView>
      </View>

      {/* 主输入区 */}
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 110 }} className="flex-1">
        {/* 标题 */}
        <TextInput
          placeholder="给这篇哲学思辨拟一个标题 (留空自动取正文前30字)"
          placeholderTextColor={colors.textMuted}
          value={title}
          onChangeText={setTitle}
          className="text-xl font-bold py-2 mb-3 border-b"
          style={{
            borderColor: colors.cardBorder,
            color: colors.textPrimary,
          }}
        />

        {/* 分类标签选择栏（主题、心境、天气） */}
        <View
          className="p-4 rounded-2xl border mb-4"
          style={{ backgroundColor: colors.cardBg, borderColor: colors.cardBorder }}
        >
          {/* 主题标签 */}
          <View className="mb-3">
            <Text className="text-[11px] mb-1.5" style={{ color: colors.textMuted }}>
              【主题范畴】(可多选)
            </Text>
            <View className="flex-row flex-wrap gap-1.5">
              {themeItems.map((tagItem) => {
                const tag = tagItem.name;
                const isSelected = themeTags.includes(tag);
                return (
                  <Pressable
                    key={tagItem.id || tag}
                    onPress={() => toggleThemeTag(tag)}
                    className="px-2.5 py-1 rounded-full border text-xs"
                    style={{
                      backgroundColor: isSelected ? colors.accentBg : colors.bg,
                      borderColor: isSelected ? colors.accent : colors.cardBorder,
                    }}
                  >
                    <Text
                      className="text-xs"
                      style={{ color: isSelected ? colors.accent : colors.textSecondary }}
                    >
                      {tagItem.emoji ? `${tagItem.emoji} ` : ''}{tag}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* 情绪、天气、地点 */}
          <View className="flex-row gap-2">
            <View className="flex-1">
              <Text className="text-[11px] mb-1" style={{ color: colors.textMuted }}>
                【心境】
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {moodItems.map((mItem) => {
                  const m = mItem.name;
                  return (
                    <Pressable
                      key={mItem.id || m}
                      onPress={() => setMoodTag(m)}
                      className="px-2 py-0.5 rounded border mr-1"
                      style={{
                        backgroundColor: moodTag === m ? colors.accentBg : colors.bg,
                        borderColor: moodTag === m ? colors.accent : colors.cardBorder,
                      }}
                    >
                      <Text className="text-xs" style={{ color: moodTag === m ? colors.accent : colors.textMuted }}>
                        {mItem.emoji ? `${mItem.emoji} ` : ''}{m}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            <View className="flex-1">
              <Text className="text-[11px] mb-1" style={{ color: colors.textMuted }}>
                【天气】
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {weatherItems.map((wItem) => {
                  const w = wItem.name;
                  return (
                    <Pressable
                      key={wItem.id || w}
                      onPress={() => setWeatherTag(w)}
                      className="px-2 py-0.5 rounded border mr-1"
                      style={{
                        backgroundColor: weatherTag === w ? colors.accentBg : colors.bg,
                        borderColor: weatherTag === w ? colors.accent : colors.cardBorder,
                      }}
                    >
                      <Text className="text-xs" style={{ color: weatherTag === w ? colors.accent : colors.textMuted }}>
                        {wItem.emoji ? `${wItem.emoji} ` : ''}{w}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          </View>
        </View>

        {/* 正文输入 */}
        {galleryUploadError ? (
          <View className="flex-row items-center p-2.5 rounded-xl border border-destructive/30 bg-destructive/10 mb-3">
            <AlertCircle size={14} color="#EF4444" />
            <Text className="text-xs text-destructive ml-1.5 flex-1">{galleryUploadError}</Text>
          </View>
        ) : null}

        {/* 正文输入：包含原生垂直滚动指示条，支持长文本流畅操作 */}
        <View
          className="rounded-2xl border mb-4 overflow-hidden"
          style={{
            backgroundColor: colors.cardBg,
            borderColor: colors.cardBorder,
            height: 380,
          }}
        >
          <ScrollView
            nestedScrollEnabled
            showsVerticalScrollIndicator
            contentContainerStyle={{ padding: 14, flexGrow: 1 }}
          >
            <TextInput
              placeholder="在此铺陈思辨的长卷，支持 Markdown、对谈引用、下划线、表格、代码块..."
              placeholderTextColor={colors.textMuted}
              value={content}
              ref={contentInputRef}
              onChangeText={updateContent}
              onSelectionChange={(e) => {
                setCursorSelection(e.nativeEvent.selection);
              }}
              multiline
              scrollEnabled={false}
              textAlignVertical="top"
              className="text-base leading-relaxed"
              style={{
                color: colors.textPrimary,
                minHeight: 350,
              }}
            />
          </ScrollView>
        </View>

        {/* 版本备注输入 */}
        <TextInput
          placeholder="版本记录备注 (如: 完善关于自由与宿命的论述)"
          placeholderTextColor={colors.textMuted}
          value={versionNote}
          onChangeText={setVersionNote}
          className="text-xs p-3 rounded-xl border"
          style={{
            backgroundColor: colors.cardBg,
            borderColor: colors.cardBorder,
            color: colors.textPrimary,
          }}
        />
      </ScrollView>

      {/* 插入超链接弹窗 */}
      <Modal visible={showLinkModal} transparent animationType="fade" onRequestClose={() => setShowLinkModal(false)}>
        <Pressable className="flex-1 justify-center items-center bg-black/40 px-6" onPress={() => setShowLinkModal(false)}>
          <Pressable
            className="w-full max-w-sm rounded-2xl p-5"
            style={{ backgroundColor: colors.cardBg }}
            onPress={(e) => e.stopPropagation()}
          >
            <Text className="text-base font-bold mb-3" style={{ color: colors.textPrimary }}>
              插入超链接
            </Text>
            <Text className="text-xs font-semibold mb-1" style={{ color: colors.textSecondary }}>
              显示文本
            </Text>
            <TextInput
              placeholder="链接文本 (例如: 存在与时间)"
              placeholderTextColor={colors.textMuted}
              value={linkText}
              onChangeText={setLinkText}
              className="text-xs p-2.5 rounded-lg border mb-3"
              style={{ backgroundColor: colors.bg, borderColor: colors.cardBorder, color: colors.textPrimary }}
            />
            <Text className="text-xs font-semibold mb-1" style={{ color: colors.textSecondary }}>
              链接地址
            </Text>
            <TextInput
              placeholder="https://..."
              placeholderTextColor={colors.textMuted}
              value={linkUrl}
              onChangeText={setLinkUrl}
              className="text-xs p-2.5 rounded-lg border mb-4"
              style={{ backgroundColor: colors.bg, borderColor: colors.cardBorder, color: colors.textPrimary }}
            />
            <Pressable
              onPress={handleInsertLink}
              disabled={!linkUrl.trim()}
              className="py-2.5 rounded-xl items-center"
              style={{ backgroundColor: linkUrl.trim() ? colors.accent : colors.cardBorder }}
            >
              <Text className="text-xs font-bold text-white">确认插入超链接</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* 插入表格弹窗 */}
      <Modal visible={showTableModal} transparent animationType="fade" onRequestClose={() => setShowTableModal(false)}>
        <Pressable className="flex-1 justify-center items-center bg-black/40 px-6" onPress={() => setShowTableModal(false)}>
          <Pressable
            className="w-full max-w-sm rounded-2xl p-5"
            style={{ backgroundColor: colors.cardBg }}
            onPress={(e) => e.stopPropagation()}
          >
            <Text className="text-base font-bold mb-3" style={{ color: colors.textPrimary }}>
              插入 Markdown 表格
            </Text>
            <View className="flex-row gap-3 mb-4">
              <View className="flex-1">
                <Text className="text-xs font-semibold mb-1" style={{ color: colors.textSecondary }}>
                  数据行数
                </Text>
                <TextInput
                  placeholder="3"
                  keyboardType="numeric"
                  placeholderTextColor={colors.textMuted}
                  value={tableRows}
                  onChangeText={setTableRows}
                  className="text-xs p-2.5 rounded-lg border"
                  style={{ backgroundColor: colors.bg, borderColor: colors.cardBorder, color: colors.textPrimary }}
                />
              </View>
              <View className="flex-1">
                <Text className="text-xs font-semibold mb-1" style={{ color: colors.textSecondary }}>
                  数据列数
                </Text>
                <TextInput
                  placeholder="3"
                  keyboardType="numeric"
                  placeholderTextColor={colors.textMuted}
                  value={tableCols}
                  onChangeText={setTableCols}
                  className="text-xs p-2.5 rounded-lg border"
                  style={{ backgroundColor: colors.bg, borderColor: colors.cardBorder, color: colors.textPrimary }}
                />
              </View>
            </View>
            <Pressable
              onPress={handleInsertTable}
              className="py-2.5 rounded-xl items-center"
              style={{ backgroundColor: colors.accent }}
            >
              <Text className="text-xs font-bold text-white">生成并插入表格</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* 插入代码块弹窗 */}
      <Modal visible={showCodeModal} transparent animationType="fade" onRequestClose={() => setShowCodeModal(false)}>
        <Pressable className="flex-1 justify-center items-center bg-black/40 px-6" onPress={() => setShowCodeModal(false)}>
          <Pressable
            className="w-full max-w-sm rounded-2xl p-5"
            style={{ backgroundColor: colors.cardBg }}
            onPress={(e) => e.stopPropagation()}
          >
            <Text className="text-base font-bold mb-3" style={{ color: colors.textPrimary }}>
              插入代码块
            </Text>
            <Text className="text-xs font-semibold mb-1" style={{ color: colors.textSecondary }}>
              编程语言 / 类型
            </Text>
            <Pressable onPress={() => setShowCodeLanguagePicker(true)} className="flex-row items-center justify-between text-xs p-2.5 rounded-lg border mb-3" style={{ backgroundColor: colors.bg, borderColor: colors.cardBorder }}>
              <Text style={{ color:colors.textPrimary, fontSize:12 }}>{codeLanguage}</Text><ChevronDown size={15} color={colors.textMuted}/>
            </Pressable>
            <Text className="text-xs font-semibold mb-1" style={{ color: colors.textSecondary }}>
              代码内容
            </Text>
            <TextInput
              placeholder="在此输入代码..."
              placeholderTextColor={colors.textMuted}
              value={codeContent}
              onChangeText={setCodeContent}
              multiline
              textAlignVertical="top"
              className="text-xs p-2.5 rounded-lg border mb-4 h-28 font-mono"
              style={{ backgroundColor: colors.bg, borderColor: colors.cardBorder, color: colors.textPrimary }}
            />
            <Pressable
              onPress={handleInsertCode}
              className="py-2.5 rounded-xl items-center"
              style={{ backgroundColor: colors.accent }}
            >
              <Text className="text-xs font-bold text-white">生成并插入代码块</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* 图片插入弹窗 */}
      <Modal visible={showImageModal} transparent animationType="fade" onRequestClose={() => setShowImageModal(false)}>
        <Pressable className="flex-1 justify-center items-center bg-black/40 px-6" onPress={() => setShowImageModal(false)}>
          <Pressable
            className="w-full max-w-sm rounded-2xl p-5"
            style={{ backgroundColor: colors.cardBg }}
            onPress={(e) => e.stopPropagation()}
          >
            <Text className="text-base font-bold mb-3" style={{ color: colors.textPrimary }}>
              插入图片 (URL直链)
            </Text>
            <TextInput
              placeholder="图片链接 URL (https://...)"
              placeholderTextColor={colors.textMuted}
              value={imageUrl}
              onChangeText={setImageUrl}
              className="text-xs p-2.5 rounded-lg border mb-2"
              style={{ backgroundColor: colors.bg, borderColor: colors.cardBorder, color: colors.textPrimary }}
            />
            <TextInput
              placeholder="图片说明 / 题注"
              placeholderTextColor={colors.textMuted}
              value={imageAlt}
              onChangeText={setImageAlt}
              className="text-xs p-2.5 rounded-lg border mb-4"
              style={{ backgroundColor: colors.bg, borderColor: colors.cardBorder, color: colors.textPrimary }}
            />
            <Pressable
              onPress={handleInsertImage}
              className="py-2.5 rounded-xl items-center"
              style={{ backgroundColor: colors.accent }}
            >
              <Text className="text-xs font-bold text-white">确认插入图片</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* 文本/文档内容导入弹窗 */}
      <Modal visible={showImportModal} transparent animationType="fade" onRequestClose={() => setShowImportModal(false)}>
        <Pressable className="flex-1 justify-center items-center bg-black/40 px-6" onPress={() => setShowImportModal(false)}>
          <Pressable
            className="w-full max-w-sm rounded-2xl p-5"
            style={{ backgroundColor: colors.cardBg }}
            onPress={(e) => e.stopPropagation()}
          >
            <Text className="text-base font-bold mb-2" style={{ color: colors.textPrimary }}>
              导入文档或外部文本
            </Text>
            <Text className="text-[11px] mb-3" style={{ color: colors.textMuted }}>
              粘贴从 .txt / .md / Word 中复制的思辨草稿文本
            </Text>
            <TextInput
              placeholder="在此粘贴外部长文草稿内容..."
              placeholderTextColor={colors.textMuted}
              value={importText}
              onChangeText={setImportText}
              multiline
              numberOfLines={6}
              className="text-xs p-2.5 rounded-lg border mb-4 min-h-[120px]"
              style={{ backgroundColor: colors.bg, borderColor: colors.cardBorder, color: colors.textPrimary }}
            />
            <Pressable
              onPress={handleImportContent}
              className="py-2.5 rounded-xl items-center"
              style={{ backgroundColor: colors.accent }}
            >
              <Text className="text-xs font-bold text-white">追加并解析至正文</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* 引用/对谈定义：> 后内容完全由用户决定，不再强制“沉思对谈” */}
      <Modal visible={showQuoteModal} transparent animationType="fade" onRequestClose={()=>setShowQuoteModal(false)}>
        <Pressable className="flex-1 justify-center items-center bg-black/40 px-6" onPress={()=>setShowQuoteModal(false)}><Pressable className="w-full max-w-sm rounded-2xl p-5" style={{backgroundColor:colors.cardBg}} onPress={e=>e.stopPropagation()}>
          <Text className="text-base font-bold mb-3" style={{color:colors.textPrimary}}>插入引用 / 思辨对谈</Text>
          <Text className="text-xs mb-1" style={{color:colors.textSecondary}}>发言者（可自定义）</Text>
          <TextInput value={quoteSpeaker} onChangeText={setQuoteSpeaker} placeholder="例如：学者、青年、我、未来的我" placeholderTextColor={colors.textMuted} className="p-2.5 rounded-lg border mb-3 text-xs" style={{backgroundColor:colors.bg,borderColor:colors.cardBorder,color:colors.textPrimary}}/>
          <View className="flex-row flex-wrap gap-2 mb-3">{['学者','青年','我','未来的我','苏格拉底'].map(x=><Pressable key={x} onPress={()=>setQuoteSpeaker(x)} className="px-2.5 py-1.5 rounded-full border" style={{backgroundColor:colors.bg,borderColor:colors.cardBorder}}><Text className="text-[11px]" style={{color:colors.textSecondary}}>{x}</Text></Pressable>)}</View>
          <TextInput value={quoteText} onChangeText={setQuoteText} multiline placeholder="输入你真正想引用/对谈的内容，不自动塞入任何默认文字" placeholderTextColor={colors.textMuted} className="p-2.5 rounded-lg border mb-4 min-h-[90px] text-xs" style={{backgroundColor:colors.bg,borderColor:colors.cardBorder,color:colors.textPrimary,textAlignVertical:'top'}}/>
          <Pressable onPress={()=>{ insertAtCursor(`> ${quoteSpeaker.trim()?`**${quoteSpeaker.trim()}**：`:''}${quoteText.trim()}\n`); setQuoteSpeaker(''); setQuoteText(''); setShowQuoteModal(false); }} disabled={!quoteText.trim()} className="py-2.5 rounded-xl items-center" style={{backgroundColor:quoteText.trim()?colors.accent:colors.cardBorder}}><Text className="text-xs font-bold text-white">插入</Text></Pressable>
        </Pressable></Pressable>
      </Modal>

      {/* 字体列表 */}
      <Modal visible={showFontModal} transparent animationType="fade" onRequestClose={()=>setShowFontModal(false)}>
        <Pressable className="flex-1 justify-center items-center bg-black/40 px-6" onPress={()=>setShowFontModal(false)}><Pressable className="w-full max-w-sm rounded-2xl p-5" style={{backgroundColor:colors.cardBg}} onPress={e=>e.stopPropagation()}>
          <Text className="text-base font-bold mb-3" style={{color:colors.textPrimary}}>选择字体</Text>
          {([['system','系统默认'],['sans-serif','无衬线'],['serif','衬线阅读'],['monospace','等宽代码'],['cursive','手写风格']] as const).map(([key,label])=><Pressable key={key} onPress={()=>{setSelectedFont(key); applyTextStyle(key, undefined); setShowFontModal(false)}} className="p-3 rounded-xl border mb-2" style={{backgroundColor:colors.bg,borderColor:colors.cardBorder}}><Text style={{color:colors.textPrimary,fontFamily:key==='system'?undefined:key,fontSize:14}}>{label}</Text></Pressable>)}
        </Pressable></Pressable>
      </Modal>

      {/* 七色文字 */}
      <Modal visible={showColorModal} transparent animationType="fade" onRequestClose={()=>setShowColorModal(false)}>
        <Pressable className="flex-1 justify-center items-center bg-black/40 px-6" onPress={()=>setShowColorModal(false)}><Pressable className="w-full max-w-sm rounded-2xl p-5" style={{backgroundColor:colors.cardBg}} onPress={e=>e.stopPropagation()}>
          <Text className="text-base font-bold mb-3" style={{color:colors.textPrimary}}>选择文字颜色</Text>
          <View className="flex-row flex-wrap gap-2">{[['#FFFFFF','默认（白色）'],['#EF4444','红'],['#F97316','橙'],['#3B82F6','蓝'],['#EAB308','黄'],['#22C55E','绿'],['#6B7280','灰']].map(([color,label])=><Pressable key={color} onPress={()=>{setSelectedColor(color); applyTextStyle(undefined,color); setShowColorModal(false)}} className="flex-row items-center px-3 py-2 rounded-xl border" style={{borderColor:colors.cardBorder,backgroundColor:colors.bg}}><View className="w-4 h-4 rounded-full mr-1.5 border" style={{backgroundColor:color,borderColor:color==='#FFFFFF'?colors.cardBorder:color}}/><Text className="text-xs" style={{color:colors.textSecondary}}>{label}</Text></Pressable>)}</View>
        </Pressable></Pressable>
      </Modal>

      {/* 代码语言列表 */}
      <Modal visible={showCodeLanguagePicker} transparent animationType="fade" onRequestClose={()=>setShowCodeLanguagePicker(false)}>
        <Pressable className="flex-1 justify-center items-center bg-black/40 px-6" onPress={()=>setShowCodeLanguagePicker(false)}><Pressable className="w-full max-w-sm rounded-2xl p-5" style={{backgroundColor:colors.cardBg}} onPress={e=>e.stopPropagation()}>
          <Text className="text-base font-bold mb-3" style={{color:colors.textPrimary}}>选择代码类型</Text>
          <View className="flex-row flex-wrap gap-2">{['text','typescript','javascript','python','java','kotlin','swift','c','cpp','csharp','go','rust','sql','json','xml','html','css','bash','markdown','latex'].map(lang=><Pressable key={lang} onPress={()=>{setCodeLanguage(lang);setShowCodeLanguagePicker(false)}} className="px-3 py-2 rounded-xl border" style={{backgroundColor:codeLanguage===lang?colors.accentBg:colors.bg,borderColor:codeLanguage===lang?colors.accent:colors.cardBorder}}><Text className="text-xs" style={{color:codeLanguage===lang?colors.accent:colors.textSecondary}}>{lang}</Text></Pressable>)}</View>
        </Pressable></Pressable>
      </Modal>

      {/* 历史版本查看弹窗 */}
      <Modal visible={showVersionModal} transparent animationType="slide" onRequestClose={() => setShowVersionModal(false)}>
        <Pressable className="flex-1 justify-end bg-black/50" onPress={() => setShowVersionModal(false)}>
          <Pressable
            className="rounded-t-3xl p-6 max-h-[70%]"
            style={{ backgroundColor: colors.cardBg }}
            onPress={(e) => e.stopPropagation()}
          >
            <View className="flex-row items-center justify-between pb-3 border-b" style={{ borderColor: colors.cardBorder }}>
              <Text className="text-base font-bold" style={{ color: colors.textPrimary }}>
                历史版本记录 ({versions.length})
              </Text>
              <Pressable onPress={() => setShowVersionModal(false)}>
                <X size={18} color={colors.textSecondary} />
              </Pressable>
            </View>

            <ScrollView className="py-3">
              {versions.map((ver) => (
                <View
                  key={ver.id}
                  className="p-3 rounded-xl border mb-2"
                  style={{ backgroundColor: colors.bg, borderColor: colors.cardBorder }}
                >
                  <View className="flex-row items-center justify-between mb-1">
                    <Text className="text-xs font-bold" style={{ color: colors.accent }}>
                      {ver.version_note || '修订版本'}
                    </Text>
                    <Text className="text-[10px]" style={{ color: colors.textMuted }}>
                      {new Date(ver.created_at).toLocaleString()}
                    </Text>
                  </View>
                  <Text numberOfLines={2} className="text-xs" style={{ color: colors.textSecondary }}>
                    {ver.content}
                  </Text>
                </View>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
