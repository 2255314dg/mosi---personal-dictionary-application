import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Path, Line, Circle } from 'react-native-svg';
import { useTheme } from '@/context/ThemeContext';

export type UnderlineStyleType =
  | 'thick_solid' // 粗实线
  | 'wavy'        // 波浪线
  | 'double'      // 双线
  | 'dotted'      // 点状线
  | 'dashed'      // 虚线
  | 'strike'      // 删除线
  | 'emphasis';   // 着重号

interface StyledUnderlineProps {
  type: UnderlineStyleType;
  color?: string;
  width?: number;
}

export const StyledUnderlineSvg: React.FC<StyledUnderlineProps> = ({ type, color, width = 120 }) => {
  const { colors } = useTheme();
  const strokeColor = color || colors.accent;

  switch (type) {
    case 'thick_solid':
      return (
        <Svg width={width} height={6}>
          <Line x1="0" y1="3" x2={width} y2="3" stroke={strokeColor} strokeWidth="4" strokeLinecap="round" />
        </Svg>
      );
    case 'wavy':
      // 生成平滑正弦波浪线
      const waves = [];
      const waveLen = 12;
      for (let i = 0; i < width; i += waveLen) {
        waves.push(`q ${waveLen / 4} -3, ${waveLen / 2} 0 t ${waveLen / 2} 0`);
      }
      return (
        <Svg width={width} height={8}>
          <Path d={`M 0 4 ${waves.join(' ')}`} stroke={strokeColor} strokeWidth="2" fill="none" />
        </Svg>
      );
    case 'double':
      return (
        <Svg width={width} height={6}>
          <Line x1="0" y1="1.5" x2={width} y2="1.5" stroke={strokeColor} strokeWidth="1.5" />
          <Line x1="0" y1="4.5" x2={width} y2="4.5" stroke={strokeColor} strokeWidth="1.5" />
        </Svg>
      );
    case 'dotted':
      return (
        <Svg width={width} height={6}>
          <Line
            x1="0"
            y1="3"
            x2={width}
            y2="3"
            stroke={strokeColor}
            strokeWidth="3"
            strokeDasharray="2, 6"
            strokeLinecap="round"
          />
        </Svg>
      );
    case 'dashed':
      return (
        <Svg width={width} height={6}>
          <Line
            x1="0"
            y1="3"
            x2={width}
            y2="3"
            stroke={strokeColor}
            strokeWidth="2"
            strokeDasharray="6, 4"
            strokeLinecap="round"
          />
        </Svg>
      );
    case 'strike':
      return (
        <Svg width={width} height={6}>
          <Line x1="0" y1="3" x2={width} y2="3" stroke={strokeColor} strokeWidth="2" />
        </Svg>
      );
    case 'emphasis':
      // 底部着重圆点
      const dots = [];
      const dotSpacing = 16;
      for (let x = 8; x < width; x += dotSpacing) {
        dots.push(<Circle key={x} cx={x} cy={3} r={2} fill={strokeColor} />);
      }
      return (
        <Svg width={width} height={6}>
          {dots}
        </Svg>
      );
    default:
      return (
        <Svg width={width} height={4}>
          <Line x1="0" y1="2" x2={width} y2="2" stroke={strokeColor} strokeWidth="2" />
        </Svg>
      );
  }
};
