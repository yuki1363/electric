import { describe, expect, it } from 'vitest';
import { isOrthogonal, routeWire, stretchEnd } from '../src/layout/router';

describe('直交配線ルータ', () => {
  it('同一 x の縦配線は直線', () => {
    const pts = routeWire({ p: { x: 80, y: 40 }, dir: 'S' }, { p: { x: 80, y: 60 }, dir: 'N' });
    expect(pts).toEqual([
      { x: 80, y: 40 },
      { x: 80, y: 60 },
    ]);
  });

  it('端子スタブを含む L 字（E → N）', () => {
    const pts = routeWire({ p: { x: 80, y: 100 }, dir: 'E' }, { p: { x: 110, y: 105 }, dir: 'N' });
    expect(isOrthogonal(pts)).toBe(true);
    expect(pts[0]).toEqual({ x: 80, y: 100 });
    expect(pts[pts.length - 1]).toEqual({ x: 110, y: 105 });
    // スタブ後に水平→垂直
    expect(pts).toEqual([
      { x: 80, y: 100 },
      { x: 110, y: 100 },
      { x: 110, y: 105 },
    ]);
  });

  it('Z 字（縦→横→縦）', () => {
    const pts = routeWire({ p: { x: 0, y: 0 }, dir: 'S' }, { p: { x: 40, y: 40 }, dir: 'N' });
    expect(isOrthogonal(pts)).toBe(true);
    expect(pts.length).toBe(4);
    expect(pts[1]!.y).toBe(20);
    expect(pts[2]).toEqual({ x: 40, y: 20 });
  });

  it('点への配線は L 字', () => {
    const pts = routeWire({ p: { x: 10, y: 10 }, dir: 'S' }, { p: { x: 30, y: 40 } });
    expect(pts).toEqual([
      { x: 10, y: 10 },
      { x: 10, y: 40 },
      { x: 30, y: 40 },
    ]);
  });

  it('端子が接している場合は長さ 0', () => {
    const pts = routeWire({ p: { x: 5, y: 5 }, dir: 'S' }, { p: { x: 5, y: 5 }, dir: 'N' });
    expect(pts.length).toBeLessThanOrEqual(2);
    expect(pts.every((p) => p.x === 5 && p.y === 5)).toBe(true);
  });

  it('stretchEnd は直交を保ちつつ端点を追従', () => {
    const base = [
      { x: 0, y: 0 },
      { x: 0, y: 10 },
      { x: 20, y: 10 },
    ];
    const moved = stretchEnd(base, 'to', { x: 20, y: 30 });
    expect(isOrthogonal(moved)).toBe(true);
    expect(moved[moved.length - 1]).toEqual({ x: 20, y: 30 });
    const moved2 = stretchEnd(base, 'from', { x: 5, y: 0 });
    expect(isOrthogonal(moved2)).toBe(true);
    expect(moved2[0]).toEqual({ x: 5, y: 0 });
  });
});
