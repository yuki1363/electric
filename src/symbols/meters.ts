import type { SymbolDef, SymbolKind } from './types';
import { C, T } from './helpers';

function meter(kind: SymbolKind, nameJa: string, letter: string): SymbolDef {
  return {
    kind,
    nameJa,
    category: 'meter',
    bbox: { w: 10, h: 10 },
    prims: [C(0, 0, 4.5), T(0, 0, letter, letter.length > 1 ? 2.8 : 3.5)],
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
export const METER_PF = meter('METER_PF', '力率計 (PF)', 'PF');

export const METER_SYMBOLS: SymbolDef[] = [METER_A, METER_V, METER_W, METER_WH, METER_PF];
