import type { PaperSize, SheetSpec } from '../model/types';

/** 配置格子 mm */
export const GRID = 5;

export const PAPER: Record<PaperSize, { w: number; h: number }> = {
  A3: { w: 420, h: 297 },
  A4: { w: 297, h: 210 },
};

/** 表題欄寸法 */
export const TITLE_BLOCK = { w: 180, h: 30 };

/** 文字高 mm */
export const TEXT = {
  title: 5,
  name: 3.5,
  rating: 2.5,
  body: 2.5,
  small: 2,
};

export const LINE_GAP = 1.4;

/** 配線ルータの端子スタブ長 */
export const STUB = 5;

export interface SheetGeom {
  w: number;
  h: number;
  /** 図枠内側 */
  frame: { x1: number; y1: number; x2: number; y2: number };
  /** 表題欄を除いた描画可能領域 */
  drawable: { x1: number; y1: number; x2: number; y2: number };
  titleBlock: { x1: number; y1: number; x2: number; y2: number };
}

export function sheetGeom(sheet: SheetSpec): SheetGeom {
  const { w, h } = PAPER[sheet.size];
  const m = sheet.frameMargin;
  const frame = { x1: m, y1: m, x2: w - m, y2: h - m };
  const titleBlock = { x1: frame.x2 - TITLE_BLOCK.w, y1: frame.y2 - TITLE_BLOCK.h, x2: frame.x2, y2: frame.y2 };
  const drawable = { x1: frame.x1 + 5, y1: frame.y1 + 5, x2: frame.x2 - 5, y2: titleBlock.y1 - 5 };
  return { w, h, frame, drawable, titleBlock };
}

export const defaultSheet = (size: PaperSize = 'A3'): SheetSpec => ({
  size,
  orientation: 'landscape',
  frameMargin: 10,
});
