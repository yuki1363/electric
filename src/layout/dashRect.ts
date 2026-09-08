import type { Prim } from '../symbols/types';
import { L } from '../symbols/helpers';

/**
 * 破線の矩形を短い線分の並びで作る。
 * 図記号の Prim には線種が無く、DXF R12 に LTYPE を足すのは重いので、
 * 線分の連なりで描いて SVG・DXF の両方でそのまま破線に見えるようにする。
 */
export function dashedRect(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  o: { dash?: number; gap?: number } = {},
): Prim[] {
  const dash = o.dash ?? 4;
  const gap = o.gap ?? 2.5;
  const out: Prim[] = [];
  const seg = (ax: number, ay: number, bx: number, by: number) => {
    const len = Math.hypot(bx - ax, by - ay);
    if (len < 1e-9) return;
    const ux = (bx - ax) / len;
    const uy = (by - ay) / len;
    for (let t = 0; t < len; t += dash + gap) {
      const e = Math.min(t + dash, len);
      out.push(L(ax + ux * t, ay + uy * t, ax + ux * e, ay + uy * e, 'thin'));
    }
  };
  seg(x1, y1, x2, y1);
  seg(x2, y1, x2, y2);
  seg(x2, y2, x1, y2);
  seg(x1, y2, x1, y1);
  return out;
}
