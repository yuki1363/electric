import { describe, expect, it } from 'vitest';
import { regenerateAll } from '../src/layout';
import { nameplateRows } from '../src/model/nameplateRows';
import { parse, serialize } from '../src/model/project';
import { sampleProject, defaultHv } from '../src/model/defaults';
import type { HvFeederSpec, Project, SubstationSpec } from '../src/model/types';

const feeder = (id: string, name: string): HvFeederSpec => ({
  id,
  name,
  devices: ['VCB'],
  ratedA: 200,
  breakingKA: 12.5,
  ct: true,
  ctRatio: '100/5A',
  ocr: true,
  relays: ['OCR'],
});

/** 送り 1 系統と、その先の副変電所 1 つを持つプロジェクト */
function withSubstation(): { project: Project; sub: SubstationSpec } {
  const p = sampleProject();
  const send = feeder('f-send', '送りNo.2');
  const sub: SubstationSpec = {
    id: 'sub1',
    name: '副変電所No.1',
    sourceFeederId: send.id,
    hv: {
      ...defaultHv(),
      pas: { kind: 'none', sog: false, ratedA: 300 },
      vct: false,
      feeders: [],
      capacitors: [],
      transformers: [
        { id: 'st1', name: 'ST-1', phase: '3φ', kva: 200, secondary: '210V', devices: ['LBS', 'PF'], pfA: 30 },
      ],
    },
  };
  return {
    project: { ...p, hv: { ...p.hv, feeders: [send] }, substations: [sub] },
    sub,
  };
}

describe('副変電所', () => {
  it('親とは別の図面が作られ、引込の代わりに「送りより」が出る', () => {
    const { project } = withSubstation();
    const ds = regenerateAll(project).diagrams;
    const subDiagrams = ds.filter((d) => d.id.startsWith('sub-sub1'));
    expect(subDiagrams.length).toBeGreaterThan(0);
    const d = subDiagrams[0]!;
    expect(d.title).toBe('副変電所No.1 単線結線図');
    expect(d.texts.some((t) => t.text === '高圧受電盤 送りNo.2 より')).toBe(true);
    // 引込の注記は出ない
    expect(d.texts.some((t) => t.text.includes('引込（架空）'))).toBe(false);
    // 中身は受電設備と同じ作りで、変圧器が描かれる
    expect(d.elements.some((e) => e.labels[0] === 'ST-1')).toBe(true);
  });

  it('親の図面では送りの囲みに行き先が出る', () => {
    const { project } = withSubstation();
    const parent = regenerateAll(project).diagrams.find((d) => d.id.startsWith('hv-sld'))!;
    expect(parent.texts.some((t) => t.text === '送りNo.2 → 副変電所No.1')).toBe(true);
  });

  it('銘板表は備考の頭に副変電所名が付く', () => {
    const { project } = withSubstation();
    const rows = nameplateRows(project);
    expect(rows.some((r) => r.note === '副変電所No.1 ST-1')).toBe(true);
    // 親の行には付かない
    expect(rows.some((r) => r.note === 'Tr-1')).toBe(true);
  });

  it('保存して読み直しても副変電所が残る', () => {
    const { project } = withSubstation();
    const back = parse(serialize(project));
    expect(back.substations?.length).toBe(1);
    expect(back.substations![0]!.name).toBe('副変電所No.1');
    expect(back.substations![0]!.hv.transformers[0]!.name).toBe('ST-1');
    // 開閉装置の移行も副変電所の中で効く
    expect(back.substations![0]!.hv.transformers[0]!.devices).toEqual(['LBS', 'PF']);
  });

  it('副変電所が無いプロジェクトは今までどおり', () => {
    const p = sampleProject();
    const ds = regenerateAll(p).diagrams;
    expect(ds.some((d) => d.id.startsWith('sub-'))).toBe(false);
    expect(parse(serialize(p)).substations).toBeUndefined();
  });
});
