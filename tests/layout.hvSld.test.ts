import { describe, expect, it } from 'vitest';
import { generateHvSld } from '../src/layout/hvSld';
import { sampleProject } from '../src/model/defaults';
import { sheetGeom } from '../src/layout/constants';
import { isOrthogonal } from '../src/layout/router';
import { isPortEnd, type SwitchDevice } from '../src/model/types';
import { getSymbol } from '../src/symbols';
import { bboxOfPrims, bboxOfRect, overlaps } from '../src/geom/bbox';
import { elementPort } from '../src/layout/builder';
import { contentBBox, fitDiagram } from '../src/layout/fit';

describe('高圧受電設備 単線結線図 生成', () => {
  const p = sampleProject();
  const { diagram: d, warnings } = generateHvSld(p.hv, p.meta, p.panels)[0]!;

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

  it('全要素は 5mm 格子に乗る', () => {
    for (const e of d.elements) {
      expect(Math.abs(e.x % 5)).toBe(0);
      expect(Math.abs(e.y % 5)).toBe(0);
    }
  });

  it('自動縮尺をかけると全要素が用紙内に収まる', () => {
    // 生成した図面は用紙をはみ出すことがあり、収めるのは fitDiagram の役目
    const fit = fitDiagram(d);
    const g = sheetGeom(fit.diagram.sheet);
    expect(fit.overflow).toBe(false);
    for (const e of fit.diagram.elements) {
      const def = getSymbol(e.kind);
      const k = e.scale ?? 1;
      expect(e.x - (def.bbox.w / 2) * k).toBeGreaterThanOrEqual(g.frame.x1 - 0.01);
      expect(e.x + (def.bbox.w / 2) * k).toBeLessThanOrEqual(g.frame.x2 + 0.01);
      expect(e.y - (def.bbox.h / 2) * k).toBeGreaterThanOrEqual(g.frame.y1 - 0.01);
      expect(e.y + (def.bbox.h / 2) * k).toBeLessThanOrEqual(g.drawable.y2 + 0.01);
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

  it('主遮断装置に LBS + PF を選ぶと LBS → PF の順に描く', () => {
    const hv = { ...p.hv, mainBreaker: { devices: ['LBS', 'PF'] as SwitchDevice[], ratedA: 300, pfA: 40, ct: false, ocr: false } };
    const rs = generateHvSld(hv, p.meta, p.panels);
    const kinds = rs[0]!.diagram.elements.map((e) => e.kind);
    expect(kinds).not.toContain('VCB');
    expect(kinds).not.toContain('OCR');
    expect(kinds.filter((k) => k === 'PF').length).toBe(1 + p.hv.transformers.length + p.hv.capacitors.length);
    // 幹線上（x = 主回路）では LBS が PF の上に来る
    const busY = rs[0]!.diagram.wires.find((w) => w.style === 'bus')!.points[0]!.y;
    const main = rs[0]!.diagram.elements.filter((e) => e.y < busY);
    const lbs = main.find((e) => e.kind === 'LBS')!;
    const pf = main.find((e) => e.kind === 'PF')!;
    expect(lbs.x).toBe(pf.x);
    expect(lbs.y).toBeLessThan(pf.y);
  });

  it('主遮断装置に CT が無くても電流回路の計器があれば計器用 CT を足す', () => {
    const mainBreaker = { devices: ['LBS', 'PF'] as SwitchDevice[], ratedA: 300, pfA: 40, ct: false, ocr: false };
    const withA = generateHvSld({ ...p.hv, mainBreaker }, p.meta, p.panels)[0]!;
    expect(withA.diagram.elements.filter((e) => e.kind === 'CT').length).toBe(1);
    expect(withA.warnings.some((w) => w.includes('計器用 CT'))).toBe(true);

    // 電圧計だけなら CT は要らない
    const metering = { vt: true, a: false, v: true, w: false, wh: false, pf: false };
    const onlyV = generateHvSld({ ...p.hv, mainBreaker, metering }, p.meta, p.panels)[0]!;
    expect(onlyV.diagram.elements.some((e) => e.kind === 'CT')).toBe(false);
    expect(onlyV.warnings).toEqual([]);
  });

  describe('計器の結線', () => {
    const metering = { vt: true, a: true, v: true, w: true, wh: false, pf: true };
    const r = generateHvSld({ ...p.hv, metering }, p.meta, p.panels)[0]!;
    const d2 = r.diagram;
    const el = (k: string) => d2.elements.find((e) => e.kind === k)!;
    /** 要素 a のポートから出ている配線のうち、相手が要素 b のものを探す */
    const linked = (a: { id: string }, b: { id: string }) =>
      d2.wires.some(
        (w) =>
          (isPortEnd(w.from) && w.from.elementId === a.id && isPortEnd(w.to) && w.to.elementId === b.id) ||
          (isPortEnd(w.from) && w.from.elementId === b.id && isPortEnd(w.to) && w.to.elementId === a.id),
      );

    it('電流計は CT 二次側（OCR と直列）につながる', () => {
      // CT → OCR → A → W → PF の直列。電圧計は電流回路に入らない
      expect(linked(el('CT'), el('OCR'))).toBe(true);
      expect(linked(el('OCR'), el('METER_A'))).toBe(true);
      expect(linked(el('METER_A'), el('METER_W'))).toBe(true);
      expect(linked(el('METER_W'), el('METER_PF'))).toBe(true);
      expect(linked(el('METER_V'), el('METER_PF'))).toBe(false);
    });

    it('電圧計・電力計・力率計は VT 二次側の電圧回路につながる', () => {
      const vt = el('VT');
      const vbusY = vt.y + 15;
      // VT から電圧回路へ下ろす
      expect(d2.wires.some((w) => isPortEnd(w.from) && w.from.elementId === vt.id && !isPortEnd(w.to) && w.to.y === vbusY)).toBe(true);
      // 電圧を使う計器は電圧回路へ、電流専用の電流計はつながらない
      const toBus = (k: string) => {
        const m = el(k);
        return d2.wires.some((w) => isPortEnd(w.from) && w.from.elementId === m.id && !isPortEnd(w.to) && w.to.y === vbusY);
      };
      expect(toBus('METER_V')).toBe(true);
      expect(toBus('METER_W')).toBe(true);
      expect(toBus('METER_PF')).toBe(true);
      expect(toBus('METER_A')).toBe(false);
    });

    it('電流回路の計器を増やしても母線の高さは変わらない', () => {
      const busY = (m: typeof metering) => {
        const g2 = generateHvSld({ ...p.hv, metering: m }, p.meta, p.panels)[0]!;
        return g2.diagram.wires.find((w) => w.style === 'bus')!.points[0]!.y;
      };
      expect(busY(metering)).toBe(busY({ vt: true, a: false, v: true, w: false, wh: false, pf: false }));
      expect(busY(metering)).toBe(busY({ ...metering, wh: true }));
    });
  });

  it('A4 では自動縮尺で用紙に収まる', () => {
    const meta = { ...p.meta, sheet: { ...p.meta.sheet, size: 'A4' as const } };
    const rs = generateHvSld(p.hv, meta, p.panels);
    const fit = fitDiagram(rs[0]!.diagram);
    expect(fit.scale).toBeLessThan(1);
    expect(fit.overflow).toBe(false);
    const g = sheetGeom(fit.diagram.sheet);
    const b = contentBBox(fit.diagram);
    expect(b.minX).toBeGreaterThanOrEqual(g.drawable.x1 - 0.01);
    expect(b.maxX).toBeLessThanOrEqual(g.drawable.x2 + 0.01);
    expect(b.minY).toBeGreaterThanOrEqual(g.drawable.y1 - 0.01);
    expect(b.maxY).toBeLessThanOrEqual(g.drawable.y2 + 0.01);
  });

  it('決定的に生成される', () => {
    const a = generateHvSld(p.hv, p.meta, p.panels);
    const b = generateHvSld(p.hv, p.meta, p.panels);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe('開閉装置の種類', () => {
  const p = sampleProject();
  /** 分岐 1 台ぶんの縦に並ぶ機器を上から順に返す */
  const column = (spec: Partial<(typeof p.hv.capacitors)[number]>) => {
    const hv = { ...p.hv, transformers: [], capacitors: [{ ...p.hv.capacitors[0]!, ...spec }] };
    const d = generateHvSld(hv, p.meta, p.panels)[0]!.diagram;
    const busY = d.wires.find((w) => w.style === 'bus')!.points[0]!.y;
    const cx = d.elements.find((e) => e.kind === 'SC')!.x; // 枠外の A 種接地を除くため列で絞る
    return d.elements
      .filter((e) => e.y > busY && e.x === cx && e.kind !== 'JUNCTION')
      .sort((a, b) => a.y - b.y)
      .map((e) => e.kind);
  };

  it('LBS+VCS は LBS → PF → VCS の順に直列で描く', () => {
    expect(column({ devices: ['LBS', 'PF', 'VCS'], sr: true })).toEqual(['LBS', 'PF', 'VCS', 'SR', 'SC', 'GROUND_A']);
  });

  it('VCB / VCS / PC はその 1 台だけを描く', () => {
    expect(column({ devices: ['VCB'], sr: false })).toEqual(['VCB', 'SC', 'GROUND_A']);
    expect(column({ devices: ['VCS'], sr: false })).toEqual(['VCS', 'SC', 'GROUND_A']);
    expect(column({ devices: ['PC'], sr: false })).toEqual(['PC', 'SC', 'GROUND_A']);
    expect(column({ devices: ["LBS", "PF"], sr: false })).toEqual(['LBS', 'PF', 'SC', 'GROUND_A']);
  });

  it('配線は直交してポート位置に一致する', () => {
    const hv = { ...p.hv, capacitors: [{ ...p.hv.capacitors[0]!, devices: ['LBS', 'PF', 'VCS'] as SwitchDevice[] }] };
    const d = generateHvSld(hv, p.meta, p.panels)[0]!.diagram;
    for (const w of d.wires) {
      expect(isOrthogonal(w.points)).toBe(true);
      for (const end of [w.from, w.to]) {
        if (!isPortEnd(end)) continue;
        const el = d.elements.find((e) => e.id === end.elementId)!;
        const wp = elementPort(el, end.portId).p;
        const pt = end === w.from ? w.points[0]! : w.points[w.points.length - 1]!;
        expect(pt.x).toBeCloseTo(wp.x, 6);
        expect(pt.y).toBeCloseTo(wp.y, 6);
      }
    }
  });

  it('分岐盤の遮断/開閉にも同じ種類を選べる', () => {
    const feeder = {
      id: 'f1',
      name: '高圧分岐盤No.1 F1',
      devices: ["LBS", "PF", "VCS"] as SwitchDevice[],
      ratedA: 200,
      pfA: 30,
      ct: true,
      ctRatio: '75/5A',
      ocr: true,
    };
    const hv = { ...p.hv, feeders: [feeder], transformers: [], capacitors: [] };
    const d = generateHvSld(hv, p.meta, p.panels)[0]!.diagram;
    const busY = d.wires.find((w) => w.style === 'bus')!.points[0]!.y;
    const col = d.elements
      .filter((e) => e.y > busY && e.kind !== 'JUNCTION' && e.kind !== 'OCR')
      .sort((a, b) => a.y - b.y)
      .map((e) => e.kind);
    expect(col.slice(0, 3)).toEqual(['LBS', 'PF', 'VCS']);
    // 定格は主となる機器に、ヒューズ定格は PF に付く
    const lbs = d.elements.find((e) => e.kind === 'LBS' && e.y > busY)!;
    expect(lbs.labels).toContain('LBS 200A');
    expect(d.elements.find((e) => e.kind === 'PF' && e.y > busY)!.labels).toContain('PF 30A');
  });

  it('VCS の分岐盤ではヒューズを描かない', () => {
    const feeder = { id: 'f1', name: 'F1', devices: ["VCS"] as SwitchDevice[], ratedA: 200, ct: false, ocr: false };
    const hv = { ...p.hv, feeders: [feeder], transformers: [], capacitors: [] };
    const d = generateHvSld(hv, p.meta, p.panels)[0]!.diagram;
    const busY = d.wires.find((w) => w.style === 'bus')!.points[0]!.y;
    const kinds = d.elements.filter((e) => e.y > busY).map((e) => e.kind);
    expect(kinds).toContain('VCS');
    expect(kinds).not.toContain('PF');
  });
});

describe('高さの揃え', () => {
  const p = sampleProject();
  /** 開閉器の数がばらばらな 3 台 + 分岐盤 2 面 */
  const hv = {
    ...p.hv,
    feeders: [
      { id: 'f1', name: 'F1', devices: ['VCB'] as SwitchDevice[], ratedA: 600, ct: true, ctRatio: '100/5A', ocr: true, cable: { type: 'CVT', sq: 38 } },
      { id: 'f2', name: 'F2', devices: ['LBS', 'PF'] as SwitchDevice[], ratedA: 200, pfA: 30, ct: false, ocr: false },
    ],
    transformers: [
      { ...p.hv.transformers[0]!, id: 't1', name: 'T1', devices: ['LBS', 'PF', 'VCS'] as SwitchDevice[], feederId: 'f1' },
      { ...p.hv.transformers[1]!, id: 't2', name: 'T2', devices: ['PF'] as SwitchDevice[], feederId: 'f2' },
      { ...p.hv.transformers[0]!, id: 't3', name: 'T3', devices: [] as SwitchDevice[], feederId: undefined },
    ],
    capacitors: [{ ...p.hv.capacitors[0]!, devices: ['LBS', 'PF'] as SwitchDevice[], feederId: undefined }],
  };
  const d = generateHvSld(hv, p.meta, p.panels)[0]!.diagram;
  const body = (name: string) => d.elements.find((e) => e.labels.includes(name))!;

  it('開閉器の数が違っても変圧器・コンデンサは同じ高さに並ぶ', () => {
    const ys = ['T1', 'T2', 'T3', 'SC-1'].map((n) => body(n).y);
    expect(new Set(ys).size).toBe(1);
  });

  it('開閉器は基準線の直上に下詰めで積む', () => {
    const t1 = body('T1');
    const branch = Math.max(
      ...d.elements.filter((e) => e.kind === 'JUNCTION' && e.x === t1.x && e.y < t1.y).map((e) => e.y),
    );
    const col = d.elements
      .filter((e) => e.x === t1.x && e.y > branch && e.y < t1.y && e.kind !== 'JUNCTION')
      .sort((a, b) => a.y - b.y);
    expect(col.map((e) => e.kind)).toEqual(['LBS', 'PF', 'VCS']);
    // 20mm ピッチで、最後の機器が変圧器の真上に付く
    expect(col.map((e) => t1.y - e.y)).toEqual([60, 40, 20]);
  });

  it('直列リアクトルも積み上げ側に入るので、コンデンサ本体が変圧器と並ぶ', () => {
    const sc = body('SC-1');
    const sr = d.elements.find((e) => e.kind === 'SR')!;
    expect(sc.y).toBe(body('T1').y);
    expect(sr.x).toBe(sc.x);
    expect(sc.y - sr.y).toBe(20);
  });

  it('副母線は全分岐盤で同じ高さ', () => {
    // 配下 1 台の分岐盤は副母線を線として描かないので、分岐の接続点の高さで見る
    const branchY = (name: string) => {
      const el = body(name);
      return Math.max(...d.elements.filter((e) => e.kind === 'JUNCTION' && e.x === el.x && e.y < el.y).map((e) => e.y));
    };
    expect(branchY('T1')).toBe(branchY('T2'));
  });

  it('母線直結の分岐は高圧母線から出る', () => {
    const busY = d.wires.find((w) => w.style === 'bus')!.points[0]!.y;
    const t3 = body('T3');
    expect(d.elements.some((e) => e.kind === 'JUNCTION' && e.x === t3.x && e.y === busY)).toBe(true);
  });

  it('配線は直交し、ポート位置に一致する', () => {
    for (const w of d.wires) {
      expect(isOrthogonal(w.points)).toBe(true);
      for (const end of [w.from, w.to]) {
        if (!isPortEnd(end)) continue;
        const el = d.elements.find((e) => e.id === end.elementId)!;
        const wp = elementPort(el, end.portId).p;
        const pt = end === w.from ? w.points[0]! : w.points[w.points.length - 1]!;
        expect(pt.x).toBeCloseTo(wp.x, 6);
        expect(pt.y).toBeCloseTo(wp.y, 6);
      }
    }
  });

  it('分岐盤ごとに破線で囲み、盤名を上に置く', () => {
    expect(d.shapes.length).toBeGreaterThan(0);
    const box = bboxOfPrims(d.shapes);
    const busY = d.wires.find((w) => w.style === 'bus')!.points[0]!.y;
    // 囲みは母線より下、配下の変圧器を含む
    expect(box.minY).toBeGreaterThan(busY);
    for (const n of ['T1', 'T2']) {
      const el = body(n);
      expect(el.x).toBeGreaterThan(box.minX);
      expect(el.x).toBeLessThan(box.maxX);
      expect(el.y).toBeLessThan(box.maxY);
    }
    // 母線直結の機器は囲まない
    expect(body('T3').x).toBeGreaterThan(box.maxX);
    expect(body('SC-1').x).toBeGreaterThan(box.maxX);
    // 盤名は囲みの上
    for (const name of ['F1', 'F2']) {
      const t = d.texts.find((x) => x.text === name)!;
      expect(t).toBeDefined();
      expect(t.y).toBeLessThan(box.minY);
    }
  });
});

describe('高圧分岐盤', () => {
  const p = sampleProject();
  const feeders = [
    { id: 'f1', name: '高圧分岐盤No.1 F1', devices: ["VCB"] as SwitchDevice[], ratedA: 600, breakingKA: 12.5, ct: true, ctRatio: '100/5A', ocr: true, cable: { type: 'CVT', sq: 38 } },
    { id: 'f2', name: '高圧分岐盤No.2 F2', devices: ["VCB"] as SwitchDevice[], ratedA: 600, breakingKA: 12.5, ct: true, ctRatio: '75/5A', ocr: true },
  ];
  const hv = {
    ...p.hv,
    feeders,
    transformers: p.hv.transformers.map((t, i) => ({ ...t, feederId: i === 0 ? 'f1' : undefined })),
    capacitors: p.hv.capacitors.map((c) => ({ ...c, feederId: 'f2' })),
  };
  const { diagram: d, warnings } = generateHvSld(hv, p.meta, p.panels)[0]!;

  it('分岐盤ごとに VCB / CT / OCR / ケーブルヘッドを描く', () => {
    expect(warnings).toEqual([]);
    const kinds = d.elements.map((e) => e.kind);
    // 受電盤の 1 台 + 分岐盤 2 台
    expect(kinds.filter((k) => k === 'VCB').length).toBe(3);
    expect(kinds.filter((k) => k === 'CT').length).toBe(3);
    expect(kinds.filter((k) => k === 'OCR').length).toBe(3);
    // 引込 1 本 + F1 のケーブル
    expect(kinds.filter((k) => k === 'CABLE_HEAD').length).toBe(2);
    expect(d.texts.some((t) => t.text === '高圧分岐盤No.1 F1')).toBe(true);
  });

  it('分岐盤配下の機器は副母線に、直結の機器は高圧母線に付く', () => {
    const buses = d.wires.filter((w) => w.style === 'bus');
    const mainBus = buses.reduce((a, w) => (w.points[0]!.y < a.points[0]!.y ? w : a));
    const busY = mainBus.points[0]!.y;
    const tr1 = d.elements.find((e) => e.labels.includes('Tr-1'))!;
    const tr2 = d.elements.find((e) => e.labels.includes('Tr-2'))!;
    // 分岐盤配下も直結も、変圧器は同じ高さに並ぶ
    expect(tr1.y).toBe(tr2.y);
    expect(tr1.y).toBeGreaterThan(busY);
    // 分岐の起点（接続点）は、分岐盤配下なら副母線の高さ、直結なら主母線の高さ
    /** その列で分岐が始まる接続点（変圧器のすぐ上にあるもの） */
    const branchY = (el: (typeof d.elements)[number]) =>
      Math.max(...d.elements.filter((e) => e.kind === 'JUNCTION' && e.x === el.x && e.y < el.y).map((e) => e.y));
    expect(branchY(tr1)).toBeGreaterThan(busY);
    expect(branchY(tr2)).toBe(busY);
  });

  it('配下が無い分岐盤は負荷矢印で行き先を示す', () => {
    const loneAll = generateHvSld(
      { ...p.hv, feeders: [{ ...feeders[0]!, cable: undefined }], transformers: [], capacitors: [] },
      p.meta,
      p.panels,
    );
    const arrows = loneAll[0]!.diagram.elements.filter((e) => e.kind === 'LOAD_ARROW');
    expect(arrows.length).toBe(1);
    expect(arrows[0]!.labels[0]).toBe('負荷へ');
  });

  it('分岐盤 5 回線・変圧器 16 台でも用紙に収まる', () => {
    const many = {
      ...p.hv,
      feeders: Array.from({ length: 5 }, (_, i) => ({
        id: `f${i}`, name: `分岐盤F${i + 1}`, devices: ["VCB"] as SwitchDevice[], ratedA: 600,
        breakingKA: 12.5, ct: true, ctRatio: '100/5A', ocr: true,
      })),
      transformers: Array.from({ length: 16 }, (_, i) => ({
        id: `t${i}`, name: `Tr-${i + 1}`, phase: '3φ' as const, kva: 300,
        secondary: '210V' as const, devices: ["LBS", "PF"] as SwitchDevice[], pfA: 30,
        feederId: `f${i % 5}`,
      })),
      capacitors: [],
    };
    const rs = generateHvSld(many, p.meta, p.panels);
    const fit = fitDiagram(rs[0]!.diagram);
    expect(fit.overflow).toBe(false);
    const g = sheetGeom(fit.diagram.sheet);
    const b = contentBBox(fit.diagram);
    expect(b.maxX).toBeLessThanOrEqual(g.drawable.x2 + 0.05);
    expect(b.maxY).toBeLessThanOrEqual(g.drawable.y2 + 0.05);
  });

  it('存在しない分岐盤を指す機器は母線直結として扱う', () => {
    const orphan = { ...p.hv, feeders: [], transformers: p.hv.transformers.map((t) => ({ ...t, feederId: 'nope' })) };
    const rs = generateHvSld(orphan, p.meta, p.panels);
    expect(rs[0]!.warnings).toEqual([]);
    expect(rs[0]!.diagram.elements.filter((e) => e.kind.startsWith('TR_')).length).toBe(p.hv.transformers.length);
  });
});
