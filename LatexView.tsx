import React, { useMemo } from 'react';
import { View, Text, Platform } from 'react-native';
import { useState } from 'react';
import { WebView } from 'react-native-webview';
import { useTheme } from '@/context/ThemeContext';

function normalizeLatex(input: string): string {
  return input
    .replace(/\\\[/g, '')
    .replace(/\\\]/g, '')
    .replace(/\\\(/g, '')
    .replace(/\\\)/g, '')
    .replace(/\\frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, '\\frac{$1}{$2}')
    .replace(/\\left\s*\{/g, '\\left\\{')
    .replace(/\\right\s*\}/g, '\\right\\}')
    .trim();
}

export const LatexView: React.FC<{ latex: string; display?: boolean }> = ({ latex, display=true }) => {
  const { colors } = useTheme();
  const [height, setHeight] = useState(display ? 72 : 34);
  const formula = useMemo(() => normalizeLatex(latex), [latex]);
  const html = useMemo(() => `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"/><link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.22/dist/katex.min.css"><style>html,body{margin:0;padding:0;background:transparent;color:${colors.textPrimary};overflow:hidden}.wrap{padding:4px 2px;text-align:${display?'center':'left'}}.katex{font-size:1.12em}</style><script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.22/dist/katex.min.js"></script></head><body><div id="m" class="wrap"></div><script>window.onload=function(){try{katex.render(${JSON.stringify(formula)},document.getElementById('m'),{displayMode:${display},throwOnError:false,strict:false})}catch(e){document.getElementById('m').textContent=${JSON.stringify(formula)}}document.documentElement.style.background='transparent';window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(String(Math.max(document.body.scrollHeight,document.documentElement.scrollHeight)));};}</script></body></html>`, [formula, colors.textPrimary, display]);

  if (Platform.OS === 'web') {
    return <View style={{ paddingVertical:4 }}><Text style={{ color:colors.textPrimary, fontFamily:'monospace', textAlign:display?'center':'left' }}>{formula}</Text></View>;
  }
  return <View style={{ height, marginVertical:4 }}><WebView originWhitelist={['*']} source={{ html }} scrollEnabled={false} javaScriptEnabled domStorageEnabled backgroundColor="transparent" onMessage={(e)=>{const n=Number(e.nativeEvent.data);if(Number.isFinite(n))setHeight(Math.max(display?48:28, Math.min(360,n+8)));}} style={{ backgroundColor:'transparent' }} /></View>;
};
