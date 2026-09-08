import type { Element, HvSpec, LvPanelSpec, ProjectMeta } from '../model/types';
import type { SymbolKind, SymbolKind as SK } from '../symbols/types';
import { DiagramBuilder } from './builder';
import { GRID, TEXT, sheetGeom } from './constants';
import { snapValue } from '../geom/point';
import type { GenResult } from './types';

/** 幹線 x 座標 */
const TX = 80;
/** 機器の縦ピッチ（記号高 20 = 端子同士が接する） */
const TP = 20;
/** 分岐ピッチ */
const BP_DEFAULT = 45;
const BP_MIN = 35;

export function generateHvSld(hv: HvSpec, meta: ProjectMeta, panels: LvPanelSpec[], id = 'hv-sld'): GenResult {
  const sheet = meta.sheet;
  const g = sheetGeom(sheet);
  const b = new DiagramBuilder(id, 'hv-sld', '高圧受電設備 単線結線図', sheet);

  let y = 30;
  let prev: Element | null = null;

  // 引込
  const leadIn = { x: TX, y: 15 };
  b.text(TX + 5, 16, `6.6kV 引込（${hv.incoming === 'overhead' ? '架空' : '地中'}）`, TEXT.name, 'start');

  const place = (kind: SK, labels: string[], props?: Element['props']): Element => {
    const el = b.el(kind, TX, y, { labels: labels.filter(Boolean), ...(props ? { props } : {}) });
    if (prev) b.wire(prev, 'S', el, 'N');
    else b.wireFromPoint(leadIn, el, 'N');
    prev = el;
    y += TP;
    return el;
  };

  // 区分開閉器
  if (hv.pas.kind !== 'none') {
    place(hv.pas.kind, [`${hv.pas.kind} ${hv.pas.ratedA}A`, hv.pas.sog ? 'SOG付' : ''], {
      ratedA: hv.pas.ratedA,
      sog: hv.pas.sog,
    });
  }

  // ケーブルヘッド
  place('CABLE_HEAD', [
    `${hv.cable.type} ${hv.cable.sq}sq`,
    hv.cable.lengthM ? `${hv.cable.lengthM}m` : '',
  ]);

  // 取引用計器
  if (hv.vct) {
    const vct = place('VCT', []);
    const wh = b.el('METER_WH', TX + 25, vct.y, { labels: ['取引用計器'] });
    b.wire(vct, 'E', wh, 'W');
  }

  // 断路器
  if (hv.ds) place('DS', ['DS']);

  // 分岐点（LA・計器）
  const meterKinds: SymbolKind[] = [];
  if (hv.metering.v) meterKinds.push('METER_V');
  if (hv.metering.a) meterKinds.push('METER_A');
  if (hv.metering.w) meterKinds.push('METER_W');
  if (hv.metering.pf) meterKinds.push('METER_PF');
  if (hv.metering.wh) meterKinds.push('METER_WH');
  const hasMetering = meterKinds.length > 0 || hv.metering.vt;

  if (hv.la || hasMetering) {
    const tapY = y - 5;
    const tap = b.el('JUNCTION', TX, tapY);
    if (prev) b.wire(prev, 'S', tap, 'N');
    prev = tap;
    y += 10;

    if (hv.la) {
      const la = b.el('LA', TX - 40, tapY + 15, { labels: ['LA'] });
      b.wire(tap, 'W', la, 'N');
      const gnd = b.el('GROUND_A', TX - 40, tapY + 35, { labels: [] });
      b.wire(la, 'S', gnd, 'N');
    }

    if (hasMetering) {
      const vx = TX + 50;
      const ibusY = tapY + 30;
      if (hv.metering.vt) {
        const vt = b.el('VT', vx, tapY + 15, { labels: ['VT'] });
        b.wire(tap, 'E', vt, 'N');
        if (meterKinds.length > 0) b.wireToPoint(vt, 'S', { x: vx, y: ibusY });
      } else if (meterKinds.length > 0) {
        b.wireToPoint(tap, 'E', { x: vx, y: ibusY });
      }
      if (meterKinds.length > 0) {
        const xs = meterKinds.map((_, i) => TX + 80 + i * 15);
        const xLast = xs[xs.length - 1]!;
        b.wirePoints({ x: vx, y: ibusY }, { x: xLast, y: ibusY });
        meterKinds.forEach((k, i) => {
          const mx = xs[i]!;
          const m = b.el(k, mx, tapY + 15, { labels: [] });
          b.wireToPoint(m, 'S', { x: mx, y: ibusY });
          if (i < meterKinds.length - 1) b.el('JUNCTION', mx, ibusY);
        });
      }
    }
  }

  // 主遮断装置
  if (hv.mainBreaker.type === 'CB') {
    const mb = hv.mainBreaker;
    const ct = place('CT', [`CT ${mb.ctRatio}`]);
    if (mb.ocr) {
      const ocr = b.el('OCR', TX + 30, ct.y, { labels: [] });
      b.wire(ct, 'E', ocr, 'W');
    }
    place('VCB', [`VCB ${mb.vcb.ratedA}A`, `${mb.vcb.breakingKA}kA`], {
      ratedA: mb.vcb.ratedA,
      breakingKA: mb.vcb.breakingKA,
    });
  } else {
    const mb = hv.mainBreaker;
    place('PF', [`PF ${mb.pfA}A`]);
    place('LBS', [`LBS ${mb.lbs.ratedA}A`], { ratedA: mb.lbs.ratedA });
  }

  // 高圧母線
  const busY = y - 5;
  const bus0 = b.el('JUNCTION', TX, busY);
  if (prev) b.wire(prev, 'S', bus0, 'N');

  type Branch =
    | { kind: 'tr'; spec: HvSpec['transformers'][number] }
    | { kind: 'sc'; spec: HvSpec['capacitors'][number] };
  const items: Branch[] = [
    ...hv.transformers.map((spec): Branch => ({ kind: 'tr', spec })),
    ...hv.capacitors.map((spec): Branch => ({ kind: 'sc', spec })),
  ];

  const n = items.length;
  let bp = BP_DEFAULT;
  const bx0 = TX + 20;
  const endX = (pitch: number) => (n > 0 ? bx0 + (n - 1) * pitch + 15 : TX + 30);
  if (endX(bp) > g.drawable.x2) bp = BP_MIN;
  if (n === 0) b.warn('変圧器・コンデンサが登録されていません');

  b.wirePoints({ x: TX, y: busY }, { x: endX(bp), y: busY }, 'bus');
  b.text(TX - 3, busY - 3, '高圧母線 6.6kV', TEXT.rating, 'end');

  items.forEach((item, i) => {
    const bx = bx0 + i * bp;
    const j = b.el('JUNCTION', bx, busY);
    const sw = b.el(item.spec.switch, bx, busY + 15, {
      labels: [item.spec.switch === 'PC' ? `PC ${item.spec.pfA}A` : 'LBS'],
    });
    b.wire(j, 'S', sw, 'N');
    let last = sw;
    let yy = busY + 15;
    if (item.spec.switch === 'LBS') {
      const pf = b.el('PF', bx, yy + 20, { labels: [`PF ${item.spec.pfA}A`] });
      b.wire(last, 'S', pf, 'N');
      last = pf;
      yy += 20;
    }

    if (item.kind === 'tr') {
      const t = item.spec;
      const tr = b.el(t.phase === '1φ' ? 'TR_1PH' : 'TR_3PH', bx, yy + 20, {
        labels: [t.name, `${t.phase} ${t.kva}kVA`, `6.6kV/${t.secondary}`],
        props: { kva: t.kva, phase: t.phase, secondary: t.secondary },
      });
      b.wire(last, 'S', tr, 'N');
      yy += 20;
      const panel = panels.find((p) => p.id === t.feeds);
      const feedLabel = panel ? `${panel.name} へ` : '低圧負荷へ';
      if (hv.grounding.bType) {
        const j2 = b.el('JUNCTION', bx, yy + 15);
        b.wire(tr, 'S', j2, 'N');
        const gb = b.el('GROUND_B', bx + 15, yy + 25, { labels: ['B種'] });
        b.wire(j2, 'E', gb, 'N');
        const arrow = b.el('LOAD_ARROW', bx, yy + 25, { labels: [feedLabel] });
        b.wire(j2, 'S', arrow, 'N');
      } else {
        const arrow = b.el('LOAD_ARROW', bx, yy + 20, { labels: [feedLabel] });
        b.wire(tr, 'S', arrow, 'N');
      }
    } else {
      const c = item.spec;
      if (c.sr) {
        const sr = b.el('SR', bx, yy + 20, { labels: ['SR 6%'] });
        b.wire(last, 'S', sr, 'N');
        last = sr;
        yy += 20;
      }
      const sc = b.el('SC', bx, yy + 20, {
        labels: [c.name, `${c.kvar}kvar`],
        props: { kvar: c.kvar, sr: c.sr },
      });
      b.wire(last, 'S', sc, 'N');
      yy += 20;
      const gnd = b.el('GROUND_A', bx, yy + 15, { labels: [] });
      b.wire(sc, 'S', gnd, 'N');
    }
  });

  // 筐体接地（作図内容の下端に合わせて置く）
  if (hv.grounding.aType) {
    const bottom = Math.max(...b.elements.map((e) => e.y), busY);
    const gx = snapValue(g.drawable.x1 + 10, GRID);
    const gy = snapValue(bottom, GRID);
    const gnd = b.el('GROUND_A', gx, gy, { labels: ['A種接地（筐体）'] });
    b.wireFromPoint({ x: gx, y: gy - 15 }, gnd, 'N');
  }

  return { diagram: b.build(), warnings: b.warnings };
}
