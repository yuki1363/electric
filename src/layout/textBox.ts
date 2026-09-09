import type { BBox } from '../geom/bbox';
import type { TextItem } from '../model/types';
import type { LabelLine } from '../render/flatten';
import { estimateTextWidth } from './textWidth';

/** 文字列の外接矩形（推定幅・行高から） */
export function textBox(x: number, y: number, text: string, h: number, anchor: 'start' | 'middle' | 'end'): BBox {
  const w = Math.max(estimateTextWidth(text, h), h);
  const x0 = anchor === 'middle' ? x - w / 2 : anchor === 'end' ? x - w : x;
  return { minX: x0, minY: y - h * 0.6, maxX: x0 + w, maxY: y + h * 0.6 };
}

export const textBBox = (t: TextItem): BBox => textBox(t.x, t.y, t.text, t.h, t.anchor);
export const labelLineBBox = (l: LabelLine): BBox => textBox(l.x, l.y, l.text, l.h, l.anchor);
