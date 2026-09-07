import type { SymbolDef } from './types';
import { C, L, PL } from './helpers';

const groundPrims = () => [L(0, -5, 0, 0), L(-4, 0, 4, 0), L(-2.5, 2, 2.5, 2), L(-1, 4, 1, 4)];

/** A種接地 */
export const GROUND_A: SymbolDef = {
  kind: 'GROUND_A',
  nameJa: '接地 (A種)',
  category: 'misc',
  bbox: { w: 8, h: 10 },
  prims: groundPrims(),
  ports: [{ id: 'N', x: 0, y: -5, dir: 'N' }],
  labelAnchor: { dx: 5, dy: 2, anchor: 'start' },
  defaultLabels: ['A種接地'],
};

/** B種接地 */
export const GROUND_B: SymbolDef = {
  kind: 'GROUND_B',
  nameJa: '接地 (B種)',
  category: 'misc',
  bbox: { w: 8, h: 10 },
  prims: groundPrims(),
  ports: [{ id: 'N', x: 0, y: -5, dir: 'N' }],
  labelAnchor: { dx: 5, dy: 2, anchor: 'start' },
  defaultLabels: ['B種接地'],
};

/** 接続点（塗り円）。全方向ポートは中心 */
export const JUNCTION: SymbolDef = {
  kind: 'JUNCTION',
  nameJa: '接続点',
  category: 'misc',
  bbox: { w: 2, h: 2 },
  prims: [C(0, 0, 0.8, true)],
  ports: [
    { id: 'N', x: 0, y: 0, dir: 'N' },
    { id: 'S', x: 0, y: 0, dir: 'S' },
    { id: 'E', x: 0, y: 0, dir: 'E' },
    { id: 'W', x: 0, y: 0, dir: 'W' },
  ],
  labelAnchor: { dx: 3, dy: 0, anchor: 'start' },
  defaultLabels: [],
};

/** 引込（下向き矢印付きの線） */
export const INCOMING: SymbolDef = {
  kind: 'INCOMING',
  nameJa: '引込',
  category: 'misc',
  bbox: { w: 6, h: 20 },
  prims: [
    L(0, -10, 0, 10),
    PL(
      [
        [-2.5, -4],
        [0, 1],
        [2.5, -4],
      ],
      true,
      true,
    ),
  ],
  ports: [{ id: 'S', x: 0, y: 10, dir: 'S' }],
  labelAnchor: { dx: 5, dy: -4, anchor: 'start' },
  defaultLabels: ['6.6kV 引込'],
};

/** ラベルのみ（図形なし） */
export const LABEL: SymbolDef = {
  kind: 'LABEL',
  nameJa: 'ラベル',
  category: 'misc',
  bbox: { w: 10, h: 5 },
  prims: [],
  ports: [],
  labelAnchor: { dx: 0, dy: 0, anchor: 'start' },
  defaultLabels: ['ラベル'],
};

export const MISC_SYMBOLS: SymbolDef[] = [GROUND_A, GROUND_B, JUNCTION, INCOMING, LABEL];
