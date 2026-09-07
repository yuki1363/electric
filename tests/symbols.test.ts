import { describe, expect, it } from 'vitest';
import { ALL_SYMBOLS, SYMBOLS, getSymbol } from '../src/symbols';
import { bboxOfPrims, isEmptyBBox } from '../src/geom/bbox';
import { portToWorld, rotateDir, rotatePoint, transformPrim } from '../src/symbols/transform';

describe('図記号定義', () => {
  it('kind とレジストリのキーが一致する', () => {
    for (const s of ALL_SYMBOLS) {
      expect(SYMBOLS[s.kind]).toBe(s);
    }
    expect(Object.keys(SYMBOLS).length).toBe(ALL_SYMBOLS.length);
  });

  it('ポート id が一意で、ポートは bbox 内にある', () => {
    for (const s of ALL_SYMBOLS) {
      const ids = s.ports.map((p) => p.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const p of s.ports) {
        expect(Math.abs(p.x)).toBeLessThanOrEqual(s.bbox.w / 2 + 1e-9);
        expect(Math.abs(p.y)).toBeLessThanOrEqual(s.bbox.h / 2 + 1e-9);
      }
    }
  });

  it('ポート座標は 5mm 格子に乗る', () => {
    for (const s of ALL_SYMBOLS) {
      for (const p of s.ports) {
        expect(Math.abs(p.x % 5)).toBe(0);
        expect(Math.abs(p.y % 5)).toBe(0);
      }
    }
  });

  it('プリミティブは bbox 内に収まる（LABEL を除く）', () => {
    for (const s of ALL_SYMBOLS) {
      if (s.prims.length === 0) continue;
      const b = bboxOfPrims(s.prims.filter((p) => p.t !== 'text'));
      if (isEmptyBBox(b)) continue;
      expect(b.minX).toBeGreaterThanOrEqual(-s.bbox.w / 2 - 0.01);
      expect(b.maxX).toBeLessThanOrEqual(s.bbox.w / 2 + 0.01);
      expect(b.minY).toBeGreaterThanOrEqual(-s.bbox.h / 2 - 0.01);
      expect(b.maxY).toBeLessThanOrEqual(s.bbox.h / 2 + 0.01);
    }
  });

  it('円弧の半径・角度は有限値', () => {
    for (const s of ALL_SYMBOLS) {
      for (const p of s.prims) {
        if (p.t === 'arc') {
          expect(p.r).toBeGreaterThan(0);
          expect(Number.isFinite(p.start)).toBe(true);
          expect(Number.isFinite(p.end)).toBe(true);
        }
      }
    }
  });

  it('未定義の kind は例外', () => {
    expect(() => getSymbol('NOPE' as never)).toThrow();
  });
});

describe('座標変換', () => {
  it('90° 回転で N が E になる（y 下向き）', () => {
    expect(rotatePoint({ x: 0, y: -10 }, 90)).toEqual({ x: 10, y: 0 });
    expect(rotateDir('N', 90)).toBe('E');
    expect(rotateDir('W', 90)).toBe('N');
    expect(rotateDir('S', 270)).toBe('E');
  });

  it('ポートのワールド変換', () => {
    const p = portToWorld({ id: 'N', x: 0, y: -10, dir: 'N' }, { x: 100, y: 50, rot: 90 });
    expect(p).toEqual({ id: 'N', x: 110, y: 50, dir: 'E' });
  });

  it('円弧の角度に回転が加算される', () => {
    const r = transformPrim({ t: 'arc', cx: 0, cy: 0, r: 1, start: -90, end: 90 }, { x: 5, y: 5, rot: 180 });
    expect(r).toMatchObject({ cx: 5, cy: 5, start: 90, end: 270 });
  });
});
