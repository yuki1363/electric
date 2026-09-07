import type { Point, PortDir } from '../symbols/types';
import { dirVec } from '../symbols/transform';
import { simplifyPolyline, snapValue } from '../geom/point';
import { GRID, STUB } from './constants';

export interface RouteEnd {
  p: Point;
  dir?: PortDir;
}

/**
 * 直交配線ルータ。
 * 両端をポート方向へ STUB だけ出し、同一 x/y なら直結、そうでなければ Z 型に折る。
 */
export function routeWire(a: RouteEnd, b: RouteEnd, stub = STUB): Point[] {
  const a1 = a.dir ? off(a.p, a.dir, stub) : a.p;
  const b1 = b.dir ? off(b.p, b.dir, stub) : b.p;
  const pts: Point[] = [a.p, a1];

  const sameX = Math.abs(a1.x - b1.x) < 1e-9;
  const sameY = Math.abs(a1.y - b1.y) < 1e-9;
  if (!sameX && !sameY && a.dir && !b.dir) {
    // 点への配線は L 字: ポート方向へ進んでから曲がる
    const vertical = a.dir === 'N' || a.dir === 'S';
    pts.push(vertical ? { x: a1.x, y: b1.y } : { x: b1.x, y: a1.y });
  } else if (!sameX && !sameY && !a.dir && b.dir) {
    const vertical = b.dir === 'N' || b.dir === 'S';
    pts.push(vertical ? { x: b1.x, y: a1.y } : { x: a1.x, y: b1.y });
  } else if (!sameX && !sameY) {
    const vertical = a.dir ? a.dir === 'N' || a.dir === 'S' : true;
    if (vertical) {
      const midY = snapValue((a1.y + b1.y) / 2, GRID);
      pts.push({ x: a1.x, y: midY }, { x: b1.x, y: midY });
    } else {
      const midX = snapValue((a1.x + b1.x) / 2, GRID);
      pts.push({ x: midX, y: a1.y }, { x: midX, y: b1.y });
    }
  }
  pts.push(b1, b.p);
  return simplifyPolyline(pts);
}

/** 既存の折線の一端だけを新しい位置へ追従させる（manual 配線用） */
export function stretchEnd(points: Point[], end: 'from' | 'to', np: Point): Point[] {
  if (points.length === 0) return [np];
  const pts = points.map((p) => ({ ...p }));
  if (end === 'from') {
    pts[0] = np;
    if (pts.length >= 2) {
      const nxt = pts[1]!;
      // 隣接セグメントを直交に保つ
      if (Math.abs(nxt.x - points[0]!.x) < 1e-9) nxt.x = np.x;
      else nxt.y = np.y;
    }
  } else {
    const last = pts.length - 1;
    pts[last] = np;
    if (pts.length >= 2) {
      const prv = pts[last - 1]!;
      if (Math.abs(prv.x - points[last]!.x) < 1e-9) prv.x = np.x;
      else prv.y = np.y;
    }
  }
  return simplifyPolyline(pts);
}

function off(p: Point, dir: PortDir, d: number): Point {
  const v = dirVec(dir);
  return { x: p.x + v.x * d, y: p.y + v.y * d };
}

export function isOrthogonal(points: Point[]): boolean {
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    if (Math.abs(a.x - b.x) > 1e-9 && Math.abs(a.y - b.y) > 1e-9) return false;
  }
  return true;
}
