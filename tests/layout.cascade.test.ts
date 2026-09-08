import { describe, expect, it } from 'vitest';
import { generateHvSld } from '../src/layout/hvSld';
import { sampleProject } from '../src/model/defaults';
import { isOrthogonal } from '../src/layout/router';
import { isPortEnd, type SwitchDevice, type TransformerSpec } from '../src/model/types';
import { elementPort } from '../src/layout/builder';

const tr = (o: Partial<TransformerSpec> & { id: string; name: string }): TransformerSpec => ({
  phase: '3φ',
  kva: 100,
  secondary: '210V',
  devices: [] as SwitchDevice[],
  pfA: 30,
  ...o,
});

describe('低圧 → 低圧の変圧器（数珠つなぎ）', () => {
  const p = sampleProject();
  /** 6600 → 440 → 440 → 220 */
  const chain = [
    tr({ id: 't1', name: 'Tr-1', primary: '6.6kV', secondary: '440V', devices: ['LBS', 'PF'] }),
    tr({ id: 't2', name: 'Tr-2', primary: '440V', secondary: '440V', sourceTransformerId: 't1' }),
    tr({ id: 't3', name: 'Tr-3', primary: '440V', secondary: '220V', sourceTransformerId: 't2' }),
  ];
  const hv = { ...p.hv, transformers: chain, capacitors: [] };
  const d = generateHvSld(hv, p.meta, p.panels)[0]!.diagram;
  const body = (name: string) => d.elements.find((e) => e.labels.includes(name))!;

  it('高圧単線結線図の中に、上から順に描く', () => {
    const ys = ['Tr-1', 'Tr-2', 'Tr-3'].map((n) => body(n).y);
    expect(ys[0]!).toBeLessThan(ys[1]!);
    expect(ys[1]!).toBeLessThan(ys[2]!);
    // 同じ列に並ぶ
    expect(new Set(['Tr-1', 'Tr-2', 'Tr-3'].map((n) => body(n).x)).size).toBe(1);
  });

  it('一次電圧はそれぞれの入力どおりに出る', () => {
    expect(body('Tr-1').labels).toContain('6.6kV/440V');
    expect(body('Tr-2').labels).toContain('440V/440V');
    expect(body('Tr-3').labels).toContain('440V/220V');
  });

  it('末端だけ負荷へ向かう矢印を描く', () => {
    const arrows = d.elements.filter((e) => e.kind === 'LOAD_ARROW');
    expect(arrows.length).toBe(1);
    expect(arrows[0]!.y).toBeGreaterThan(body('Tr-3').y);
  });

  it('段ごとに開閉装置を挟める', () => {
    const hv2 = {
      ...hv,
      transformers: chain.map((t) => (t.id === 't2' ? { ...t, devices: ['PF'] as SwitchDevice[] } : t)),
    };
    const d2 = generateHvSld(hv2, p.meta, p.panels)[0]!.diagram;
    const t1 = d2.elements.find((e) => e.labels.includes('Tr-1'))!;
    const t2 = d2.elements.find((e) => e.labels.includes('Tr-2'))!;
    const pf = d2.elements.filter((e) => e.kind === 'PF' && e.y > t1.y && e.y < t2.y);
    expect(pf.length).toBe(1);
    expect(pf[0]!.x).toBe(t2.x);
  });

  it('二次側が枝分かれすると副母線で振り分ける', () => {
    const hv2 = {
      ...hv,
      transformers: [
        chain[0]!,
        tr({ id: 't2', name: 'Tr-2', primary: '440V', secondary: '210V', sourceTransformerId: 't1' }),
        tr({ id: 't3', name: 'Tr-3', primary: '440V', secondary: '105V', sourceTransformerId: 't1' }),
      ],
    };
    const d2 = generateHvSld(hv2, p.meta, p.panels)[0]!.diagram;
    const t2 = d2.elements.find((e) => e.labels.includes('Tr-2'))!;
    const t3 = d2.elements.find((e) => e.labels.includes('Tr-3'))!;
    expect(t2.x).not.toBe(t3.x); // 横に並ぶ
    expect(t2.y).toBe(t3.y); // 高さはそろう
  });

  it('循環していても落ちず、機器を落とさない', () => {
    const hv2 = {
      ...hv,
      transformers: [
        tr({ id: 'a', name: 'A', sourceTransformerId: 'b' }),
        tr({ id: 'b', name: 'B', sourceTransformerId: 'a' }),
      ],
    };
    const d2 = generateHvSld(hv2, p.meta, p.panels)[0]!.diagram;
    expect(d2.elements.some((e) => e.labels.includes('A'))).toBe(true);
    expect(d2.elements.some((e) => e.labels.includes('B'))).toBe(true);
  });

  it('配線は直交し、ポート位置に一致する', () => {
    for (const w of d.wires) {
      expect(isOrthogonal(w.points)).toBe(true);
      for (const end of [w.from, w.to]) {
        if (!isPortEnd(end)) continue;
        const e = d.elements.find((x) => x.id === end.elementId)!;
        const wp = elementPort(e, end.portId).p;
        const pt = end === w.from ? w.points[0]! : w.points[w.points.length - 1]!;
        expect(pt.x).toBeCloseTo(wp.x, 6);
        expect(pt.y).toBeCloseTo(wp.y, 6);
      }
    }
  });
});
