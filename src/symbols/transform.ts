import type { Point, PortDef, PortDir, Prim } from './types';

export type Rot = 0 | 90 | 180 | 270;

export interface Placement {
  x: number;
  y: number;
  rot: Rot;
  /** 図記号の拡大率（既定 1）。用紙に収めるための自動縮尺に使う */
  scale?: number;
}

/** y 下向き空間での回転（正 = 時計回り） */
export function rotatePoint(p: Point, rot: Rot): Point {
  switch (rot) {
    case 0:
      return { x: p.x, y: p.y };
    case 90:
      return { x: -p.y, y: p.x };
    case 180:
      return { x: -p.x, y: -p.y };
    case 270:
      return { x: p.y, y: -p.x };
  }
}

export function toWorld(p: Point, pl: Placement): Point {
  const k = pl.scale ?? 1;
  const r = rotatePoint({ x: p.x * k, y: p.y * k }, pl.rot);
  return { x: r.x + pl.x, y: r.y + pl.y };
}

const DIR_ORDER: PortDir[] = ['N', 'E', 'S', 'W'];

export function rotateDir(dir: PortDir, rot: Rot): PortDir {
  const i = DIR_ORDER.indexOf(dir);
  return DIR_ORDER[(i + rot / 90) % 4]!;
}

export function dirVec(dir: PortDir): Point {
  switch (dir) {
    case 'N':
      return { x: 0, y: -1 };
    case 'S':
      return { x: 0, y: 1 };
    case 'E':
      return { x: 1, y: 0 };
    case 'W':
      return { x: -1, y: 0 };
  }
}

export function portToWorld(port: PortDef, pl: Placement): PortDef {
  const p = toWorld(port, pl);
  return { id: port.id, x: p.x, y: p.y, dir: rotateDir(port.dir, pl.rot) };
}

export function transformPrim(prim: Prim, pl: Placement): Prim {
  const k = pl.scale ?? 1;
  switch (prim.t) {
    case 'line': {
      const a = toWorld({ x: prim.x1, y: prim.y1 }, pl);
      const b = toWorld({ x: prim.x2, y: prim.y2 }, pl);
      return { ...prim, x1: a.x, y1: a.y, x2: b.x, y2: b.y };
    }
    case 'circle': {
      const c = toWorld({ x: prim.cx, y: prim.cy }, pl);
      return { ...prim, cx: c.x, cy: c.y, r: prim.r * k };
    }
    case 'arc': {
      const c = toWorld({ x: prim.cx, y: prim.cy }, pl);
      return { ...prim, cx: c.x, cy: c.y, r: prim.r * k, start: prim.start + pl.rot, end: prim.end + pl.rot };
    }
    case 'polyline':
      return { ...prim, pts: prim.pts.map((p) => toWorld(p, pl)) };
    case 'text': {
      const p = toWorld({ x: prim.x, y: prim.y }, pl);
      const rot = ((prim.rot ?? 0) + pl.rot) % 360;
      return { ...prim, x: p.x, y: p.y, h: prim.h * k, ...(rot ? { rot } : {}) };
    }
  }
}

export function transformPrims(prims: Prim[], pl: Placement): Prim[] {
  return prims.map((p) => transformPrim(p, pl));
}

export function translatePrim(prim: Prim, dx: number, dy: number): Prim {
  return transformPrim(prim, { x: dx, y: dy, rot: 0 });
}
