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

export const LV_SYMBOLS: SymbolDef[] = [MCB, ELB, TERMINAL, LOAD_ARROW];
