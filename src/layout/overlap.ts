import type { BBox } from '../geom/bbox';
import { overlaps } from '../geom/bbox';
import type { Diagram } from '../model/types';
import { elementLabelLines } from '../render/flatten';
import { elementBBox } from './builder';
import { labelLineBBox, textBox } from './textBox';

export interface Overlap {
  aId: string;
  bId: string;
  kind: 'symbol' | 'label' | 'mixed';
}

/** 判定に使う箱を少しだけ内側に縮める（線どうしが触れているだけを重なりとしない） */
const shrink = (b: BBox, m: number): BBox => ({
  minX: b.minX + m,
  minY: b.minY + m,
  maxX: b.maxX - m,
  maxY: b.maxY - m,
});

const valid = (b: BBox): boolean => b.maxX > b.minX && b.maxY > b.minY;

/**
 * 図記号どうし・ラベルどうし・ラベルと図記号の重なりを列挙する。
 *
 * 自動作図で機器名や定格が隣の列とぶつかるのを検出するためのもの。
 * 接続点（JUNCTION）と負荷矢印は線の上に重ねて置くので除く。
 */
export function findOverlaps(d: Diagram, margin = 0.6): Overlap[] {
  type Box = { id: string; b: BBox; label: boolean };
  const boxes: Box[] = [];
  for (const el of d.elements) {
    if (el.kind === 'JUNCTION') continue;
    const b = shrink(elementBBox(el), margin);
    if (valid(b)) boxes.push({ id: el.id, b, label: false });
    for (const l of elementLabelLines(el)) {
      const lb = shrink(labelLineBBox(l), margin);
      if (valid(lb)) boxes.push({ id: el.id, b: lb, label: true });
    }
  }
  for (const t of d.texts) {
    const b = shrink(textBox(t.x, t.y, t.text, t.h, t.anchor), margin);
    if (valid(b)) boxes.push({ id: t.id, b, label: true });
  }

  const out: Overlap[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i]!;
      const c = boxes[j]!;
      if (a.id === c.id) continue; // 同じ機器の記号とラベル
      if (!overlaps(a.b, c.b)) continue;
      const key = a.id < c.id ? `${a.id}|${c.id}` : `${c.id}|${a.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        aId: a.id,
        bId: c.id,
        kind: a.label && c.label ? 'label' : a.label || c.label ? 'mixed' : 'symbol',
      });
    }
  }
  return out;
}
