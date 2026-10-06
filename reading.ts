import * as Speech from 'expo-speech';

function cleanForSpeech(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, '。')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '。')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,7}\s+/gm, '')
    .replace(/^>\s*/gm, '')
    .replace(/\*\*|__|\*|_|`/g, '')
    .replace(/\$\$[\s\S]*?\$\$/g, '数学公式')
    .replace(/\\\[[\s\S]*?\\\]/g, '数学公式')
    .replace(/\\\([^)]*\\\)/g, '数学公式')
    .replace(/\|[^\n]+\|/g, '表格内容。')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitNatural(text: string, max=320): string[] {
  const chunks: string[] = [];
  let rest = text;
  while (rest.length > max) {
    const part = rest.slice(0,max);
    const cut = Math.max(part.lastIndexOf('。'), part.lastIndexOf('！'), part.lastIndexOf('？'), part.lastIndexOf('；'), part.lastIndexOf('，'));
    const idx = cut > max * 0.45 ? cut + 1 : max;
    chunks.push(rest.slice(0,idx));
    rest = rest.slice(idx);
  }
  if (rest) chunks.push(rest);
  return chunks;
}

export async function speakMosiArticle(markdown: string, onStart?:()=>void, onDone?:()=>void) {
  await Speech.stop();
  const text = cleanForSpeech(markdown);
  const chunks = splitNatural(text);
  if (!chunks.length) return;
  const voices = await Speech.getAvailableVoicesAsync();
  const zhVoice = voices.find(v => /^zh(-CN|_CN)?/i.test(v.language || '') && String(v.quality) === 'Enhanced') || voices.find(v => /^zh(-CN|_CN)?/i.test(v.language || ''));
  onStart?.();
  const speakNext = (index:number) => {
    if (index >= chunks.length) { onDone?.(); return; }
    const chunk = chunks[index];
    const emotional = /[！!]/.test(chunk) ? { pitch:1.06, rate:0.92 } : /[？?]/.test(chunk) ? { pitch:1.02, rate:0.90 } : /[。；]/.test(chunk) ? { pitch:0.98, rate:0.88 } : { pitch:1.0, rate:0.94 };
    Speech.speak(chunk, { language:'zh-CN', voice:zhVoice?.identifier, ...emotional, onDone:()=>speakNext(index+1), onError:()=>speakNext(index+1) });
  };
  speakNext(0);
}

export async function stopMosiReading() { await Speech.stop(); }
