import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Text, TextInput, View, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Search, Plus, X, Database, Link2, Trash2, ArrowLeft, Check } from 'lucide-react-native';
import { useTheme } from '@/context/ThemeContext';
import {
  ThoughtEntityType,
  ThoughtEntitySummary,
  ThoughtJournalRole,
  createThoughtEntity,
  createThoughtRelation,
  deleteThoughtEntity,
  getJournalEntities,
  getThoughtEntities,
  getThoughtRelations,
  linkThoughtToJournal,
  unlinkThoughtFromJournal,
  JournalEntityLink,
} from '@/services/api';

const TYPES: { key: ThoughtEntityType; label: string; icon: string }[] = [
  { key: 'concept', label: '概念', icon: '◇' },
  { key: 'person', label: '人物', icon: '人' },
  { key: 'theory', label: '理论', icon: 'T' },
  { key: 'claim', label: '观点', icon: '◆' },
  { key: 'argument', label: '论证', icon: '∴' },
];

const ROLES: { key: ThoughtJournalRole; label: string }[] = [
  { key: 'core', label: '核心' },
  { key: 'mentioned', label: '提及' },
  { key: 'supporting', label: '支撑' },
  { key: 'counterpoint', label: '反方' },
  { key: 'source', label: '来源' },
  { key: 'question', label: '问题' },
];

export default function ThoughtDatabaseScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { journalId } = useLocalSearchParams<{ journalId?: string }>();
  const [type, setType] = useState<ThoughtEntityType>('concept');
  const [items, setItems] = useState<ThoughtEntitySummary[]>([]);
  const [links, setLinks] = useState<JournalEntityLink[]>([]);
  const [relations, setRelations] = useState<any[]>([]);
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [relationModal, setRelationModal] = useState<ThoughtEntitySummary | null>(null);
  const [relationTargets, setRelationTargets] = useState<ThoughtEntitySummary[]>([]);
  const [form, setForm] = useState<Record<string, string>>({});
  const [role, setRole] = useState<ThoughtJournalRole>('mentioned');
  const [relationType, setRelationType] = useState('相关');

  const load = useCallback(async () => {
    setLoading(true);
    const [data, journalLinks, rels] = await Promise.all([
      getThoughtEntities({ type, keyword, limit: 300 }),
      journalId ? getJournalEntities(journalId) : Promise.resolve([]),
      getThoughtRelations(journalId ? { journalId } : undefined),
    ]);
    setItems(data);
    setLinks(journalLinks);
    setRelations(rels);
    setRelationTargets(await getThoughtEntities({ limit: 300 }));
    setLoading(false);
  }, [type, keyword, journalId]);

  useEffect(() => { load(); }, [load]);

  const linkedIds = useMemo(() => new Set(links.map((x) => `${x.entity_type}:${x.entity_id}`)), [links]);
  const selectedLinks = useMemo(() => links.filter((x) => x.entity_type === type), [links, type]);

  const create = async () => {
    const name = (form.name || form.statement || '').trim();
    if (!name) {
      Alert.alert('无法创建', type === 'claim' ? '请输入观点内容' : '请输入名称');
      return;
    }
    const payload: Record<string, any> = type === 'claim'
      ? { statement: name, stance: form.stance || 'neutral', confidence: form.confidence ? Number(form.confidence) : null, source_note: form.source_note || '', summary: form.summary || '' }
      : { name, summary: form.summary || '', description: form.description || '', aliases: (form.aliases || '').split(/[,，]/).map(s => s.trim()).filter(Boolean) };
    if (type === 'person') {
      payload.birth_year = form.birth_year ? Number(form.birth_year) : null;
      payload.death_year = form.death_year ? Number(form.death_year) : null;
      payload.roles = (form.roles || '').split(/[,，]/).map(s => s.trim()).filter(Boolean);
    }
    if (type === 'theory') { payload.school = form.school || ''; payload.period = form.period || ''; }
    if (type === 'argument') {
      payload.argument_type = form.argument_type || 'deductive';
      payload.thesis = form.thesis || '';
      payload.premises = (form.premises || '').split('\n').map(s => s.trim()).filter(Boolean);
      payload.conclusion = form.conclusion || '';
      payload.counterargument = form.counterargument || '';
    }
    const created = await createThoughtEntity(type, payload);
    if (!created) {
      Alert.alert('创建失败', '名称可能已经存在，或数据库暂不可用。');
      return;
    }
    if (journalId) await linkThoughtToJournal({ journal_id: journalId, entity_type: type, entity_id: created.id, role });
    setModal(false);
    setForm({});
    await load();
  };

  const toggleLink = async (item: ThoughtEntitySummary) => {
    if (!journalId) return;
    const key = `${item.entity_type}:${item.id}`;
    const existing = links.find((x) => `${x.entity_type}:${x.entity_id}` === key);
    if (existing) await unlinkThoughtFromJournal(existing.id);
    else await linkThoughtToJournal({ journal_id: journalId, entity_type: item.entity_type, entity_id: item.id, role });
    await load();
  };

  const removeEntity = (item: ThoughtEntitySummary) => {
    Alert.alert('删除思想实体', `确定删除“${item.name}”吗？关联关系也会失去意义。`, [
      { text: '取消', style: 'cancel' },
      { text: '删除', style: 'destructive', onPress: async () => { await deleteThoughtEntity(item.entity_type, item.id); await load(); } },
    ]);
  };

  const makeRelation = async (target: ThoughtEntitySummary) => {
    const source = relationModal;
    if (!source || source.id === target.id && source.entity_type === target.entity_type) return;
    const created = await createThoughtRelation({
      journal_id: journalId,
      source_type: source.entity_type,
      source_id: source.id,
      target_type: target.entity_type,
      target_id: target.id,
      relation_type: relationType.trim() || '相关',
    });
    if (!created) Alert.alert('关系创建失败', '可能已经存在相同关系，或数据库暂不可用。');
    setRelationModal(null);
    await load();
  };

  const openCreate = () => {
    setForm({});
    setModal(true);
  };

  const Field = ({ label, value, keyName, multiline = false, placeholder = '' }: { label: string; value?: string; keyName: string; multiline?: boolean; placeholder?: string }) => (
    <View className="mb-3">
      <Text className="text-xs font-semibold mb-1.5" style={{ color: colors.textSecondary }}>{label}</Text>
      <TextInput
        value={value || ''}
        onChangeText={(v) => setForm((p) => ({ ...p, [keyName]: v }))}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        multiline={multiline}
        numberOfLines={multiline ? 4 : 1}
        className="rounded-xl border px-3 py-2.5 text-sm"
        style={{ color: colors.textPrimary, borderColor: colors.cardBorder, backgroundColor: colors.bg, minHeight: multiline ? 90 : undefined, textAlignVertical: multiline ? 'top' : 'center' }}
      />
    </View>
  );

  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1" style={{ backgroundColor: colors.bg }}>
      <View className="px-4 py-3 border-b flex-row items-center" style={{ backgroundColor: colors.cardBg, borderColor: colors.cardBorder }}>
        <Pressable onPress={() => router.back()} className="p-2 mr-2 rounded-full" style={{ backgroundColor: colors.accentBg }}><ArrowLeft size={18} color={colors.accent} /></Pressable>
        <View className="flex-1">
          <Text className="text-lg font-bold" style={{ color: colors.textPrimary }}>思想数据库</Text>
          <Text className="text-[10px]" style={{ color: colors.textMuted }}>{journalId ? '正在为文章建立思想实体索引' : 'V4.2 · 结构化个人思想档案'}</Text>
        </View>
        <Pressable onPress={openCreate} className="p-2.5 rounded-full" style={{ backgroundColor: colors.accent }}><Plus size={19} color="#fff" /></Pressable>
      </View>

      <View className="px-4 pt-3">
        <View className="flex-row items-center rounded-xl border px-3" style={{ borderColor: colors.cardBorder, backgroundColor: colors.cardBg }}>
          <Search size={16} color={colors.textMuted} />
          <TextInput value={keyword} onChangeText={setKeyword} placeholder="搜索概念、人物、理论、观点、论证" placeholderTextColor={colors.textMuted} className="flex-1 py-2.5 px-2 text-sm" style={{ color: colors.textPrimary }} />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-3">
          {TYPES.map((t) => (
            <Pressable key={t.key} onPress={() => setType(t.key)} className="mr-2 px-3 py-2 rounded-full border flex-row items-center" style={{ borderColor: type === t.key ? colors.accent : colors.cardBorder, backgroundColor: type === t.key ? colors.accentBg : colors.cardBg }}>
              <Text className="text-xs font-bold mr-1" style={{ color: type === t.key ? colors.accent : colors.textMuted }}>{t.icon}</Text>
              <Text className="text-xs font-semibold" style={{ color: type === t.key ? colors.accent : colors.textSecondary }}>{t.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
        {journalId && <Text className="text-[11px] mt-3" style={{ color: colors.textMuted }}>已关联本文章的{TYPES.find(t => t.key === type)?.label}：{selectedLinks.length} 个</Text>}
      </View>

      {loading ? <View className="flex-1 items-center justify-center"><ActivityIndicator color={colors.accent} /></View> : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 80 }}>
          {items.map((item) => {
            const linked = linkedIds.has(`${item.entity_type}:${item.id}`);
            return (
              <View key={`${item.entity_type}:${item.id}`} className="mb-3 rounded-2xl border p-4" style={{ borderColor: colors.cardBorder, backgroundColor: colors.cardBg }}>
                <View className="flex-row items-start">
                  <View className="w-9 h-9 rounded-xl items-center justify-center mr-3" style={{ backgroundColor: colors.accentBg }}><Database size={17} color={colors.accent} /></View>
                  <View className="flex-1">
                    <Text className="text-sm font-bold" style={{ color: colors.textPrimary }}>{item.name}</Text>
                    {!!item.aliases?.length && <Text className="text-[10px] mt-1" style={{ color: colors.textMuted }}>别名：{item.aliases.join('、')}</Text>}
                    {!!item.summary && <Text className="text-xs leading-5 mt-1.5" style={{ color: colors.textSecondary }}>{item.summary}</Text>}
                  </View>
                </View>
                <View className="flex-row mt-3 gap-2">
                  {journalId && <Pressable onPress={() => toggleLink(item)} className="flex-1 py-2 rounded-xl flex-row items-center justify-center" style={{ backgroundColor: linked ? colors.accent : colors.accentBg }}>
                    {linked ? <Check size={14} color="#fff" /> : <Link2 size={14} color={colors.accent} />}
                    <Text className="text-xs font-semibold ml-1" style={{ color: linked ? '#fff' : colors.accent }}>{linked ? '已关联' : '关联文章'}</Text>
                  </Pressable>}
                  <Pressable onPress={() => setRelationModal(item)} className="flex-1 py-2 rounded-xl flex-row items-center justify-center" style={{ backgroundColor: colors.bg }}>
                    <Link2 size={14} color={colors.textSecondary} /><Text className="text-xs font-semibold ml-1" style={{ color: colors.textSecondary }}>建立关系</Text>
                  </Pressable>
                  <Pressable onPress={() => removeEntity(item)} className="px-3 py-2 rounded-xl" style={{ backgroundColor: '#FEF2F2' }}><Trash2 size={14} color="#DC2626" /></Pressable>
                </View>
              </View>
            );
          })}
          {!items.length && <View className="items-center py-16"><Database size={36} color={colors.textMuted} /><Text className="text-sm font-semibold mt-3" style={{ color: colors.textSecondary }}>暂无结构化思想实体</Text><Text className="text-xs mt-1" style={{ color: colors.textMuted }}>点击右上角 + 创建第一个{TYPES.find(t => t.key === type)?.label}</Text></View>}
          {!!relations.length && <View className="mt-2"><Text className="text-xs font-bold mb-2" style={{ color: colors.textSecondary }}>当前文章关系 {relations.length}</Text>{relations.slice(0, 20).map((r) => <View key={r.id} className="rounded-xl border p-3 mb-2" style={{ borderColor: colors.cardBorder, backgroundColor: colors.cardBg }}><Text className="text-xs" style={{ color: colors.textPrimary }}>{r.source_type}:{r.source_id.slice(0, 6)} → {r.relation_type} → {r.target_type}:{r.target_id.slice(0, 6)}</Text></View>)}</View>}
        </ScrollView>
      )}

      <Modal visible={modal} transparent animationType="slide" onRequestClose={() => setModal(false)}>
        <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}>
          <View className="rounded-t-3xl p-5 max-h-[88%]" style={{ backgroundColor: colors.cardBg }}>
            <View className="flex-row items-center mb-4"><Text className="text-lg font-bold flex-1" style={{ color: colors.textPrimary }}>新建{TYPES.find(t => t.key === type)?.label}</Text><Pressable onPress={() => setModal(false)}><X size={20} color={colors.textSecondary} /></Pressable></View>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Field label={type === 'claim' ? '观点内容' : '名称'} keyName={type === 'claim' ? 'statement' : 'name'} placeholder={type === 'claim' ? '例如：人的自由以社会关系为条件' : `输入${TYPES.find(t => t.key === type)?.label}名称`} />
              <Field label="摘要" keyName="summary" multiline placeholder="一句话说明它在你的思想体系中的位置" />
              {type !== 'claim' && <Field label="别名（逗号分隔）" keyName="aliases" placeholder="例如：自由意志, free will" />}
              {type === 'person' && <><Field label="出生年份" keyName="birth_year" /><Field label="逝世年份" keyName="death_year" /><Field label="身份 / 领域（逗号分隔）" keyName="roles" /></>}
              {type === 'theory' && <><Field label="学派" keyName="school" /><Field label="时代 / 时期" keyName="period" /><Field label="详细说明" keyName="description" multiline /></>}
              {type === 'claim' && <><Field label="立场 supports / opposes / neutral / question" keyName="stance" placeholder="neutral" /><Field label="可信度 0-100" keyName="confidence" /><Field label="来源说明" keyName="source_note" multiline /></>}
              {type === 'argument' && <><Field label="论证类型" keyName="argument_type" placeholder="deductive / inductive / abductive" /><Field label="核心命题" keyName="thesis" multiline /><Field label="前提（每行一个）" keyName="premises" multiline /><Field label="结论" keyName="conclusion" multiline /><Field label="可能反论" keyName="counterargument" multiline /></>}
              {journalId && <><Text className="text-xs font-semibold mb-2" style={{ color: colors.textSecondary }}>与当前文章的关系</Text><View className="flex-row flex-wrap gap-2 mb-4">{ROLES.map((r) => <Pressable key={r.key} onPress={() => setRole(r.key)} className="px-3 py-2 rounded-full border" style={{ borderColor: role === r.key ? colors.accent : colors.cardBorder, backgroundColor: role === r.key ? colors.accentBg : colors.bg }}><Text className="text-xs" style={{ color: role === r.key ? colors.accent : colors.textSecondary }}>{r.label}</Text></Pressable>)}</View></>}
              <Pressable onPress={create} className="py-3.5 rounded-2xl items-center mb-4" style={{ backgroundColor: colors.accent }}><Text className="text-sm font-bold text-white">创建并保存</Text></Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={!!relationModal} transparent animationType="slide" onRequestClose={() => setRelationModal(null)}>
        <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}>
          <View className="rounded-t-3xl p-5 max-h-[78%]" style={{ backgroundColor: colors.cardBg }}>
            <View className="flex-row items-center mb-3"><Text className="text-lg font-bold flex-1" style={{ color: colors.textPrimary }}>建立思想关系</Text><Pressable onPress={() => setRelationModal(null)}><X size={20} color={colors.textSecondary} /></Pressable></View>
            <Text className="text-xs mb-2" style={{ color: colors.textMuted }}>源实体：{relationModal?.name}</Text>
            <TextInput value={relationType} onChangeText={setRelationType} placeholder="关系类型，例如：影响、反驳、支持、包含、属于" placeholderTextColor={colors.textMuted} className="rounded-xl border px-3 py-2.5 mb-3 text-sm" style={{ color: colors.textPrimary, borderColor: colors.cardBorder, backgroundColor: colors.bg }} />
            <ScrollView>
              {relationTargets.filter(x => !relationModal || x.id !== relationModal.id || x.entity_type !== relationModal.entity_type).map((target) => <Pressable key={`target-${target.entity_type}-${target.id}`} onPress={() => makeRelation(target)} className="p-3 rounded-xl border mb-2" style={{ borderColor: colors.cardBorder, backgroundColor: colors.bg }}><Text className="text-xs font-semibold" style={{ color: colors.textPrimary }}>{target.name}</Text><Text className="text-[10px] mt-1" style={{ color: colors.textMuted }}>{TYPES.find(t => t.key === target.entity_type)?.label}</Text></Pressable>)}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
