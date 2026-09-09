import { describe, expect, it } from 'vitest';
import { generateHvSld } from '../src/layout/hvSld';
import { findOverlaps } from '../src/layout/overlap';
import { nameplateRows } from '../src/model/nameplateRows';
import { sampleProject } from '../src/model/defaults';
import { getSymbol } from '../src/symbols';
import { isPortEnd, type HvFeederSpec, type HvSpec } from '../src/model/types';

const base = sampleProject();
// 受電部の計器は消しておく（分岐盤の計器だけを見たいので）
const p = {
  ...base,
  hv: {
    ...base.hv,
    metering: { vt: false, a: false, v: false, w: false, wh: false, pf: false },
  },
};

const feeder = (o: Partial<HvFeederSpec> = {}): HvFeederSpec => ({
  id: 'f1',
  name: '高圧分岐盤No.1',
  devices: ['VCB'],
  ratedA: 200,
  breakingKA: 12.5,
  ct: true,
  ctRatio: '100/5A',
  ocr: true,
  relays: ['OCR'],
  ...o,
});

const draw = (f: HvFeederSpec) => {
  const hv: HvSpec = { ...p.hv, feeders: [f], transformers: [], capacitors: [] };
  return generateHvSld(hv, p.meta, p.panels)[0]!.diagram;
};

/** 受電部にも CT があるので、分岐盤側（あとに描かれる方）を取る */
const lastOf = (d: ReturnType<typeof draw>, kind: string) =>
  [...d.elements].reverse().find((e) => e.kind === kind)!;

describe('分岐盤の電圧計・電流計', () => {
  it('電流計は CT 二次の直列（継電器の後ろ）に入る', () => {
    const d = draw(feeder({ metering: { a: true } }));
    const ct = lastOf(d, 'CT');
    const ocr = lastOf(d, 'OCR');
    const a = lastOf(d, 'METER_A');
    expect(a.y).toBe(ct.y);
    expect(a.x).toBeGreaterThan(ocr.x);
    // OCR の E から電流計の W へ細線でつながる
    const w = d.wires.find(
      (x) =>
        isPortEnd(x.from) && x.from.elementId === ocr.id && isPortEnd(x.to) && x.to.elementId === a.id,
    )!;
    expect(w.style).toBe('control');
  });

  it('電圧計は盤の VT の二次につながる', () => {
    const d = draw(feeder({ metering: { v: true } }));
    const vt = lastOf(d, 'VT');
    const v = lastOf(d, 'METER_V');
    const ct = lastOf(d, 'CT');
    expect(vt.y).toBe(ct.y);
    expect(v.x).toBeGreaterThan(vt.x);
    // VT は主回路（CT の 1 段上の分岐点）から取る
    const tap = d.elements.find((e) => e.kind === 'JUNCTION' && e.x === ct.x && e.y === ct.y - 10)!;
    expect(tap).toBeTruthy();
    expect(
      d.wires.some((x) => isPortEnd(x.from) && x.from.elementId === tap.id && isPortEnd(x.to) && x.to.elementId === vt.id),
    ).toBe(true);
  });

  it('両方付けても重ならない', () => {
    const d = draw(feeder({ metering: { a: true, v: true }, relays: ['OCR', 'OCGR'] }));
    expect(findOverlaps(d)).toEqual([]);
  });

  it('分岐盤が並んでも隣とぶつからない', () => {
    const hv: HvSpec = {
      ...p.hv,
      feeders: [
        feeder({ id: 'f1', name: '分岐盤A', metering: { a: true, v: true } }),
        feeder({ id: 'f2', name: '分岐盤B', metering: { a: true, v: true } }),
        feeder({ id: 'f3', name: '分岐盤C', metering: { a: true } }),
      ],
      transformers: [],
      capacitors: [],
    };
    for (const r of generateHvSld(hv, p.meta, p.panels)) {
      expect({ page: r.diagram.page, overlaps: findOverlaps(r.diagram) }).toEqual({
        page: r.diagram.page,
        overlaps: [],
      });
    }
  });

  it('CT が無い盤では警告する', () => {
    const hv: HvSpec = {
      ...p.hv,
      feeders: [feeder({ ct: false, relays: [], ocr: false, metering: { a: true } })],
      transformers: [],
      capacitors: [],
    };
    const r = generateHvSld(hv, p.meta, p.panels)[0]!;
    expect(r.warnings.some((w) => w.includes('CT を有効にしてください'))).toBe(true);
    expect(r.diagram.elements.some((e) => e.kind === 'METER_A')).toBe(false);
  });

  it('機器銘板表に分岐盤の計器が出る', () => {
    const hv: HvSpec = {
      ...p.hv,
      feeders: [feeder({ metering: { a: true, v: true } })],
      transformers: [],
      capacitors: [],
    };
    const names = nameplateRows({ ...p, hv })
      .filter((r) => r.note === '高圧分岐盤No.1')
      .map((r) => r.deviceName);
    expect(names).toContain('A');
    expect(names).toContain('V');
    expect(names).toContain('VT');
  });
});

describe('高圧ケーブルの図記号', () => {
  it('両端にケーブルヘッドを持ち、上下につなげる', () => {
    const def = getSymbol('HV_CABLE');
    expect(def.nameJa).toBe('高圧ケーブル');
    expect(def.ports.map((x) => x.id).sort()).toEqual(['N', 'S']);
    expect(def.ports.every((x) => x.x % 5 === 0 && x.y % 5 === 0)).toBe(true);
    // 三角形（ケーブルヘッド）が 2 つ
    expect(def.prims.filter((x) => x.t === 'polyline').length).toBe(2);
  });
});

describe('AS・VS と変圧器二次の計器', () => {
  it('分岐盤の AS は電流計の手前に直列で入る', () => {
    const d = draw(feeder({ metering: { a: true, as: true } }));
    const as = lastOf(d, 'AS');
    const a = lastOf(d, 'METER_A');
    const ocr = lastOf(d, 'OCR');
    expect(as.y).toBe(a.y);
    expect(ocr.x).toBeLessThan(as.x);
    expect(as.x).toBeLessThan(a.x);
    expect(
      d.wires.some((w) => isPortEnd(w.from) && w.from.elementId === as.id && isPortEnd(w.to) && w.to.elementId === a.id),
    ).toBe(true);
  });

  it('分岐盤の VS は電圧計の手前に入る', () => {
    const d = draw(feeder({ metering: { v: true, vs: true } }));
    const vs = lastOf(d, 'VS');
    const v = lastOf(d, 'METER_V');
    expect(vs.x).toBeLessThan(v.x);
    expect(
      d.wires.some((w) => isPortEnd(w.from) && w.from.elementId === vs.id && isPortEnd(w.to) && w.to.elementId === v.id),
    ).toBe(true);
    expect(findOverlaps(d)).toEqual([]);
  });

  it('変圧器の二次側に CT を入れて電流計・電圧計を付けられる', () => {
    const hv: HvSpec = {
      ...p.hv,
      feeders: [],
      capacitors: [],
      transformers: [
        {
          ...p.hv.transformers[0]!,
          secondaryMetering: { a: true, v: true, as: true, vs: true },
        },
      ],
    };
    const d = generateHvSld(hv, p.meta, p.panels)[0]!.diagram;
    const tr = d.elements.find((e) => e.labels[0] === 'Tr-1')!;
    const ct = lastOf(d, 'CT');
    // 二次側（変圧器の下）に CT が入る
    expect(ct.y).toBeGreaterThan(tr.y);
    expect(ct.x).toBe(tr.x);
    for (const k of ['AS', 'METER_A', 'VT', 'VS', 'METER_V']) {
      expect(lastOf(d, k).y, k).toBe(ct.y);
    }
    // 負荷矢印は計器より下に下がる
    const arrow = d.elements.find((e) => e.kind === 'LOAD_ARROW')!;
    expect(arrow.y).toBeGreaterThan(ct.y);
    expect(findOverlaps(d)).toEqual([]);
  });

  it('二次側に変圧器がつながっている場合は警告する', () => {
    const hv: HvSpec = {
      ...p.hv,
      feeders: [],
      capacitors: [],
      transformers: [
        { ...p.hv.transformers[0]!, id: 't1', name: 'Tr-A', secondaryMetering: { a: true } },
        { ...p.hv.transformers[0]!, id: 't2', name: 'Tr-B', sourceTransformerId: 't1' },
      ],
    };
    const r = generateHvSld(hv, p.meta, p.panels)[0]!;
    expect(r.warnings.some((w) => w.includes('二次側の計器は描けません'))).toBe(true);
  });

  it('銘板表に AS・VS と二次側の計器が出る', () => {
    const hv: HvSpec = {
      ...p.hv,
      feeders: [feeder({ metering: { a: true, v: true, as: true, vs: true } })],
      capacitors: [],
      transformers: [{ ...p.hv.transformers[0]!, secondaryMetering: { a: true } }],
    };
    const rows = nameplateRows({ ...p, hv });
    const fnames = rows.filter((r) => r.note === '高圧分岐盤No.1').map((r) => r.deviceName);
    expect(fnames).toContain('AS');
    expect(fnames).toContain('VS');
    const tnames = rows.filter((r) => r.note === 'Tr-1').map((r) => r.deviceName);
    expect(tnames).toContain('CT');
    expect(tnames).toContain('A');
  });
});
