import React, { useMemo, useState } from 'react';
import { Modal, View, Text, Pressable } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { Check, RotateCcw } from 'lucide-react-native';

interface Props {
  visible: boolean;
  mode?: 'setup' | 'verify';
  targetPattern?: number[];
  onSuccess: (pattern: number[]) => void;
  onCancel?: () => void;
}

export function GesturePatternModal({ visible, mode='verify', targetPattern, onSuccess, onCancel }: Props) {
  const { colors } = useTheme();
  const [pattern, setPattern] = useState<number[]>([]);
  const [error, setError] = useState('');
  const points = useMemo(() => Array.from({ length: 9 }, (_, i) => i), []);

  const pressPoint = (point: number) => {
    if (pattern.includes(point)) return;
    const next = [...pattern, point];
    setPattern(next);
    setError('');
  };

  const confirm = () => {
    if (pattern.length < 4) { setError('至少连接 4 个点'); return; }
    if (mode === 'verify') {
      if (targetPattern && targetPattern.join('-') === pattern.join('-')) onSuccess(pattern);
      else { setError('手势密码错误'); setPattern([]); }
      return;
    }
    onSuccess(pattern);
    setPattern([]);
  };

  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
    <View style={{ flex:1, backgroundColor:'rgba(0,0,0,.58)', justifyContent:'center', alignItems:'center', padding:24 }}>
      <View style={{ width:'100%', maxWidth:360, borderRadius:28, padding:24, backgroundColor:colors.cardBg }}>
        <Text style={{ color:colors.textPrimary, fontSize:18, fontWeight:'800', textAlign:'center' }}>
          {mode === 'setup' ? '设置应用手势密码' : '请输入手势密码'}
        </Text>
        <Text style={{ color:colors.textMuted, fontSize:12, textAlign:'center', marginTop:8 }}>
          {mode === 'setup' ? '请连接至少 4 个不同的圆点' : '手势验证由管理员统一控制'}
        </Text>
        <View style={{ width:260, height:260, alignSelf:'center', marginTop:20, flexDirection:'row', flexWrap:'wrap', alignContent:'space-between', justifyContent:'space-between', padding:20 }}>
          {points.map((p) => {
            const selected = pattern.includes(p);
            const order = pattern.indexOf(p);
            return <Pressable key={p} onPress={() => pressPoint(p)} style={{ width:58, height:58, borderRadius:29, borderWidth:2, borderColor:selected?colors.accent:colors.cardBorder, backgroundColor:selected?colors.accentBg:colors.bg, alignItems:'center', justifyContent:'center' }}>
              <Text style={{ color:selected?colors.accent:colors.textMuted, fontWeight:'800' }}>{selected ? order+1 : '•'}</Text>
            </Pressable>
          })}
        </View>
        {error ? <Text style={{ color:'#DC2626', textAlign:'center', fontSize:12, marginBottom:8 }}>{error}</Text> : null}
        <View style={{ flexDirection:'row', gap:10 }}>
          <Pressable onPress={() => setPattern([])} style={{ flex:1, paddingVertical:12, borderRadius:14, borderWidth:1, borderColor:colors.cardBorder, alignItems:'center', flexDirection:'row', justifyContent:'center' }}>
            <RotateCcw size={15} color={colors.textSecondary}/><Text style={{ color:colors.textSecondary, marginLeft:6, fontWeight:'700' }}>重画</Text>
          </Pressable>
          <Pressable onPress={confirm} style={{ flex:1, paddingVertical:12, borderRadius:14, backgroundColor:colors.accent, alignItems:'center', flexDirection:'row', justifyContent:'center' }}>
            <Check size={15} color="#fff"/><Text style={{ color:'#fff', marginLeft:6, fontWeight:'700' }}>确认</Text>
          </Pressable>
        </View>
        {onCancel ? <Pressable onPress={onCancel} style={{ padding:10, alignItems:'center', marginTop:4 }}><Text style={{ color:colors.textMuted, fontSize:12 }}>取消</Text></Pressable> : null}
      </View>
    </View>
  </Modal>;
}
