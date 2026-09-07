import type { LabelAnchor, PortDef, Prim, StrokeClass } from './types';

export const L = (x1: number, y1: number, x2: number, y2: number, stroke?: StrokeClass): Prim =>
  stroke ? { t: 'line', x1, y1, x2, y2, stroke } : { t: 'line', x1, y1, x2, y2 };

export const C = (cx: number, cy: number, r: number, fill = false): Prim =>
  fill ? { t: 'circle', cx, cy, r, fill: true } : { t: 'circle', cx, cy, r };

export const ARC = (cx: number, cy: number, r: number, start: number, end: number): Prim => ({
  t: 'arc',
  cx,
  cy,
  r,
  start,
  end,
});

export const PL = (pts: [number, number][], closed = false, fill = false, stroke?: StrokeClass): Prim => ({
  t: 'polyline',
  pts: pts.map(([x, y]) => ({ x, y })),
  ...(closed ? { closed: true } : {}),
  ...(fill ? { fill: true } : {}),
  ...(stroke ? { stroke } : {}),
});

export const RECT = (x1: number, y1: number, x2: number, y2: number, fill = false, stroke?: StrokeClass): Prim =>
  PL(
    [
      [x1, y1],
      [x2, y1],
      [x2, y2],
      [x1, y2],
    ],
    true,
    fill,
    stroke,
  );

export const T = (
  x: number,
  y: number,
  text: string,
  h: number,
  anchor: 'start' | 'middle' | 'end' = 'middle',
  valign: 'baseline' | 'middle' | 'top' = 'middle',
): Prim => ({ t: 'text', x, y, text, h, anchor, valign });

/** 縦2端子（N: 上, S: 下）。half = 中心から端子までの距離 */
export const portsNS = (half = 10): PortDef[] => [
  { id: 'N', x: 0, y: -half, dir: 'N' },
  { id: 'S', x: 0, y: half, dir: 'S' },
];

export const rightLabel = (w: number, dy = 0): LabelAnchor => ({ dx: w / 2 + 3, dy, anchor: 'start' });

/** 開閉器の可動接点（ブレード）。上端子 (0,-10) 〜 下端子 (0,10)。 */
export function bladePrims(): Prim[] {
  return [
    L(0, -10, 0, -4), // 上側リード
    L(0, 10, 0, 4), // 下側リード
    L(0, 4, 4.5, -4.5), // ブレード（開路状態）
  ];
}

/** 遮断器の固定接点 "×" */
export function crossPrims(cx: number, cy: number, s = 1.5): Prim[] {
  return [L(cx - s, cy - s, cx + s, cy + s), L(cx - s, cy + s, cx + s, cy - s)];
}
