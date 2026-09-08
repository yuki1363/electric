import type { Project, ProjectMeta } from '../model/types';
import { nameplateRows, type NameplateRow } from '../model/nameplateRows';
import { L, RECT } from '../symbols/helpers';
import { DiagramBuilder } from './builder';
import { TEXT, sheetGeom } from './constants';
import { estimateTextWidth } from './textWidth';
import type { GenResult } from './types';

const COLS: { key: keyof NameplateRow; title: string; w: number; align: 'start' | 'middle' | 'end' }[] = [
  { key: 'deviceName', title: '機器名称', w: 32, align: 'start' },
  { key: 'model', title: '型式', w: 44, align: 'start' },
  { key: 'ratingText', title: '定格容量', w: 52, align: 'start' },
  { key: 'maker', title: '製造者', w: 34, align: 'start' },
  { key: 'madeOn', title: '製造年月', w: 24, align: 'middle' },
  { key: 'serial', title: '製造番号', w: 32, align: 'start' },
  { key: 'location', title: '使用箇所', w: 32, align: 'start' },
  { key: 'note', title: '備考', w: 47, align: 'start' },
];
const TABLE_X = 20;
const TABLE_Y = 42;
const HEADER_H = 8;
const ROW_H = 6.5;

/** 幅に収まらない文字列は末尾を … で省く */
function fitText(s: string, h: number, maxW: number): string {
  if (estimateTextWidth(s, h) <= maxW) return s;
  let out = '';
  for (const ch of s) {
    if (estimateTextWidth(out + ch + '…', h) > maxW) break;
    out += ch;
  }
  return out + '…';
}

/** 機器銘板表。行数が用紙に収まらない場合は複数ページに分割する */
export function generateNameplate(project: Project, meta: ProjectMeta = project.meta): GenResult[] {
  const sheet = meta.sheet;
  const g = sheetGeom(sheet);
  const totalW = COLS.reduce((s, c) => s + c.w, 0);
  const scale = Math.min(1, (g.drawable.x2 - TABLE_X) / totalW);
  const widths = COLS.map((c) => c.w * scale);

  const rows = nameplateRows(project);
  const rowsPerPage = Math.max(1, Math.floor((g.drawable.y2 - TABLE_Y - HEADER_H - 6) / ROW_H));
  const pageCount = Math.max(1, Math.ceil(rows.length / rowsPerPage));
  const results: GenResult[] = [];

  for (let page = 1; page <= pageCount; page++) {
    const id = `nameplate${pageCount > 1 ? `-p${page}` : ''}`;
    const b = new DiagramBuilder(id, 'nameplate', '機器銘板表', sheet);
    const pageRows = rows.slice((page - 1) * rowsPerPage, page * rowsPerPage);

    b.text(g.drawable.x1 + 5, 30, '機器銘板表', TEXT.title, 'start');
    b.text(g.drawable.x2, 30, `${meta.name}　全 ${rows.length} 台`, TEXT.rating, 'end');

    const x1 = TABLE_X;
    const x2 = TABLE_X + widths.reduce((s, w) => s + w, 0);
    const y1 = TABLE_Y;
    const y2 = TABLE_Y + HEADER_H + pageRows.length * ROW_H;
    b.shape(RECT(x1, y1, x2, y2, false, 'medium'));
    b.shape(L(x1, y1 + HEADER_H, x2, y1 + HEADER_H, 'medium'));
    for (let r = 1; r < pageRows.length; r++) {
      const y = y1 + HEADER_H + r * ROW_H;
      b.shape(L(x1, y, x2, y, 'thin'));
    }
    let cx = x1;
    widths.forEach((w, i) => {
      if (i > 0) b.shape(L(cx, y1, cx, y2, 'thin'));
      b.text(cx + w / 2, y1 + HEADER_H / 2, COLS[i]!.title, TEXT.body, 'middle');
      cx += w;
    });

    pageRows.forEach((r, i) => {
      const cy = y1 + HEADER_H + i * ROW_H + ROW_H / 2;
      let x = x1;
      widths.forEach((w, ci) => {
        const col = COLS[ci]!;
        const raw = r[col.key];
        if (raw) {
          const text = fitText(raw, TEXT.body, w - 3);
          const tx = col.align === 'start' ? x + 1.5 : col.align === 'end' ? x + w - 1.5 : x + w / 2;
          b.text(tx, cy, text, TEXT.body, col.align);
        }
        x += w;
      });
    });

    results.push({
      diagram: b.build(pageCount > 1 ? { page, pageCount } : {}),
      warnings: b.warnings,
    });
  }

  if (rows.length === 0) results[0]!.warnings.push('銘板を登録した機器がありません');
  return results;
}
