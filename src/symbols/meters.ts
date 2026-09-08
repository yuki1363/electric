import type { SymbolDef, SymbolKind } from './types';
import { C, L, RECT, T } from './helpers';

function meter(kind: SymbolKind, nameJa: string, letter: string): SymbolDef {
  return {
    kind,
    nameJa,
    category: 'meter',
    bbox: { w: 10, h: 10 },
    prims: [C(0, 0, 4.5), T(0, 0, letter, letter.length >= 3 ? 2 : letter.length > 1 ? 2.8 : 3.5)],
    ports: [
      { id: 'N', x: 0, y: -5, dir: 'N' },
      { id: 'S', x: 0, y: 5, dir: 'S' },
      { id: 'E', x: 5, y: 0, dir: 'E' },
      { id: 'W', x: -5, y: 0, dir: 'W' },
    ],
    labelAnchor: { dx: 0, dy: 9, anchor: 'middle' },
    defaultLabels: [],
  };
}

export const METER_A = meter('METER_A', '電流計 (A)', 'A');
export const METER_V = meter('METER_V', '電圧計 (V)', 'V');
export const METER_W = meter('METER_W', '電力計 (W)', 'W');
export const METER_WH = meter('METER_WH', '電力量計 (Wh)', 'Wh');
export const METER_PF = meter('METER_PF', '力率計 (cosφ)', 'cosφ');

/** 計器切換開閉器（電流計用 AS / 電圧計用 VS）。計器の手前に直列に入る */
function selector(kind: SymbolKind, nameJa: string, text: string): SymbolDef {
  return {
    kind,
    nameJa,
    category: 'meter',
    bbox: { w: 20, h: 10 },
    prims: [L(-10, 0, -8, 0), RECT(-8, -5, 8, 5), T(0, 0, text, 3), L(8, 0, 10, 0)],
    ports: [
      { id: 'W', x: -10, y: 0, dir: 'W' },
      { id: 'E', x: 10, y: 0, dir: 'E' },
      { id: 'N', x: 0, y: -5, dir: 'N' },
      { id: 'S', x: 0, y: 5, dir: 'S' },
    ],
    labelAnchor: { dx: 0, dy: 9, anchor: 'middle' },
    defaultLabels: [],
  };
}

export const AS = selector('AS', '電流計切換開閉器 (AS)', 'AS');
export const VS = selector('VS', '電圧計切換開閉器 (VS)', 'VS');

export const METER_SYMBOLS: SymbolDef[] = [METER_A, METER_V, METER_W, METER_WH, METER_PF, AS, VS];
