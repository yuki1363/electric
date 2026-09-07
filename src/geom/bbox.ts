import type { Point, Prim } from '../symbols/types';

export interface BBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export const emptyBBox = (): BBox => ({
  minX: Infinity,
  minY: Infinity,
  maxX: -Infinity,
  maxY: -Infinity,
});

export const isEmptyBBox = (b: BBox): boolean => b.minX > b.maxX || b.minY > b.maxY;

export function extend(b: BBox, p: Point): BBox {
  return {
    minX: Math.min(b.minX, p.x),
    minY: Math.min(b.minY, p.y),
    maxX: Math.max(b.maxX, p.x),
    maxY: Math.max(b.maxY, p.y),
  };
}

export function union(a: BBox, b: BBox): BBox {
  if (isEmptyBBox(a)) return b;
  if (isEmptyBBox(b)) return a;
  return {
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY),
  };
}

export function bboxOfRect(cx: number, cy: number, w: number, h: number): BBox {
  return { minX: cx - w / 2, minY: cy - h / 2, maxX: cx + w / 2, maxY: cy + h / 2 };
}

export function contains(b: BBox, p: Point): boolean {
  return p.x >= b.minX && p.x <= b.maxX && p.y >= b.minY && p.y <= b.maxY;
}

export function overlaps(a: BBox, b: BBox): boolean {
  return a.minX < b.maxX && b.minX < a.maxX && a.minY < b.maxY && b.minY < a.maxY;
}

export function inflate(b: BBox, d: number): BBox {
  return { minX: b.minX - d, minY: b.minY - d, maxX: b.maxX + d, maxY: b.maxY + d };
}

/** プリミティブ列の外接矩形（テキストは概算） */
export function bboxOfPrims(prims: Prim[]): BBox {
  let b = emptyBBox();
  for (const p of prims) {
    switch (p.t) {
      case 'line':
        b = extend(extend(b, { x: p.x1, y: p.y1 }), { x: p.x2, y: p.y2 });
        break;
      case 'circle':
      case 'arc':
        b = extend(extend(b, { x: p.cx - p.r, y: p.cy - p.r }), { x: p.cx + p.r, y: p.cy + p.r });
        break;
      case 'polyline':
        for (const q of p.pts) b = extend(b, q);
        break;
      case 'text': {
        const w = p.text.length * p.h;
        const x0 = p.anchor === 'middle' ? p.x - w / 2 : p.anchor === 'end' ? p.x - w : p.x;
        b = extend(extend(b, { x: x0, y: p.y - p.h }), { x: x0 + w, y: p.y });
        break;
      }
    }
  }
  return b;
}
