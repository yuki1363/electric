import { describe, expect, it } from 'vitest';
import { generateHvSld } from '../src/layout/hvSld';
import { sampleProject } from '../src/model/defaults';
import { sheetGeom } from '../src/layout/constants';
import { isOrthogonal } from '../src/layout/router';
import { isPortEnd } from '../src/model/types';
import { getSymbol } from '../src/symbols';
import { bboxOfRect, overlaps } from '../src/geom/bbox';
import { elementPort } from '../src/layout/builder';

describe('高圧受電設備 単線結線図 生成', () => {
  const p = sampleProject();
  const { diagram: d, warnings } = generateHvSld(p.hv, p.meta, p.panels);

  it('警告なしで生成される', () => {
    expect(warnings).toEqual([]);
  });

  it('仕様どおりの機器が含まれる', () => {
    const kinds = d.elements.map((e) => e.kind);
    const count = (k: string) => kinds.filter((x) => x === k).length;
    expect(count('PAS')).toBe(1);
    expect(count('CABLE_HEAD')).toBe(1);
    expect(count('VCT')).toBe(1);
    expect(count('DS')).toBe(1);
    expect(count('CT')).toBe(1);
    expect(count('OCR')).toBe(1);
    expect(count('VCB')).toBe(1);
    expect(count('LA')).toBe(1);
    expect(count('VT')).toBe(1);
    expect(count('TR_1PH')).toBe(1);
    expect(count('TR_3PH')).toBe(1);
    expect(count('SC')).toBe(1);
    expect(count('SR')).toBe(1);
    expect(count('METER_WH')).toBe(1); // 取引用のみ
    expect(count('METER_V') + count('METER_A') + count('METER_W')).toBe(3);
    expect(count('GROUND_B')).toBe(2);
  });

  it('幹線機器は上から順に並ぶ', () => {
    const order = ['PAS', 'CABLE_HEAD', 'VCT', 'DS', 'CT', 'VCB'];
    const ys = order.map((k) => d.elements.find((e) => e.kind === k)!.y);
    for (let i = 1; i < ys.length; i++) expect(ys[i]!).toBeGreaterThan(ys[i - 1]!);
    // 幹線は同一 x
    const xs = order.map((k) => d.elements.find((e) => e.kind === k)!.x);
    expect(new Set(xs).size).toBe(1);
  });

  it('全配線は直交し、参照ポートが存在する', () => {
    for (const w of d.wires) {
      expect(isOrthogonal(w.points)).toBe(true);
      for (const end of [w.from, w.to]) {
        if (isPortEnd(end)) {
          const el = d.elements.find((e) => e.id === end.elementId);
          expect(el).toBeDefined();
          expect(getSymbol(el!.kind).ports.some((p) => p.id === end.portId)).toBe(true);
          // 端点はポート位置に一致
          const wp = elementPort(el!, end.portId).p;
          const pt = end === w.from ? w.points[0]! : w.points[w.points.length - 1]!;
          expect(pt.x).toBeCloseTo(wp.x, 6);
          expect(pt.y).toBeCloseTo(wp.y, 6);
        }
      }
    }
  });

  it('全要素は 5mm 格子に乗り、用紙内に収まる', () => {
    const g = sheetGeom(d.sheet);
    for (const e of d.elements) {
      expect(Math.abs(e.x % 5)).toBe(0);
      expect(Math.abs(e.y % 5)).toBe(0);
      const def = getSymbol(e.kind);
      expect(e.x - def.bbox.w / 2).toBeGreaterThanOrEqual(g.frame.x1);
      expect(e.x + def.bbox.w / 2).toBeLessThanOrEqual(g.frame.x2);
      expect(e.y - def.bbox.h / 2).toBeGreaterThanOrEqual(g.frame.y1);
      expect(e.y + def.bbox.h / 2).toBeLessThanOrEqual(g.drawable.y2);
    }
  });

  it('機器同士の外形が重ならない（接続点を除く）', () => {
    const els = d.elements.filter((e) => e.kind !== 'JUNCTION');
    for (let i = 0; i < els.length; i++) {
      for (let j = i + 1; j < els.length; j++) {
        const a = els[i]!;
        const b = els[j]!;
        const ba = bboxOfRect(a.x, a.y, getSymbol(a.kind).bbox.w, getSymbol(a.kind).bbox.h);
        const bb = bboxOfRect(b.x, b.y, getSymbol(b.kind).bbox.w, getSymbol(b.kind).bbox.h);
        expect(overlaps(ba, bb), `${a.kind}@${a.x},${a.y} と ${b.kind}@${b.x},${b.y} が重なる`).toBe(false);
      }
    }
  });

  it('母線は 1 本で、分岐数ぶんの接続点がある', () => {
    const bus = d.wires.filter((w) => w.style === 'bus');
    expect(bus.length).toBe(1);
    const busY = bus[0]!.points[0]!.y;
    const junctions = d.elements.filter((e) => e.kind === 'JUNCTION' && e.y === busY);
    // 幹線接続 + 3 分岐
    expect(junctions.length).toBe(4);
  });

  it('PF・S 形は PF と LBS を主遮断装置として描く', () => {
    const hv = { ...p.hv, mainBreaker: { type: 'PF-S' as const, lbs: { ratedA: 300 }, pfA: 40 } };
    const r = generateHvSld(hv, p.meta, p.panels);
    const kinds = r.diagram.elements.map((e) => e.kind);
    expect(kinds).not.toContain('VCB');
    expect(kinds).not.toContain('CT');
    expect(kinds.filter((k) => k === 'PF').length).toBe(1 + p.hv.transformers.length + p.hv.capacitors.length);
  });

  it('A4 では高さ超過の警告が出る', () => {
    const meta = { ...p.meta, sheet: { ...p.meta.sheet, size: 'A4' as const } };
    const r = generateHvSld(p.hv, meta, p.panels);
    expect(r.warnings.some((w) => w.includes('用紙'))).toBe(true);
  });

  it('決定的に生成される', () => {
    const a = generateHvSld(p.hv, p.meta, p.panels);
    const b = generateHvSld(p.hv, p.meta, p.panels);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
