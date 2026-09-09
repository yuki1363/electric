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
