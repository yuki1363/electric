/** 全角 = 文字高、半角 = 0.55 × 文字高 として幅を推定する */
export function estimateTextWidth(text: string, h: number): number {
  let w = 0;
  for (const ch of text) {
    w += isFullWidth(ch) ? h : h * 0.55;
  }
  return w;
}

export function isFullWidth(ch: string): boolean {
  const c = ch.codePointAt(0) ?? 0;
  return (
    (c >= 0x1100 && c <= 0x115f) ||
    (c >= 0x2e80 && c <= 0xa4cf) ||
    (c >= 0xac00 && c <= 0xd7a3) ||
    (c >= 0xf900 && c <= 0xfaff) ||
    (c >= 0xfe30 && c <= 0xfe4f) ||
    (c >= 0xff00 && c <= 0xff60) ||
    (c >= 0xffe0 && c <= 0xffe6) ||
    c === 0x3c6 || // φ
    (c >= 0x20000 && c <= 0x3fffd)
  );
}

/** 幅 maxW に収まるよう文字境界で折り返す */
export function wrapText(text: string, h: number, maxW: number): string[] {
  if (estimateTextWidth(text, h) <= maxW) return [text];
  const lines: string[] = [];
  let cur = '';
  for (const ch of text) {
    if (cur && estimateTextWidth(cur + ch, h) > maxW) {
      lines.push(cur);
      cur = ch;
    } else {
      cur += ch;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}
