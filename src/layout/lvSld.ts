import type { CircuitSpec, LvPanelSpec, ProjectMeta, TransformerSpec } from '../model/types';
import { SUPPLY_SHORT, sourceLabel } from '../model/labels';
import { DiagramBuilder } from './builder';
import { TEXT, sheetGeom } from './constants';
import { wrapText } from './textWidth';
import type { GenResult } from './types';

/** 分岐ピッチ */
const BP = 20;
/** 行ピッチ */
const RH = 90;
const MAIN_X = 50;
const BUS_Y0 = 60;
const BX0 = 85;
/** 行間リンクの x */
const LINK_X = 70;

/**
 * 分電盤 単線結線図。
 * 用紙に収まらない回路は次ページへ送る（回路を黙って落とさない）。
 */
export function generateLvSld(panel: LvPanelSpec, meta: ProjectMeta, transformers: TransformerSpec[]): GenResult[] {
  const sheet = meta.sheet;
  const g = sheetGeom(sheet);
  const maxPerRow = Math.max(1, Math.floor((g.drawable.x2 - BX0 - 5) / BP) + 1);
  const maxRows = Math.max(1, Math.floor((g.drawable.y2 - BUS_Y0 - 70) / RH) + 1);
  const perPage = maxPerRow * maxRows;

  const circuits = [...panel.circuits].sort((a, c) => a.no - c.no);
  const pageCount = Math.max(1, Math.ceil(circuits.length / perPage));
  const results: GenResult[] = [];

  for (let page = 1; page <= pageCount; page++) {
    results.push(
      buildPage(panel, meta, transformers, {
        circuits: circuits.slice((page - 1) * perPage, page * perPage),
        page,
        pageCount,
        maxPerRow,
        drawableX1: g.drawable.x1,
      }),
    );
  }
  if (circuits.length === 0) results[0]!.warnings.push('分岐回路がありません');
  if (pageCount > 1) {
    results[0]!.warnings.push(`回路数 ${circuits.length} は 1 枚に収まらないため ${pageCount} 枚に分割しました（A3 横を推奨）`);
  }
  return results;
}

interface PageOpts {
  circuits: CircuitSpec[];
  page: number;
  pageCount: number;
  maxPerRow: number;
  drawableX1: number;
}

function buildPage(panel: LvPanelSpec, meta: ProjectMeta, transformers: TransformerSpec[], o: PageOpts): GenResult {
  const suffix = o.pageCount > 1 ? `-p${o.page}` : '';
  const id = `lv-sld-${panel.id}${suffix}`;
  const b = new DiagramBuilder(id, 'lv-sld', `分電盤 ${panel.name} 単線結線図`, meta.sheet, panel.id);
  const first = o.page === 1;

  // 見出し
  b.text(o.drawableX1 + 5, 30, `${panel.name} 分電盤`, TEXT.title, 'start');
  b.text(
    o.drawableX1 + 5,
    38,
    `${SUPPLY_SHORT[panel.supply]}  ${sourceLabel(panel, transformers)}`.trim(),
    TEXT.rating,
    'start',
  );

  // 電源側: 1 枚目は主幹、2 枚目以降は前ページからの続き
  if (first) {
    const m = panel.main;
    const main = b.el(m.kind, MAIN_X, BUS_Y0, {
      rot: 270,
      labels: [
        `主幹 ${m.kind} ${m.poles}`,
        `${m.af}AF/${m.at}AT`,
        m.kind === 'ELB' && m.sensitivityMa ? `${m.sensitivityMa}mA` : '',
        meta.showModels && panel.nameplate?.model ? panel.nameplate.model : '',
      ].filter(Boolean),
      props: { af: m.af, at: m.at, poles: m.poles },
    });
    b.wireFromPoint({ x: MAIN_X - 25, y: BUS_Y0 }, main, 'N');
    b.text(MAIN_X - 25, BUS_Y0 + 8, '電源', TEXT.rating, 'start');
  } else {
    b.wirePoints({ x: MAIN_X - 25, y: BUS_Y0 }, { x: MAIN_X + 10, y: BUS_Y0 }, 'bus');
    b.text(MAIN_X - 25, BUS_Y0 - 5, `主幹 ${panel.main.kind} ${panel.main.at}AT より（${o.page - 1}/${o.pageCount} の続き）`, TEXT.rating, 'start');
  }

  // 行ごとの母線と分岐
  const rows = Math.max(1, Math.ceil(o.circuits.length / o.maxPerRow));
  for (let r = 0; r < rows; r++) {
    const busY = BUS_Y0 + r * RH;
    const rowCircuits = o.circuits.slice(r * o.maxPerRow, (r + 1) * o.maxPerRow);
    if (rowCircuits.length === 0) continue;
    const xEnd = BX0 + (rowCircuits.length - 1) * BP + 10;
    const xStart = r === 0 ? MAIN_X + 10 : LINK_X;
    if (r > 0) {
      const prevBusY = BUS_Y0 + (r - 1) * RH;
      b.el('JUNCTION', LINK_X, prevBusY);
      b.wirePoints({ x: LINK_X, y: prevBusY }, { x: LINK_X, y: busY }, 'bus');
    }
    b.wirePoints({ x: xStart, y: busY }, { x: xEnd, y: busY }, 'bus');

    rowCircuits.forEach((c, i) => {
      const bx = BX0 + i * BP;
      const j = b.el('JUNCTION', bx, busY);
      const br = b.el(c.breaker, bx, busY + 15, {
        labels: [],
        props: { no: c.no, at: c.at, poles: c.poles, voltage: c.voltage },
      });
      b.wire(j, 'S', br, 'N');
      const arrow = b.el('LOAD_ARROW', bx, busY + 35, { labels: [] });
      b.wire(br, 'S', arrow, 'N');

      const lines: string[] = [
        `No.${c.no}`,
        `${c.breaker} ${c.poles}`,
        `${c.at}A ${c.voltage}V`,
        ...(c.breaker === 'ELB' && c.sensitivityMa ? [`${c.sensitivityMa}mA`] : []),
        ...wrapText(c.loadName, TEXT.body, BP - 2),
        ...(c.loadVA > 0 ? [`${c.loadVA}VA`] : []),
        ...wrapText(c.wireSize, TEXT.body, BP - 2),
      ];
      b.textLines(bx, busY + 45, lines, TEXT.body, 'middle');
    });
  }

  return { diagram: b.build(o.pageCount > 1 ? { page: o.page, pageCount: o.pageCount } : {}), warnings: b.warnings };
}
