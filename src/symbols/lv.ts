import type { SymbolDef } from './types';
import { C, L, PL, bladePrims, crossPrims, portsNS, rightLabel } from './helpers';

/** 配線用遮断器 MCB: 固定接点に × */
export const MCB: SymbolDef = {
  kind: 'MCB',
  nameJa: '配線用遮断器 (MCB)',
  category: 'lv',
  bbox: { w: 10, h: 20 },
  prims: [...bladePrims(), ...crossPrims(0, -4)],
  ports: portsNS(),
  labelAnchor: rightLabel(10),
  defaultLabels: ['MCB'],
};

/** 漏電遮断器 ELB: 遮断器 + 下側リードに零相変流器の小円 */
export const ELB: SymbolDef = {
  kind: 'ELB',
  nameJa: '漏電遮断器 (ELB)',
  category: 'lv',
  bbox: { w: 10, h: 20 },
  prims: [L(0, -10, 0, -4), L(0, 4, 4.5, -4.5), ...crossPrims(0, -4), L(0, 4, 0, 10), C(0, 7, 2)],
  ports: portsNS(),
  labelAnchor: rightLabel(10),
  defaultLabels: ['ELB'],
};

/** 端子 */
export const TERMINAL: SymbolDef = {
  kind: 'TERMINAL',
  nameJa: '端子',
  category: 'lv',
  bbox: { w: 4, h: 10 },
  prims: [L(0, -5, 0, -1.5), C(0, 0, 1.5), L(0, 1.5, 0, 5)],
  ports: portsNS(5),
  labelAnchor: rightLabel(4),
  defaultLabels: [],
};

/** 負荷矢印（下向き） */
export const LOAD_ARROW: SymbolDef = {
  kind: 'LOAD_ARROW',
  nameJa: '負荷（矢印）',
  category: 'lv',
  bbox: { w: 4, h: 10 },
  prims: [
    L(0, -5, 0, 2),
    PL(
      [
        [-2, 1],
        [0, 5],
        [2, 1],
      ],
      true,
      true,
    ),
  ],
  ports: [{ id: 'N', x: 0, y: -5, dir: 'N' }],
  labelAnchor: { dx: 0, dy: 9, anchor: 'middle' },
  defaultLabels: [],
};

/**
 * ダブルスロー切替開閉器 DTMC: 発電系統と受電系統の切替。
 * 下の共通端子から刃が伸び、上（受電側）と左（発電側）の 2 つの固定接点のどちらかに倒れる。
 * 受電側を中心線に置くので、縦に積んだ機器とそのままつながる。
 */
export const DTMC: SymbolDef = {
  kind: 'DTMC',
  nameJa: '切替開閉器 (DTMC・ダブルスロー)',
  category: 'lv',
  bbox: { w: 20, h: 20 },
  prims: [
    ...bladePrims(), // 受電側（上）の固定接点と刃・負荷側リード
    L(-10, -5, -4, -5), // 発電側（左）の固定接点とリード
    C(0, 4, 0.9, true), // 支点
  ],
  ports: [
    { id: 'N', x: 0, y: -10, dir: 'N' },
    { id: 'W', x: -10, y: -5, dir: 'W' },
    { id: 'S', x: 0, y: 10, dir: 'S' },
  ],
  labelAnchor: rightLabel(20),
  defaultLabels: ['DTMC'],
};

export const LV_SYMBOLS: SymbolDef[] = [MCB, ELB, DTMC, TERMINAL, LOAD_ARROW];
