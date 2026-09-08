import type { Prim, TextAnchor } from '../symbols/types';
import type { Diagram, Element, TextItem } from '../model/types';
import { getSymbol } from '../symbols';
import { transformPrims } from '../symbols/transform';
import { sheetFramePrims, type TitleInfo } from '../layout/sheet';
import { LINE_GAP, TEXT } from '../layout/constants';
import type { Layer } from './style';

export interface WorldPrim {
  layer: Layer;
  prim: Prim;
  /** 由来する要素/配線/テキストの id（キャンバスのヒット判定用） */
  ref?: string;
}

export interface LabelLine {
  x: number;
  y: number;
  text: string;
  h: number;
  anchor: TextAnchor;
}

/** 要素ラベルの各行の位置（回転 90/270 は記号の上に中央揃え） */
export function elementLabelLines(el: Element): LabelLine[] {
  if (el.labels.length === 0) return [];
  const def = getSymbol(el.kind);
  const k = el.scale ?? 1;
  const lines = el.labels;
  const hs = lines.map((_, i) => (i === 0 ? TEXT.name : TEXT.rating) * k);
  const ox = el.labelOffset?.x ?? 0;
  const oy = el.labelOffset?.y ?? 0;

  // 行の累積オフセット
  const offs: number[] = [];
  let acc = 0;
  hs.forEach((h, i) => {
    if (i > 0) acc += ((hs[i - 1]! + h) / 2) * LINE_GAP;
    offs.push(acc);
  });
  const total = acc;

  if (el.rot === 90 || el.rot === 270) {
    const y0 = el.y - (def.bbox.w / 2) * k - 3 * k - total - hs[hs.length - 1]! / 2;
    return lines.map((text, i) => ({ x: el.x + ox, y: y0 + offs[i]! + oy, text, h: hs[i]!, anchor: 'middle' as const }));
  }
  const la = def.labelAnchor;
  const y0 = el.y + la.dy * k - total / 2;
  return lines.map((text, i) => ({
    x: el.x + la.dx * k + ox,
    y: y0 + offs[i]! + oy,
    text,
    h: hs[i]!,
    anchor: la.anchor,
  }));
}

export function elementLabelPrims(el: Element): Prim[] {
  return elementLabelLines(el).map((l) => ({
    t: 'text',
    x: l.x,
    y: l.y,
    text: l.text,
    h: l.h,
    anchor: l.anchor,
    valign: 'middle',
  }));
}

export function elementPrims(el: Element): Prim[] {
  const def = getSymbol(el.kind);
  return transformPrims(def.prims, { x: el.x, y: el.y, rot: el.rot, scale: el.scale ?? 1 });
}

export function textItemPrim(t: TextItem): Prim {
  return { t: 'text', x: t.x, y: t.y, text: t.text, h: t.h, anchor: t.anchor, valign: 'middle', ...(t.rot ? { rot: t.rot } : {}) };
}

export interface FlattenOpts {
  /** 図枠・表題欄を含める */
  frame?: TitleInfo;
}

/** 図面をレイヤ付きワールド座標プリミティブ列へ（SVG / DXF 共通） */
export function flattenDiagram(d: Diagram, opts: FlattenOpts = {}): WorldPrim[] {
  const out: WorldPrim[] = [];

  if (opts.frame) {
    for (const prim of sheetFramePrims(d.sheet, opts.frame)) out.push({ layer: 'FRAME', prim });
  }
  for (const prim of d.shapes) out.push({ layer: 'TABLE', prim });

  for (const w of d.wires) {
    if (w.points.length < 2) continue;
    const len = w.points.reduce((s, p, i) => (i === 0 ? 0 : s + Math.abs(p.x - w.points[i - 1]!.x) + Math.abs(p.y - w.points[i - 1]!.y)), 0);
    if (len < 1e-6) continue;
    out.push({
      layer: w.style === 'bus' ? 'BUS' : w.style === 'control' ? 'CONTROL' : 'WIRE',
      prim: { t: 'polyline', pts: w.points.map((p) => ({ x: p.x, y: p.y })) },
      ref: w.id,
    });
  }

  for (const el of d.elements) {
    for (const prim of elementPrims(el)) out.push({ layer: 'SYMBOL', prim, ref: el.id });
    for (const prim of elementLabelPrims(el)) out.push({ layer: 'TEXT', prim, ref: el.id });
  }

  for (const t of d.texts) out.push({ layer: 'TEXT', prim: textItemPrim(t), ref: t.id });

  return out;
}
