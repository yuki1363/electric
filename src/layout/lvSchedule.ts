import type { CircuitSpec, LvPanelSpec, ProjectMeta, TransformerSpec } from '../model/types';
import { SUPPLY_LABEL, mainBreakerLabel, sourceLabel } from '../model/labels';
import { L, RECT } from '../symbols/helpers';
import { DiagramBuilder } from './builder';
import { TEXT, sheetGeom } from './constants';
import { estimateTextWidth } from './textWidth';
import type { GenResult } from './types';

const COLS: { key: string; title: string; w: number; align: 'start' | 'middle' | 'end' }[] = [
  { key: 'no', title: '回路No', w: 15, align: 'middle' },
  { key: 'name', title: '回路名', w: 45, align: 'start' },
  { key: 'voltage', title: '電圧', w: 15, align: 'middle' },
  { key: 'breaker', title: '種別', w: 18, align: 'middle' },
  { key: 'poles', title: '極数', w: 12, align: 'middle' },
  { key: 'at', title: 'AT', w: 12, align: 'middle' },
  { key: 'loadName', title: '負荷名', w: 60, align: 'start' },
  { key: 'loadVA', title: '負荷容量(VA)', w: 25, align: 'end' },
  { key: 'wireSize', title: '電線サイズ', w: 35, align: 'start' },
  { key: 'note', title: '備考', w: 60, align: 'start' },
];
const TABLE_X = 20;
const TABLE_Y = 45;
const HEADER_H = 8;
const ROW_H = 7;

function cellValue(c: CircuitSpec, key: string): string {
  switch (key) {
    case 'no':
      return String(c.no);
    case 'name':
      return c.name;
    case 'voltage':
      return `${c.voltage}V`;
    case 'breaker':
      return c.breaker === 'ELB' && c.sensitivityMa ? `ELB ${c.sensitivityMa}mA` : c.breaker;
    case 'poles':
      return c.poles;
    case 'at':
      return `${c.at}A`;
    case 'loadName':
      return c.loadName;
    case 'loadVA':
      return c.loadVA > 0 ? String(c.loadVA) : '';
    case 'wireSize':
      return c.wireSize;
    case 'note':
      return c.note ?? '';
    default:
      return '';
  }
}

/** 文字列を幅に収める（超過分は … で省略） */
function fitText(s: string, h: number, maxW: number): string {
  if (estimateTextWidth(s, h) <= maxW) return s;
  let out = '';
  for (const ch of s) {
    if (estimateTextWidth(out + ch + '…', h) > maxW) break;
    out += ch;
  }
  return out + '…';
}

export function generateLvSchedule(panel: LvPanelSpec, meta: ProjectMeta, transformers: TransformerSpec[]): GenResult[] {
  const sheet = meta.sheet;
  const g = sheetGeom(sheet);
  const totalW = COLS.reduce((s, c) => s + c.w, 0);
  const scale = Math.min(1, (g.drawable.x2 - TABLE_X) / totalW);
  const widths = COLS.map((c) => c.w * scale);

  const circuits = [...panel.circuits].sort((a, b) => a.no - b.no);
  const footerH = 20;
  const rowsPerPage = Math.max(1, Math.floor((g.drawable.y2 - TABLE_Y - HEADER_H - footerH) / ROW_H));
  const pageCount = Math.max(1, Math.ceil(circuits.length / rowsPerPage));
  const results: GenResult[] = [];

  for (let page = 1; page <= pageCount; page++) {
    const idSuffix = pageCount > 1 ? `-p${page}` : '';
    const id = `lv-schedule-${panel.id}${idSuffix}`;
    const b = new DiagramBuilder(id, 'lv-schedule', `分電盤 ${panel.name} 回路表`, sheet, panel.id);
    const rows = circuits.slice((page - 1) * rowsPerPage, page * rowsPerPage);

    b.text(g.drawable.x1 + 5, 30, `${panel.name} 回路表`, TEXT.title, 'start');
    b.text(
      g.drawable.x1 + 5,
      38,
      `供給方式: ${SUPPLY_LABEL[panel.supply]}   主幹: ${mainBreakerLabel(panel)}   ${sourceLabel(panel, transformers)}`.trim(),
      TEXT.rating,
      'start',
    );

    // 罫線
    const x1 = TABLE_X;
    const x2 = TABLE_X + widths.reduce((s, w) => s + w, 0);
    const y1 = TABLE_Y;
    const y2 = TABLE_Y + HEADER_H + rows.length * ROW_H;
    b.shape(RECT(x1, y1, x2, y2, false, 'medium'));
    b.shape(L(x1, y1 + HEADER_H, x2, y1 + HEADER_H, 'medium'));
    for (let r = 1; r < rows.length; r++) {
      const y = y1 + HEADER_H + r * ROW_H;
      b.shape(L(x1, y, x2, y, 'thin'));
    }
    let cx = x1;
    widths.forEach((w, i) => {
      if (i > 0) b.shape(L(cx, y1, cx, y2, 'thin'));
      const col = COLS[i]!;
      b.text(cx + w / 2, y1 + HEADER_H / 2, col.title, TEXT.body, 'middle');
      cx += w;
    });

    // 本文
    rows.forEach((c, r) => {
      const cy = y1 + HEADER_H + r * ROW_H + ROW_H / 2;
      let x = x1;
      widths.forEach((w, i) => {
        const col = COLS[i]!;
        const raw = cellValue(c, col.key);
        if (raw) {
          const text = fitText(raw, TEXT.body, w - 3);
          const tx = col.align === 'start' ? x + 1.5 : col.align === 'end' ? x + w - 1.5 : x + w / 2;
          b.text(tx, cy, text, TEXT.body, col.align);
        }
        x += w;
      });
    });

    // 集計（最終ページ）
    if (page === pageCount) {
      const total = circuits.reduce((s, c) => s + c.loadVA, 0);
      let fy = y2 + 6;
      b.text(x1, fy, `合計負荷容量: ${total} VA`, TEXT.body, 'start');
      if (panel.supply === '1φ3W100/200') {
        const odd = circuits.filter((c) => c.no % 2 === 1 && c.voltage === 100).reduce((s, c) => s + c.loadVA, 0);
        const even = circuits.filter((c) => c.no % 2 === 0 && c.voltage === 100).reduce((s, c) => s + c.loadVA, 0);
        const v200 = circuits.filter((c) => c.voltage === 200).reduce((s, c) => s + c.loadVA, 0);
        fy += 5;
        b.text(x1, fy, `100V 負荷バランス  L1-N（奇数回路）: ${odd} VA / L2-N（偶数回路）: ${even} VA   200V 負荷: ${v200} VA`, TEXT.body, 'start');
      }
    }

    results.push({
      diagram: b.build(pageCount > 1 ? { page, pageCount } : {}),
      warnings: b.warnings,
    });
  }
  if (circuits.length === 0) results[0]!.warnings.push('分岐回路がありません');
  return results;
}
