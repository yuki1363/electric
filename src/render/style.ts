import type { StrokeClass } from '../symbols/types';

/** 線幅 mm */
export const STROKE_WIDTH: Record<StrokeClass, number> = {
  thin: 0.25,
  medium: 0.35,
  thick: 0.7,
};

export const DEFAULT_STROKE: StrokeClass = 'medium';

export const FONT_FAMILY = "'MS Gothic','Yu Gothic','Noto Sans JP','Hiragino Sans',sans-serif";

export const COLOR_LINE = '#000';
export const COLOR_SELECTED = '#1e88e5';
export const COLOR_PORT = '#e53935';
export const COLOR_GRID = '#e0e0e0';

/** レイヤ（SVG の g / DXF の LAYER） */
export type Layer = 'FRAME' | 'SYMBOL' | 'WIRE' | 'BUS' | 'TEXT' | 'TABLE';

export const LAYER_ORDER: Layer[] = ['FRAME', 'TABLE', 'BUS', 'WIRE', 'SYMBOL', 'TEXT'];

export const LAYER_STROKE: Record<Layer, StrokeClass> = {
  FRAME: 'thick',
  TABLE: 'thin',
  BUS: 'thick',
  WIRE: 'medium',
  SYMBOL: 'medium',
  TEXT: 'thin',
};

/** DXF 色番号（ACI） */
export const LAYER_DXF_COLOR: Record<Layer, number> = {
  FRAME: 7,
  TABLE: 7,
  BUS: 1,
  WIRE: 7,
  SYMBOL: 7,
  TEXT: 7,
};
