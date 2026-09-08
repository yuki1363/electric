import type { Prim } from '../symbols/types';
import type { ProjectMeta, SheetSpec } from '../model/types';
import { L, RECT, T } from '../symbols/helpers';
import { TEXT, sheetGeom } from './constants';
import { scaleLabel } from './fit';

export interface TitleInfo {
  title: string;
  drawingNo: string;
  date: string;
  author: string;
  company?: string;
  page?: number;
  pageCount?: number;
  /** 図面に適用された縮尺（1 = 等倍） */
  scale?: number;
}

/** 図枠 + 表題欄（ワールド座標のプリミティブ） */
export function sheetFramePrims(sheet: SheetSpec, info: TitleInfo): Prim[] {
  const g = sheetGeom(sheet);
  const f = g.frame;
  const tb = g.titleBlock;
  const prims: Prim[] = [];

  // 外枠（太線）
  prims.push(RECT(f.x1, f.y1, f.x2, f.y2, false, 'thick'));

  // 表題欄: 3 行 × 2 列
  const rowH = (tb.y2 - tb.y1) / 3;
  const colX = tb.x1 + 110;
  prims.push(RECT(tb.x1, tb.y1, tb.x2, tb.y2));
  prims.push(L(tb.x1, tb.y1 + rowH, tb.x2, tb.y1 + rowH));
  prims.push(L(tb.x1, tb.y1 + rowH * 2, tb.x2, tb.y1 + rowH * 2));
  prims.push(L(colX, tb.y1, colX, tb.y2));

  const cell = (x: number, row: number, label: string, value: string) => {
    const y = tb.y1 + rowH * row + rowH / 2;
    prims.push(T(x + 2, y, label, TEXT.small, 'start', 'middle'));
    prims.push(T(x + 16, y, value, TEXT.rating, 'start', 'middle'));
  };
  const pageStr = info.pageCount && info.pageCount > 1 ? `  (${info.page ?? 1}/${info.pageCount})` : '';
  cell(tb.x1, 0, '図面名', info.title + pageStr);
  cell(colX, 0, '図番', info.drawingNo);
  cell(tb.x1, 1, '会社', info.company ?? '');
  cell(colX, 1, '日付', info.date);
  cell(tb.x1, 2, '用紙', `${sheet.size} 横  縮尺 ${scaleLabel(info.scale)}`);
  cell(colX, 2, '作成', info.author);

  return prims;
}

export function titleInfoFromMeta(
  meta: ProjectMeta,
  title: string,
  page?: number,
  pageCount?: number,
  scale?: number,
): TitleInfo {
  return {
    title,
    drawingNo: meta.drawingNo,
    date: meta.date,
    author: meta.author,
    ...(meta.company ? { company: meta.company } : {}),
    ...(page ? { page } : {}),
    ...(pageCount ? { pageCount } : {}),
    ...(scale !== undefined ? { scale } : {}),
  };
}
