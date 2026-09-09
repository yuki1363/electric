import { describe, expect, it } from 'vitest';
import { findOverlaps } from '../src/layout/overlap';
import { generateHvSld } from '../src/layout/hvSld';
import { regenerateAll } from '../src/layout';
import { sampleProject } from '../src/model/defaults';
import { DiagramBuilder } from '../src/layout/builder';
import { defaultSheet } from '../src/layout/constants';
import type { HvSpec, SwitchDevice, TransformerSpec } from '../src/model/types';

const tr = (o: Partial<TransformerSpec> & { id: string; name: string }): TransformerSpec => ({
  phase: '3φ',
  kva: 100,
  secondary: '210V',
  devices: ['LBS', 'PF'] as SwitchDevice[],
  pfA: 30,
  ...o,
});

/** 重なりの中身を読みやすく出す（失敗したときに原因が分かるように） */
const describeOverlaps = (d: ReturnType<typeof generateHvSld>[number]['diagram']) =>
  findOverlaps(d).map((o) => {
    const name = (id: string) =>
      d.elements.find((e) => e.id === id)?.labels.join('/') ??
      d.texts.find((t) => t.id === id)?.text ??
      id;
    return `${o.kind}: ${name(o.aId)} × ${name(o.bId)}`;
  });

describe('図記号・ラベルの重なり検出', () => {
  it('重ねて置いた機器を拾う', () => {
    const b = new DiagramBuilder('t', 'free', 'テスト', defaultSheet('A3'));
    b.el('VCB', 100, 100, { labels: ['VCB 600A'] });
    b.el('LBS', 101, 101, { labels: ['LBS'] });
    expect(findOverlaps(b.build()).length).toBeGreaterThan(0);
  });

  it('離して置いた機器は拾わない', () => {
    const b = new DiagramBuilder('t', 'free', 'テスト', defaultSheet('A3'));
    b.el('VCB', 60, 100, { labels: [] });
    b.el('LBS', 160, 100, { labels: [] });
    expect(findOverlaps(b.build())).toEqual([]);
  });

  it('サンプルの単線結線図に重なりが無い', () => {
    const p = sampleProject();
    // 盤面配置図・回路表・銘板表は文字を枠の中に置くので対象外
    for (const d of regenerateAll(p).diagrams.filter((x) => x.kind === 'hv-sld' || x.kind === 'lv-sld')) {
      expect({ title: d.title, overlaps: describeOverlaps(d) }).toEqual({ title: d.title, overlaps: [] });
    }
  });

  it('二次側にさらに変圧器がある構成でも重ならない', () => {
    const p = sampleProject();
    const hv: HvSpec = {
      ...p.hv,
      transformers: [
        tr({ id: 't1', name: 'Tr-A', kva: 300, secondary: '440V' }),
        tr({ id: 't2', name: 'Tr-A-1', kva: 50, primary: '440V', secondary: '210V', sourceTransformerId: 't1' }),
        tr({ id: 't3', name: 'Tr-A-2', kva: 20, primary: '440V', secondary: '105V', sourceTransformerId: 't1' }),
        tr({ id: 't4', name: 'Tr-B', kva: 100 }),
      ],
      capacitors: [],
    };
    for (const r of generateHvSld(hv, p.meta, p.panels)) {
      expect({ page: r.diagram.title, overlaps: describeOverlaps(r.diagram) }).toEqual({
        page: r.diagram.title,
        overlaps: [],
      });
    }
  });

  it('列ピッチが詰まるほど分岐が多くても重ならない', () => {
    const p = sampleProject();
    const transformers: TransformerSpec[] = [];
    // 親 4 台 + それぞれの二次に 2 台ずつ（スクリーンショットと同じ形）
    for (let i = 1; i <= 4; i++) {
      transformers.push(tr({ id: `p${i}`, name: `Tr-${i}`, kva: 300, secondary: '440V' }));
      transformers.push(
        tr({ id: `p${i}a`, name: `Tr-${i}-1`, kva: 50, primary: '440V', secondary: '210V', sourceTransformerId: `p${i}` }),
      );
      transformers.push(
        tr({ id: `p${i}b`, name: `Tr-${i}-2`, kva: 20, primary: '440V', secondary: '105V', sourceTransformerId: `p${i}` }),
      );
    }
    const hv: HvSpec = { ...p.hv, transformers, capacitors: [] };
    for (const r of generateHvSld(hv, p.meta, p.panels)) {
      expect({ page: r.diagram.title, overlaps: describeOverlaps(r.diagram) }).toEqual({
        page: r.diagram.title,
        overlaps: [],
      });
    }
  });

  it('長い機器名でも A4 に詰めて重ならない（列の間隔がラベル幅で決まる）', () => {
    const p = sampleProject();
    const transformers: TransformerSpec[] = [];
    for (let i = 1; i <= 3; i++) {
      transformers.push(tr({ id: `p${i}`, name: `低圧生産動力No.${i}`, kva: 300, secondary: '440V' }));
      transformers.push(
        tr({ id: `p${i}a`, name: `低圧生産動力No.${i}-1`, kva: 50, primary: '440V', secondary: '210V', sourceTransformerId: `p${i}` }),
      );
      transformers.push(
        tr({ id: `p${i}b`, name: `低圧生産動力No.${i}-2`, kva: 20, primary: '440V', secondary: '105V', sourceTransformerId: `p${i}` }),
      );
    }
    const meta = { ...p.meta, sheet: { ...p.meta.sheet, size: 'A4' as const } };
    const hv: HvSpec = { ...p.hv, transformers, capacitors: [] };
    for (const r of generateHvSld(hv, meta, p.panels)) {
      expect({ page: r.diagram.page, overlaps: describeOverlaps(r.diagram) }).toEqual({
        page: r.diagram.page,
        overlaps: [],
      });
    }
  });

  it('機器数の違う分岐を並べても重ならない', () => {
    const p = sampleProject();
    const hv: HvSpec = {
      ...p.hv,
      transformers: [
        tr({ id: 't1', name: 'Tr-1', devices: ['DTMC', 'LBS', 'MCCB', 'PF'] as SwitchDevice[] }),
        tr({ id: 't2', name: 'Tr-2', devices: ['PF'] as SwitchDevice[] }),
        tr({ id: 't3', name: 'Tr-3', devices: [] as SwitchDevice[] }),
        tr({ id: 't4', name: 'Tr-4', devices: ['VCB'] as SwitchDevice[] }),
      ],
      capacitors: [],
    };
    for (const r of generateHvSld(hv, p.meta, p.panels)) {
      expect({ page: r.diagram.title, overlaps: describeOverlaps(r.diagram) }).toEqual({
        page: r.diagram.title,
        overlaps: [],
      });
    }
  });
});
