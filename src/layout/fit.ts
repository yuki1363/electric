import type { Prim } from '../symbols/types';
import type { Diagram } from '../model/types';
import { bboxOfPrims, isEmptyBBox, union, type BBox } from '../geom/bbox';
import { elementLabelPrims, elementPrims } from '../render/flatten';
import { round } from '../geom/point';
import { sheetGeom } from './constants';

/** これ以上小さくすると読めないので下限を設ける */
export const MIN_SCALE = 0.35;

/** 丸め誤差で枠を割らないための余裕 mm */
const PAD = 1;

/** 図枠を除いた図面内容の外接矩形（図記号・ラベル・配線・テキスト・表の罫線すべて） */
export function contentBBox(d: Diagram): BBox {
  let b = bboxOfPrims([]);
  for (const el of d.elements) {
    b = union(b, bboxOfPrims(elementPrims(el)));
    b = union(b, bboxOfPrims(elementLabelPrims(el)));
  }
  for (const w of d.wires) {
    if (w.points.length < 2) continue;
    b = union(b, bboxOfPrims([{ t: 'polyline', pts: w.points }]));
  }
  const texts: Prim[] = d.texts.map((t) => ({
    t: 'text',
    x: t.x,
    y: t.y,
    text: t.text,
    h: t.h,
    anchor: t.anchor,
    ...(t.rot ? { rot: t.rot } : {}),
  }));
  b = union(b, bboxOfPrims(texts));
  b = union(b, bboxOfPrims(d.shapes));
  return b;
}

function scalePrim(p: Prim, k: number, ox: number, oy: number): Prim {
  const X = (x: number) => ox + x * k;
  const Y = (y: number) => oy + y * k;
  switch (p.t) {
    case 'line':
      return { ...p, x1: X(p.x1), y1: Y(p.y1), x2: X(p.x2), y2: Y(p.y2) };
    case 'circle':
      return { ...p, cx: X(p.cx), cy: Y(p.cy), r: p.r * k };
    case 'arc':
      return { ...p, cx: X(p.cx), cy: Y(p.cy), r: p.r * k };
    case 'polyline':
      return { ...p, pts: p.pts.map((q) => ({ x: X(q.x), y: Y(q.y) })) };
    case 'text':
      return { ...p, x: X(p.x), y: Y(p.y), h: p.h * k };
  }
}

export interface FitResult {
  diagram: Diagram;
  /** 適用した縮尺（1 = 等倍） */
  scale: number;
  /** 縮尺の下限に当たって収まりきらなかった */
  overflow: boolean;
}

/**
 * 図面の内容を用紙の描画領域に収める。
 *
 * 図記号ごと一様に縮小し、要素の座標・配線・テキスト・罫線をすべて同じ倍率で
 * 変換する。収まっている図面には何もしない（等倍のまま座標を動かさない）。
 */
export function fitDiagram(d: Diagram): FitResult {
  const g = sheetGeom(d.sheet);
  const b = contentBBox(d);
  if (isEmptyBBox(b)) return { diagram: d, scale: 1, overflow: false };

  const availW = g.drawable.x2 - g.drawable.x1;
  const availH = g.drawable.y2 - g.drawable.y1;
  const w = b.maxX - b.minX;
  const h = b.maxY - b.minY;

  let scale = 1;
  let overflow = false;
  let ox: number;
  let oy: number;

  if (w <= availW && h <= availH) {
    // 大きさは足りている。枠から出ている分だけ最小限ずらす
    const dx = Math.max(0, g.drawable.x1 - b.minX) - Math.max(0, b.maxX - g.drawable.x2);
    const dy = Math.max(0, g.drawable.y1 - b.minY) - Math.max(0, b.maxY - g.drawable.y2);
    if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) return { diagram: d, scale: 1, overflow: false };
    ox = dx;
    oy = dy;
  } else {
    // 縮小する。切り捨てで丸めないと丸め上げで枠を割る
    const raw = Math.min((availW - PAD) / Math.max(w, 1e-6), (availH - PAD) / Math.max(h, 1e-6), 1);
    overflow = raw < MIN_SCALE;
    scale = Math.floor(Math.max(raw, MIN_SCALE) * 1000) / 1000;
    // 縮小後の内容を描画領域の左上に寄せて配置する
    ox = g.drawable.x1 - b.minX * scale;
    oy = g.drawable.y1 - b.minY * scale;
  }
  const X = (x: number) => round(ox + x * scale, 3);
  const Y = (y: number) => round(oy + y * scale, 3);

  const diagram: Diagram = {
    ...d,
    scale,
    elements: d.elements.map((el) => ({
      ...el,
      x: X(el.x),
      y: Y(el.y),
      scale: round((el.scale ?? 1) * scale, 4),
      ...(el.labelOffset
        ? { labelOffset: { x: el.labelOffset.x * scale, y: el.labelOffset.y * scale } }
        : {}),
    })),
    wires: d.wires.map((wire) => ({
      ...wire,
      from: 'elementId' in wire.from ? wire.from : { x: X(wire.from.x), y: Y(wire.from.y) },
      to: 'elementId' in wire.to ? wire.to : { x: X(wire.to.x), y: Y(wire.to.y) },
      points: wire.points.map((p) => ({ x: X(p.x), y: Y(p.y) })),
    })),
    texts: d.texts.map((t) => ({ ...t, x: X(t.x), y: Y(t.y), h: round(t.h * scale, 3) })),
    shapes: d.shapes.map((p) => scalePrim(p, scale, ox, oy)),
  };
  return { diagram, scale, overflow };
}

/** 表題欄に出す縮尺表記（1:1 / 1:1.4 など） */
export function scaleLabel(scale: number | undefined): string {
  if (!scale || Math.abs(scale - 1) < 1e-6) return '1:1';
  return `1:${round(1 / scale, 2)}`;
}

/** 図記号が小さくなりすぎていないか（警告用） */
export function isTight(scale: number): boolean {
  return scale < 0.6;
}
