import { describe, expect, it } from 'vitest';
import { MIN_SCALE, contentBBox, fitDiagram, scaleLabel } from '../src/layout/fit';
import { generateHvSld } from '../src/layout/hvSld';
import { regenerateAll } from '../src/layout';
import { sampleProject } from '../src/model/defaults';
import { sheetGeom } from '../src/layout/constants';
import { elementPort } from '../src/layout/builder';
import { isPortEnd, type HvSpec, type TransformerSpec } from '../src/model/types';

const base = sampleProject();

/** 変圧器を n 台持つ高圧仕様を作る */
function hvWith(n: number): HvSpec {
  const transformers: TransformerSpec[] = Array.from({ length: n }, (_, i) => ({
    id: `tr_${i + 1}`,
    name: `Tr-${i + 1}`,
    phase: i % 2 === 0 ? ('3φ' as const) : ('1φ' as const),
    kva: 100,
    secondary: '210V' as const,
    switch: 'LBS' as const,
    pfA: 30,
  }));
  return { ...base.hv, transformers, capacitors: [] };
}

function fitsInDrawable(d: ReturnType<typeof fitDiagram>['diagram']): boolean {
  const g = sheetGeom(d.sheet);
  const b = contentBBox(d);
  return (
    b.minX >= g.drawable.x1 - 0.05 &&
    b.maxX <= g.drawable.x2 + 0.05 &&
    b.minY >= g.drawable.y1 - 0.05 &&
    b.maxY <= g.drawable.y2 + 0.05
  );
}

describe('自動縮尺', () => {
  it('大きさが足りていれば等倍のまま、枠内へ最小限ずらすだけ', () => {
    const r = generateHvSld(hvWith(2), base.meta, base.panels);
    const fit = fitDiagram(r.diagram);
    expect(fit.scale).toBe(1);
    expect(fit.diagram.elements.every((e) => (e.scale ?? 1) === 1)).toBe(true);
    expect(fitsInDrawable(fit.diagram)).toBe(true);
    // 相対的な配置は変わらない（全体が同じ量だけ平行移動する）
    const dx = fit.diagram.elements[0]!.x - r.diagram.elements[0]!.x;
    const dy = fit.diagram.elements[0]!.y - r.diagram.elements[0]!.y;
    fit.diagram.elements.forEach((e, i) => {
      expect(e.x - r.diagram.elements[i]!.x).toBeCloseTo(dx, 6);
      expect(e.y - r.diagram.elements[i]!.y).toBeCloseTo(dy, 6);
    });
  });

  it('完全に枠内なら何も変えない', () => {
    const r = generateHvSld(hvWith(2), base.meta, base.panels);
    const once = fitDiagram(r.diagram).diagram;
    const twice = fitDiagram(once);
    expect(twice.scale).toBe(1);
    expect(JSON.stringify(twice.diagram)).toBe(JSON.stringify(once));
  });

  it('機器を増やしても用紙に収まる', () => {
    for (const n of [4, 8, 12, 16, 24]) {
      const r = generateHvSld(hvWith(n), base.meta, base.panels);
      const fit = fitDiagram(r.diagram);
      expect(fit.scale, `変圧器 ${n} 台`).toBeLessThanOrEqual(1);
      expect(fitsInDrawable(fit.diagram), `変圧器 ${n} 台で用紙からはみ出した`).toBe(true);
    }
  });

  it('縮小しても配線の端点は機器のポートに一致し続ける', () => {
    const r = generateHvSld(hvWith(12), base.meta, base.panels);
    const d = fitDiagram(r.diagram).diagram;
    for (const w of d.wires) {
      for (const [end, pt] of [
        [w.from, w.points[0]!],
        [w.to, w.points[w.points.length - 1]!],
      ] as const) {
        if (!isPortEnd(end)) continue;
        const el = d.elements.find((e) => e.id === end.elementId)!;
        const wp = elementPort(el, end.portId).p;
        expect(pt.x).toBeCloseTo(wp.x, 2);
        expect(pt.y).toBeCloseTo(wp.y, 2);
      }
    }
  });

  it('図記号・文字も同じ倍率で縮む', () => {
    const r = generateHvSld(hvWith(16), base.meta, base.panels);
    const fit = fitDiagram(r.diagram);
    expect(fit.scale).toBeLessThan(1);
    for (const e of fit.diagram.elements) expect(e.scale).toBeCloseTo(fit.scale, 3);
    for (const t of fit.diagram.texts) expect(t.h).toBeLessThan(5);
  });

  it('極端に多いと縮尺の下限で頭打ちになり overflow を返す', () => {
    const r = generateHvSld(hvWith(120), base.meta, base.panels);
    const fit = fitDiagram(r.diagram);
    expect(fit.scale).toBe(MIN_SCALE);
    expect(fit.overflow).toBe(true);
  });

  it('縮尺表記', () => {
    expect(scaleLabel(1)).toBe('1:1');
    expect(scaleLabel(undefined)).toBe('1:1');
    expect(scaleLabel(0.5)).toBe('1:2');
  });

  it('regenerateAll が全図面を用紙内に収め、縮小時は警告を出す', () => {
    const project = { ...base, hv: hvWith(14) };
    const r = regenerateAll(project);
    for (const d of r.diagrams) {
      expect(fitsInDrawable(d), `${d.title} がはみ出した`).toBe(true);
    }
    expect(r.warnings.some((w) => w.includes('縮尺'))).toBe(true);
  });
});
