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
/** 分岐ピッチ（既定と、詰められる下限） */
const BP_DEFAULT = 45;
const BP_MIN = 35;

type Leaf =
  | { kind: 'tr'; spec: HvSpec['transformers'][number] }
  | { kind: 'sc'; spec: HvSpec['capacitors'][number] };

/** 母線上の 1 区画。分岐盤か、母線直結の機器 1 台 */
type Group =
  | { kind: 'feeder'; feeder: HvSpec['feeders'][number]; leaves: Leaf[] }
  | { kind: 'direct'; leaf: Leaf };

/** 区画の列数（分岐盤は配下の台数、最低 1 列） */
const columnsOf = (g0: Group) => (g0.kind === 'feeder' ? Math.max(1, g0.leaves.length) : 1);

/** 仕様から母線上の区画を組み立てる */
function buildGroups(hv: HvSpec): Group[] {
  const leaves: Leaf[] = [
    ...hv.transformers.map((spec): Leaf => ({ kind: 'tr', spec })),
    ...hv.capacitors.map((spec): Leaf => ({ kind: 'sc', spec })),
  ];
  return [
    ...hv.feeders.map((feeder): Group => ({
      kind: 'feeder',
      feeder,
      leaves: leaves.filter((l) => l.spec.feederId === feeder.id),
    })),
    ...leaves
      .filter((l) => !l.spec.feederId || !hv.feeders.some((f) => f.id === l.spec.feederId))
      .map((leaf): Group => ({ kind: 'direct', leaf })),
  ];
}

/**
 * 高圧受電設備 単線結線図。
 * 母線の分岐が 1 枚に入りきらない場合はページを分ける（縮小しすぎて読めなくなるのを防ぐ）。
 */
export function generateHvSld(hv: HvSpec, meta: ProjectMeta, panels: LvPanelSpec[]): GenResult[] {
  const g = sheetGeom(meta.sheet);
  const groups = buildGroups(hv);

  // 1 枚目は受電部があるぶん母線を張れる幅が狭い
  const capacity = (startX: number) =>
    Math.max(1, Math.floor((g.drawable.x2 - startX - 15) / BP_DEFAULT) + 1);
  const firstCap = capacity(TX + 20);
  const restCap = capacity(g.drawable.x1 + 20);

  const pages: Group[][] = [];
  let rest = groups;
  let cap = firstCap;
  while (rest.length > 0) {
    const page: Group[] = [];
    let cols = 0;
    while (rest.length > 0) {
      const need = columnsOf(rest[0]!);
      if (page.length > 0 && cols + need > cap) break;
      page.push(rest[0]!);
      cols += need;
      rest = rest.slice(1);
    }
    pages.push(page);
    cap = restCap;
  }
  if (pages.length === 0) pages.push([]);

  const pageCount = pages.length;
  const results = pages.map((pageGroups, i) =>
    buildHvPage(hv, meta, panels, {
      groups: pageGroups,
      page: i + 1,
      pageCount,
      id: `hv-sld${pageCount > 1 ? `-p${i + 1}` : ''}`,
    }),
  );
  if (pageCount > 1) {
    results[0]!.warnings.push(
      `分岐が多いため単線結線図を ${pageCount} 枚に分けました（1 枚にまとめるには変圧器を分岐盤に所属させてください）`,
    );
  }
  return results;
}

interface HvPageOpts {
  groups: Group[];
  page: number;
  pageCount: number;
  id: string;
}

function buildHvPage(hv: HvSpec, meta: ProjectMeta, panels: LvPanelSpec[], o: HvPageOpts): GenResult {
  const sheet = meta.sheet;
  const first = o.page === 1;
  /** 型式表示が有効なら型式を 1 行足す */
  const withModel = (labels: string[], np?: { model?: string }): string[] =>
    meta.showModels && np?.model ? [...labels, np.model] : labels;
  const g = sheetGeom(sheet);
  const b = new DiagramBuilder(o.id, 'hv-sld', '高圧受電設備 単線結線図', sheet);

  let y = 30;
  let prev: Element | null = null;

  // 引込（1 枚目だけ）
  const leadIn = { x: TX, y: 15 };
  if (first) {
    b.text(TX + 5, 16, `6.6kV 引込（${hv.incoming === 'overhead' ? '架空' : '地中'}）`, TEXT.name, 'start');
  }

  const place = (kind: SK, labels: string[], props?: Element['props']): Element => {
    const el = b.el(kind, TX, y, { labels: labels.filter(Boolean), ...(props ? { props } : {}) });
    if (prev) b.wire(prev, 'S', el, 'N');
    else b.wireFromPoint(leadIn, el, 'N');
    prev = el;
    y += TP;
    return el;
  };

  if (first) {
    // 区分開閉器
    if (hv.pas.kind !== 'none') {
      place(hv.pas.kind, withModel([`${hv.pas.kind} ${hv.pas.ratedA}A`, hv.pas.sog ? 'SOG付' : ''], hv.nameplates?.pas), {
        ratedA: hv.pas.ratedA,
        sog: hv.pas.sog,
      });
    }

    // ケーブルヘッド
    place(
      'CABLE_HEAD',
      withModel([`${hv.cable.type} ${hv.cable.sq}sq`, hv.cable.lengthM ? `${hv.cable.lengthM}m` : ''], hv.nameplates?.cable),
    );

    // 取引用計器
    if (hv.vct) {
      const vct = place('VCT', []);
      const wh = b.el('METER_WH', TX + 25, vct.y, { labels: ['取引用計器'] });
      b.wire(vct, 'E', wh, 'W');
    }

    // 断路器
    if (hv.ds) place('DS', withModel(['DS'], hv.nameplates?.ds));

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
        const la = b.el('LA', TX - 40, tapY + 15, { labels: withModel(['LA'], hv.nameplates?.la) });
        b.wire(tap, 'W', la, 'N');
        const gnd = b.el('GROUND_A', TX - 40, tapY + 35, { labels: [] });
        b.wire(la, 'S', gnd, 'N');
      }

      if (hasMetering) {
        const vx = TX + 50;
        const ibusY = tapY + 30;
        if (hv.metering.vt) {
          const vt = b.el('VT', vx, tapY + 15, { labels: withModel(['VT'], hv.nameplates?.vt) });
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
      const ct = place('CT', withModel([`CT ${mb.ctRatio}`], hv.nameplates?.ct));
      if (mb.ocr) {
        const ocr = b.el('OCR', TX + 30, ct.y, { labels: [] });
        b.wire(ct, 'E', ocr, 'W');
      }
      place('VCB', withModel([`VCB ${mb.vcb.ratedA}A`, `${mb.vcb.breakingKA}kA`], hv.nameplates?.vcb), {
        ratedA: mb.vcb.ratedA,
        breakingKA: mb.vcb.breakingKA,
      });
    } else {
      const mb = hv.mainBreaker;
      place('PF', withModel([`PF ${mb.pfA}A`], hv.nameplates?.pf));
      place('LBS', withModel([`LBS ${mb.lbs.ratedA}A`], hv.nameplates?.lbs), { ratedA: mb.lbs.ratedA });
    }
  }

  // ---------------------------------------------------------------- 高圧母線と分岐

  const busY = first ? y - 5 : 60;
  const busStartX = first ? TX : g.drawable.x1 + 5;
  if (first) {
    const bus0 = b.el('JUNCTION', TX, busY);
    if (prev) b.wire(prev, 'S', bus0, 'N');
  } else {
    b.text(g.drawable.x1 + 5, 30, '高圧受電設備 単線結線図（続き）', TEXT.title, 'start');
    b.text(
      g.drawable.x1 + 5,
      busY - 5,
      `高圧母線 6.6kV（${o.page - 1}/${o.pageCount} からの続き）`,
      TEXT.rating,
      'start',
    );
  }

  const groups = o.groups;

  if (groups.length === 0 && first) b.warn('変圧器・コンデンサ・分岐盤が登録されていません');


  const bx0 = (first ? TX : g.drawable.x1) + 20;
  /** 分岐盤どうしの境界に足す余白 */
  const GROUP_GAP = 10;

  // 用紙幅に応じて分岐ピッチを詰める。これで足りない分は最後に自動縮尺が受け持つ
  const totalCols = groups.reduce((n, g0) => n + columnsOf(g0), 0);
  const gapCount = groups.reduce(
    (n, g0, i) => (i > 0 && (g0.kind === 'feeder' || groups[i - 1]!.kind === 'feeder') ? n + 1 : n),
    0,
  );
  const usableW = g.drawable.x2 - bx0 - 15 - gapCount * GROUP_GAP;
  const bp =
    totalCols > 1
      ? Math.max(BP_MIN, Math.min(BP_DEFAULT, Math.floor(usableW / (totalCols - 1) / GRID) * GRID))
      : BP_DEFAULT;

  /** 分岐盤の見出し（VCB/LBS + CT + OCR）を描き、副母線の y を返す */
  const drawFeederHead = (f: HvSpec['feeders'][number], cx: number, width: number): number => {
    const fnp = (k: string) => f.nameplates?.[k];
    let yy = busY;
    const j = b.el('JUNCTION', cx, busY);
    let last: Element = j;

    if (f.breaker === 'VCB') {
      const vcb = b.el('VCB', cx, yy + 20, {
        labels: withModel([`VCB ${f.ratedA}A`, f.breakingKA ? `${f.breakingKA}kA` : ''].filter(Boolean), fnp('vcb')),
        props: { ratedA: f.ratedA },
      });
      b.wire(last, 'S', vcb, 'N');
      last = vcb;
      yy += 20;
    } else {
      const lbs = b.el('LBS', cx, yy + 20, { labels: withModel([`LBS ${f.ratedA}A`], fnp('lbs')) });
      b.wire(last, 'S', lbs, 'N');
      last = lbs;
      yy += 20;
      if (f.pfA) {
        const pf = b.el('PF', cx, yy + 20, { labels: withModel([`PF ${f.pfA}A`], fnp('pf')) });
        b.wire(last, 'S', pf, 'N');
        last = pf;
        yy += 20;
      }
    }

    if (f.ct) {
      // CT のラベルは既定では左側に出るが、隣の分岐盤の VCB ラベルとぶつかるため
      // 引き出した OCR（無ければ CT の右下）にまとめて書く
      const ct = b.el('CT', cx, yy + 20, { labels: [] });
      b.wire(last, 'S', ct, 'N');
      last = ct;
      yy += 20;
      const ctLines = withModel([`CT ${f.ctRatio ?? ''}`.trim()], fnp('ct'));
      if (f.ocr) {
        const ocr = b.el('OCR', cx + 30, ct.y, { labels: [] });
        b.wire(ct, 'E', ocr, 'W');
        b.textLines(cx + 30, ct.y + 9, ctLines, TEXT.rating, 'middle');
      } else {
        b.textLines(cx + 3, ct.y + 9, ctLines, TEXT.rating, 'start');
      }
    }

    if (f.cable) {
      const ch = b.el('CABLE_HEAD', cx, yy + 20, {
        labels: withModel(
          [`${f.cable.type} ${f.cable.sq}sq`, f.cable.lengthM ? `${f.cable.lengthM}m` : ''].filter(Boolean),
          fnp('cable'),
        ),
      });
      b.wire(last, 'S', ch, 'N');
      last = ch;
      yy += 20;
    }

    // 盤名を見出しとして左上に置く
    b.text(cx - 8, busY + 8, f.name, TEXT.rating, 'end');

    if (width > 0) {
      const subY = yy + 15;
      b.wireToPoint(last, 'S', { x: cx, y: subY });
      return subY;
    }
    // 配下が無い分岐盤は行き先を矢印で示す
    const arrow = b.el('LOAD_ARROW', cx, yy + 20, { labels: [f.loadName || '負荷へ'] });
    b.wire(last, 'S', arrow, 'N');
    return 0;
  };

  /** 1 台ぶんの分岐（開閉器 → PF → 変圧器/コンデンサ）を描く */
  const drawLeaf = (leaf: Leaf, bx: number, topY: number) => {
    const j = b.el('JUNCTION', bx, topY);
    const sw = b.el(leaf.spec.switch, bx, topY + 15, {
      labels: [leaf.spec.switch === 'PC' ? `PC ${leaf.spec.pfA}A` : 'LBS'],
    });
    b.wire(j, 'S', sw, 'N');
    let last: Element = sw;
    let yy = topY + 15;
    if (leaf.spec.switch === 'LBS') {
      const pf = b.el('PF', bx, yy + 20, { labels: [`PF ${leaf.spec.pfA}A`] });
      b.wire(last, 'S', pf, 'N');
      last = pf;
      yy += 20;
    }

    if (leaf.kind === 'tr') {
      const t = leaf.spec;
      const tr = b.el(t.phase === '1φ' ? 'TR_1PH' : 'TR_3PH', bx, yy + 20, {
        labels: withModel([t.name, `${t.phase} ${t.kva}kVA`, `6.6kV/${t.secondary}`], t.nameplate),
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
      const c = leaf.spec;
      if (c.sr) {
        const sr = b.el('SR', bx, yy + 20, { labels: ['SR 6%'] });
        b.wire(last, 'S', sr, 'N');
        last = sr;
        yy += 20;
      }
      const sc = b.el('SC', bx, yy + 20, {
        labels: withModel([c.name, `${c.kvar}kvar`], c.nameplate),
        props: { kvar: c.kvar, sr: c.sr },
      });
      b.wire(last, 'S', sc, 'N');
      yy += 20;
      const gnd = b.el('GROUND_A', bx, yy + 15, { labels: [] });
      b.wire(sc, 'S', gnd, 'N');
    }
  };

  // 区画を左から並べる。分岐盤が隣り合う境界にだけ余白を足す
  let x = bx0;
  let busEndX = busStartX + 30;
  groups.forEach((g0, gi) => {
    const nCols = columnsOf(g0);
    const startX = snapValue(x, GRID);
    if (g0.kind === 'direct') {
      drawLeaf(g0.leaf, startX, busY);
    } else {
      const width = g0.leaves.length;
      // 分岐盤の見出しは配下の中央に置く
      const centerX = snapValue(startX + ((nCols - 1) * bp) / 2, GRID);
      const subY = drawFeederHead(g0.feeder, centerX, width);
      if (width > 0 && subY > 0) {
        if (width > 1) {
          b.wirePoints({ x: startX, y: subY }, { x: startX + (width - 1) * bp, y: subY }, 'bus');
        }
        g0.leaves.forEach((leaf, li) => drawLeaf(leaf, startX + li * bp, subY));
      }
    }
    busEndX = Math.max(busEndX, startX + (nCols - 1) * bp + 15);
    const gapAfter = g0.kind === 'feeder' || groups[gi + 1]?.kind === 'feeder' ? GROUP_GAP : 0;
    x = startX + nCols * bp + gapAfter;
  });

  b.wirePoints({ x: busStartX, y: busY }, { x: busEndX, y: busY }, 'bus');
  if (first) b.text(TX - 3, busY - 3, '高圧母線 6.6kV', TEXT.rating, 'end');

  // 筐体接地（作図内容の下端に合わせて置く。1 枚目だけ）
  if (hv.grounding.aType && first) {
    const bottom = Math.max(...b.elements.map((e) => e.y), busY);
    const gx = snapValue(g.drawable.x1 + 10, GRID);
    const gy = snapValue(bottom, GRID);
    const gnd = b.el('GROUND_A', gx, gy, { labels: ['A種接地（筐体）'] });
    b.wireFromPoint({ x: gx, y: gy - 15 }, gnd, 'N');
  }

  return {
    diagram: b.build(o.pageCount > 1 ? { page: o.page, pageCount: o.pageCount } : {}),
    warnings: b.warnings,
  };
}
