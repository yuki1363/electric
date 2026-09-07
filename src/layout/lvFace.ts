import type { CircuitSpec, LvPanelSpec, ProjectMeta } from '../model/types';
import type { SymbolKind } from '../symbols/types';
import { SUPPLY_LABEL, mainBreakerLabel } from '../model/labels';
import { getSymbol } from '../symbols';
import { L, RECT } from '../symbols/helpers';
import { DiagramBuilder } from './builder';
import { TEXT, sheetGeom } from './constants';
import { wrapText } from './textWidth';
import type { GenResult } from './types';

const OX = 40;
/** 見出しの下から盤の描画を始める */
const OY = 42;
const GAP = 2;
const ROW_PITCH = 52;
const BRANCH_X0 = OX + 55;

function blockKind(c: CircuitSpec): SymbolKind {
  return c.poles === '1P' ? 'FACE_BR_1P' : c.poles === '2P' ? 'FACE_BR_2P' : 'FACE_BR_3P';
}

/** 回路を行に振り分ける */
export function faceRows(panel: LvPanelSpec): CircuitSpec[][] {
  const sorted = [...panel.circuits].sort((a, b) => a.no - b.no);
  if (panel.face.rows === 1) return [sorted];
  if (panel.face.order === 'oddTopEvenBottom') {
    return [sorted.filter((c) => c.no % 2 === 1), sorted.filter((c) => c.no % 2 === 0)];
  }
  const half = Math.ceil(sorted.length / 2);
  return [sorted.slice(0, half), sorted.slice(half)];
}

export function generateLvFace(panel: LvPanelSpec, meta: ProjectMeta): GenResult {
  const sheet = meta.sheet;
  const g = sheetGeom(sheet);
  const id = `lv-face-${panel.id}`;
  const b = new DiagramBuilder(id, 'lv-face', `分電盤 ${panel.name} 盤面配置図`, sheet, panel.id);

  b.text(g.drawable.x1 + 5, 30, `${panel.name} 盤面配置図`, TEXT.title, 'start');
  b.text(g.drawable.x2, 28, SUPPLY_LABEL[panel.supply], TEXT.rating, 'end');
  b.text(g.drawable.x2, 33, `主幹 ${mainBreakerLabel(panel)}`, TEXT.rating, 'end');

  const rows = faceRows(panel);
  const nRows = rows.length;
  const rowCenterY = (r: number) => OY + 22 + r * ROW_PITCH;

  // 主幹
  const mainY = nRows === 2 ? (rowCenterY(0) + rowCenterY(1)) / 2 : rowCenterY(0);
  const main = b.el('FACE_MAIN', OX + 20, mainY, { labels: [] });
  b.text(main.x, main.y - 34, '主幹', TEXT.rating, 'middle');
  b.text(main.x, main.y + 8, `${panel.main.kind}`, TEXT.name, 'middle');
  b.text(main.x, main.y + 14, `${panel.main.at}A`, TEXT.name, 'middle');
  b.text(main.x, main.y + 20, panel.main.poles, TEXT.rating, 'middle');

  let maxX = main.x + 20;
  rows.forEach((row, r) => {
    const cy = rowCenterY(r);
    let cursor = BRANCH_X0;
    for (const c of row) {
      const kind = blockKind(c);
      const w = getSymbol(kind).bbox.w;
      const x = cursor + w / 2;
      const el = b.el(kind, x, cy, { labels: [], props: { no: c.no, at: c.at, poles: c.poles } });
      b.text(x, cy - 23, String(c.no), TEXT.body, 'middle');
      b.text(x, cy + 10, `${c.at}A`, c.poles === '1P' ? TEXT.small : TEXT.body, 'middle');
      if (c.breaker === 'ELB') b.text(x, cy + 15, 'E', TEXT.small, 'middle');
      // 負荷名は 2 行まで（3 行目は下段の回路番号と接触する）
      const nameLines = wrapText(c.loadName, TEXT.small, Math.max(w + 1, 9)).slice(0, 2);
      b.textLines(x, cy + 23, nameLines, TEXT.small, 'middle', 1.3);
      cursor += w + GAP;
      maxX = Math.max(maxX, el.x + w / 2);
    }
  });

  // 端子バー
  const lastBottom = rowCenterY(nRows - 1) + 20;
  const barY = lastBottom + 16;
  const barN = b.el('FACE_BAR', BRANCH_X0 + 30, barY, { labels: ['N'] });
  const barE = b.el('FACE_BAR', BRANCH_X0 + 30 + 70, barY, { labels: ['E'] });
  maxX = Math.max(maxX, barE.x + 30);
  void barN;

  // 外形
  const top = Math.min(main.y - 30, rowCenterY(0) - 20) - 10;
  const x1 = OX - 10;
  const x2 = maxX + 10;
  const y2 = barY + 12;
  b.shape(RECT(x1, top, x2, y2, false, 'thick'));
  // 取付穴（四隅）
  for (const [x, y] of [
    [x1 + 5, top + 5],
    [x2 - 5, top + 5],
    [x1 + 5, y2 - 5],
    [x2 - 5, y2 - 5],
  ] as const) {
    b.shape({ t: 'circle', cx: x, cy: y, r: 1.5 }, L(x - 2.5, y, x + 2.5, y), L(x, y - 2.5, x, y + 2.5));
  }
  b.text(x1, y2 + 5, `盤外形 約 ${Math.round(x2 - x1)} × ${Math.round(y2 - top)} mm（参考）`, TEXT.small, 'start');

  if (x2 > g.drawable.x2) b.warn('盤面配置図が用紙幅を超えています');
  if (y2 > g.drawable.y2) b.warn('盤面配置図が用紙高さを超えています');
  if (panel.circuits.length === 0) b.warn('分岐回路がありません');

  return { diagram: b.build(), warnings: b.warnings };
}
