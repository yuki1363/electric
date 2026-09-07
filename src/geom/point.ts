import type { Point } from '../symbols/types';

export const add = (a: Point, b: Point): Point => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y });
export const scale = (a: Point, k: number): Point => ({ x: a.x * k, y: a.y * k });
export const eq = (a: Point, b: Point, eps = 1e-6): boolean =>
  Math.abs(a.x - b.x) < eps && Math.abs(a.y - b.y) < eps;

export const snapValue = (v: number, grid: number): number => Math.round(v / grid) * grid;
export const snap = (p: Point, grid: number): Point => ({
  x: snapValue(p.x, grid),
  y: snapValue(p.y, grid),
});

/** 小数誤差を丸める（出力用） */
export const round = (v: number, digits = 4): number => {
  const k = 10 ** digits;
  const r = Math.round(v * k) / k;
  return Object.is(r, -0) ? 0 : r;
};

/** 連続する重複点・共線点を除去する */
export function simplifyPolyline(pts: Point[]): Point[] {
  const out: Point[] = [];
  for (const p of pts) {
    const last = out[out.length - 1];
    if (last && eq(last, p)) continue;
    out.push({ x: p.x, y: p.y });
  }
  if (out.length < 3) return out;
  const res: Point[] = [out[0]!];
  for (let i = 1; i < out.length - 1; i++) {
    const a = res[res.length - 1]!;
    const b = out[i]!;
    const c = out[i + 1]!;
    const cross = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    if (Math.abs(cross) < 1e-9) continue; // 共線
    res.push(b);
  }
  res.push(out[out.length - 1]!);
  return res;
}
