import type { BBox } from '../../geom/bbox';
import { overlaps } from '../../geom/bbox';
import type { Diagram, TextItem } from '../../model/types';
import { elementBBox } from '../../layout/builder';
import { elementLabelLines, type LabelLine } from '../../render/flatten';
import { estimateTextWidth } from '../../layout/textWidth';

export { elementBBox };

function textBox(x: number, y: number, text: string, h: number, anchor: 'start' | 'middle' | 'end'): BBox {
  const w = Math.max(estimateTextWidth(text, h), h);
  const x0 = anchor === 'middle' ? x - w / 2 : anchor === 'end' ? x - w : x;
  return { minX: x0, minY: y - h * 0.6, maxX: x0 + w, maxY: y + h * 0.6 };
}

export function textBBox(t: TextItem): BBox {
  return textBox(t.x, t.y, t.text, t.h, t.anchor);
}

export function labelLineBBox(l: LabelLine): BBox {
  return textBox(l.x, l.y, l.text, l.h, l.anchor);
}

export function labelBBoxes(el: Parameters<typeof elementLabelLines>[0]): BBox[] {
  return elementLabelLines(el).map(labelLineBBox);
}

export function wireBBox(points: { x: number; y: number }[]): BBox {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}

/** 矩形と交差する項目 id */
export function itemsInRect(d: Diagram, r: BBox): string[] {
  const out: string[] = [];
  for (const e of d.elements) if (overlaps(elementBBox(e), r)) out.push(e.id);
  for (const t of d.texts) if (overlaps(textBBox(t), r)) out.push(t.id);
  for (const w of d.wires) {
    if (w.points.length < 2) continue;
    const b = wireBBox(w.points);
    // 線分の太さぶんを持たせる
    if (overlaps({ minX: b.minX - 0.5, minY: b.minY - 0.5, maxX: b.maxX + 0.5, maxY: b.maxY + 0.5 }, r)) out.push(w.id);
  }
  return out;
}

export function itemKind(d: Diagram, id: string): 'element' | 'wire' | 'text' | null {
  if (d.elements.some((e) => e.id === id)) return 'element';
  if (d.wires.some((w) => w.id === id)) return 'wire';
  if (d.texts.some((t) => t.id === id)) return 'text';
  return null;
}

/** 点と直交線分の距離 */
function distToSegment(p: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-12) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** p から tol mm 以内にある最も近い配線 */
export function nearestWireAt(d: Diagram, p: { x: number; y: number }, tol: number): string | null {
  let best: { id: string; d: number } | null = null;
  for (const w of d.wires) {
    for (let i = 1; i < w.points.length; i++) {
      const dist = distToSegment(p, w.points[i - 1]!, w.points[i]!);
      if (dist <= tol && (!best || dist < best.d)) best = { id: w.id, d: dist };
    }
  }
  return best ? best.id : null;
}
