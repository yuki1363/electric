import type { SymbolDef } from './types';
import { ARC, C, L, PL, RECT, T, bladePrims, crossPrims, portsNS, rightLabel } from './helpers';

const std = { w: 10, h: 20 };

/** 断路器 DS: ブレード + 固定接点側の短い横バー */
export const DS: SymbolDef = {
  kind: 'DS',
  nameJa: '断路器 (DS)',
  category: 'hv',
  bbox: std,
  prims: [...bladePrims(), L(-2, -4, 2, -4)],
  ports: portsNS(),
  labelAnchor: rightLabel(10),
  defaultLabels: ['DS'],
};

/** 負荷開閉器 LBS: ブレード先端に小円 */
export const LBS: SymbolDef = {
  kind: 'LBS',
  nameJa: '負荷開閉器 (LBS)',
  category: 'hv',
  bbox: { w: 12, h: 20 },
  prims: [...bladePrims(), C(4.5, -4.5, 1.2)],
  ports: portsNS(),
  labelAnchor: rightLabel(12),
  defaultLabels: ['LBS'],
};

/** 真空遮断器 VCB: 固定接点に × */
export const VCB: SymbolDef = {
  kind: 'VCB',
  nameJa: '真空遮断器 (VCB)',
  category: 'hv',
  bbox: std,
  prims: [...bladePrims(), ...crossPrims(0, -4)],
  ports: portsNS(),
  labelAnchor: rightLabel(10),
  defaultLabels: ['VCB'],
};

/** 気中負荷開閉器 PAS: 負荷開閉器を箱で囲む */
export const PAS: SymbolDef = {
  kind: 'PAS',
  nameJa: '気中負荷開閉器 (PAS)',
  category: 'hv',
  bbox: { w: 16, h: 20 },
  prims: [...bladePrims(), C(4.5, -4.5, 1.2), RECT(-7, -7, 7, 7)],
  ports: portsNS(),
  labelAnchor: rightLabel(16),
  defaultLabels: ['PAS'],
};

/** 地中線用負荷開閉器 UGS */
export const UGS: SymbolDef = {
  kind: 'UGS',
  nameJa: '地中線用負荷開閉器 (UGS)',
  category: 'hv',
  bbox: { w: 20, h: 20 },
  prims: [...bladePrims(), C(4.5, -4.5, 1.2), RECT(-7, -7, 7, 7), L(-7, 7, -7, 9), L(-9, 9, -5, 9)],
  ports: portsNS(),
  labelAnchor: rightLabel(20),
  defaultLabels: ['UGS'],
};

/** ケーブルヘッド: 三角形 */
export const CABLE_HEAD: SymbolDef = {
  kind: 'CABLE_HEAD',
  nameJa: 'ケーブルヘッド',
  category: 'hv',
  bbox: { w: 8, h: 20 },
  prims: [
    L(0, -10, 0, -4),
    PL(
      [
        [-3.5, 4],
        [3.5, 4],
        [0, -4],
      ],
      true,
    ),
    L(0, 4, 0, 10),
  ],
  ports: portsNS(),
  labelAnchor: rightLabel(8),
  defaultLabels: ['CH'],
};

/** 計器用変成器 VCT: 箱 + 文字。E ポートから電力量計へ */
export const VCT: SymbolDef = {
  kind: 'VCT',
  nameJa: '計器用変成器 (VCT)',
  category: 'hv',
  bbox: { w: 20, h: 20 },
  prims: [L(0, -10, 0, -6), RECT(-8, -6, 8, 6), T(0, 0, 'VCT', 3), L(0, 6, 0, 10), L(8, 0, 10, 0)],
  ports: [...portsNS(), { id: 'E', x: 10, y: 0, dir: 'E' }],
  labelAnchor: { dx: -13, dy: 0, anchor: 'end' },
  defaultLabels: ['VCT'],
};

/** 限流ヒューズ PF: 矩形を貫く線 */
export const PF: SymbolDef = {
  kind: 'PF',
  nameJa: '限流ヒューズ (PF)',
  category: 'hv',
  bbox: std,
  prims: [L(0, -10, 0, 10), RECT(-2, -6, 2, 6)],
  ports: portsNS(),
  labelAnchor: rightLabel(10),
  defaultLabels: ['PF'],
};

/** 高圧カットアウト PC: 傾いたブレード上のヒューズ */
export const PC: SymbolDef = {
  kind: 'PC',
  nameJa: '高圧カットアウト (PC)',
  category: 'hv',
  bbox: { w: 12, h: 20 },
  prims: [
    L(0, -10, 0, -4),
    L(0, 10, 0, 4),
    L(0, 4, 4.5, -4.5),
    // ブレードに沿った矩形（回転 -63.4°相当）
    PL(
      [
        [0.2, 2.6],
        [3.2, -3.4],
        [4.6, -2.7],
        [1.6, 3.3],
      ],
      true,
    ),
  ],
  ports: portsNS(),
  labelAnchor: rightLabel(12),
  defaultLabels: ['PC'],
};

/** 避雷器 LA: 矩形内に矢印 */
export const LA: SymbolDef = {
  kind: 'LA',
  nameJa: '避雷器 (LA)',
  category: 'hv',
  bbox: std,
  prims: [
    L(0, -10, 0, -6),
    RECT(-3, -6, 3, 6),
    L(0, -4.5, 0, 3),
    PL(
      [
        [-1.5, 1.5],
        [0, 4.5],
        [1.5, 1.5],
      ],
      true,
      true,
    ),
    L(0, 6, 0, 10),
  ],
  ports: portsNS(),
  labelAnchor: rightLabel(10),
  defaultLabels: ['LA'],
};

/** 真空電磁接触器 VCS: 開閉器の固定接点に半円（接触器の記号） */
export const VCS: SymbolDef = {
  kind: 'VCS',
  nameJa: '真空電磁接触器 (VCS)',
  category: 'hv',
  bbox: { w: 12, h: 20 },
  prims: [...bladePrims(), ARC(0, -4, 2, 180, 360)],
  ports: portsNS(),
  labelAnchor: rightLabel(12),
  defaultLabels: ['VCS'],
};

/** 変流器 CT: 導体を囲む円、二次側は E へ */
export const CT: SymbolDef = {
  kind: 'CT',
  nameJa: '変流器 (CT)',
  category: 'hv',
  bbox: { w: 20, h: 20 },
  prims: [L(0, -10, 0, 10), C(0, 0, 3.5), L(3.5, 0, 10, 0)],
  ports: [...portsNS(), { id: 'E', x: 10, y: 0, dir: 'E' }],
  labelAnchor: { dx: -8, dy: 0, anchor: 'end' },
  defaultLabels: ['CT'],
};

/** 零相変流器 ZCT */
export const ZCT: SymbolDef = {
  kind: 'ZCT',
  nameJa: '零相変流器 (ZCT)',
  category: 'hv',
  bbox: { w: 20, h: 20 },
  prims: [L(0, -10, 0, 10), C(0, 0, 4), C(0, 0, 2.5), L(4, 0, 10, 0)],
  ports: [...portsNS(), { id: 'E', x: 10, y: 0, dir: 'E' }],
  labelAnchor: { dx: -8, dy: 0, anchor: 'end' },
  defaultLabels: ['ZCT'],
};

/** 計器用変圧器 VT: 縦に重なる2円 */
export const VT: SymbolDef = {
  kind: 'VT',
  nameJa: '計器用変圧器 (VT)',
  category: 'hv',
  bbox: { w: 10, h: 20 },
  prims: [L(0, -10, 0, -6), C(0, -2.5, 3.5), C(0, 2.5, 3.5), L(0, 6, 0, 10)],
  ports: portsNS(),
  labelAnchor: rightLabel(10),
  defaultLabels: ['VT'],
};

/** 過電流継電器 OCR: 箱 + 文字 */
export const OCR: SymbolDef = {
  kind: 'OCR',
  nameJa: '過電流継電器 (OCR)',
  category: 'hv',
  bbox: { w: 20, h: 10 },
  prims: [L(-10, 0, -8, 0), RECT(-8, -5, 8, 5), T(0, 0, 'OCR', 3), L(8, 0, 10, 0)],
  // E は CT 二次側の続き（電流計などが直列に入る）
  ports: [
    { id: 'W', x: -10, y: 0, dir: 'W' },
    { id: 'E', x: 10, y: 0, dir: 'E' },
  ],
  labelAnchor: rightLabel(20),
  defaultLabels: [],
};

/** 単相変圧器: 重なる2円 */
export const TR_1PH: SymbolDef = {
  kind: 'TR_1PH',
  nameJa: '単相変圧器',
  category: 'hv',
  bbox: { w: 12, h: 20 },
  prims: [L(0, -10, 0, -8), C(0, -3, 5), C(0, 3, 5), L(0, 8, 0, 10)],
  ports: portsNS(),
  labelAnchor: rightLabel(12),
  defaultLabels: ['Tr', '1φ'],
};

/** 三相変圧器: 重なる2円 + 各円に Δ */
export const TR_3PH: SymbolDef = {
  kind: 'TR_3PH',
  nameJa: '三相変圧器',
  category: 'hv',
  bbox: { w: 12, h: 20 },
  prims: [
    L(0, -10, 0, -8),
    C(0, -3, 5),
    C(0, 3, 5),
    PL(
      [
        [-1.8, -3.2],
        [1.8, -3.2],
        [0, -6.2],
      ],
      true,
    ),
    PL(
      [
        [-1.8, 5.2],
        [1.8, 5.2],
        [0, 2.2],
      ],
      true,
    ),
    L(0, 8, 0, 10),
  ],
  ports: portsNS(),
  labelAnchor: rightLabel(12),
  defaultLabels: ['Tr', '3φ'],
};

/** 進相コンデンサ SC */
export const SC: SymbolDef = {
  kind: 'SC',
  nameJa: '進相コンデンサ (SC)',
  category: 'hv',
  bbox: std,
  prims: [L(0, -10, 0, -1.2), L(-4, -1.2, 4, -1.2), L(-4, 1.2, 4, 1.2), L(0, 1.2, 0, 10)],
  ports: portsNS(),
  labelAnchor: rightLabel(10),
  defaultLabels: ['SC'],
};

/** 直列リアクトル SR: 半円 4 連 */
export const SR: SymbolDef = {
  kind: 'SR',
  nameJa: '直列リアクトル (SR)',
  category: 'hv',
  bbox: std,
  prims: [
    L(0, -10, 0, -6),
    ARC(0, -4.5, 1.5, -90, 90),
    ARC(0, -1.5, 1.5, -90, 90),
    ARC(0, 1.5, 1.5, -90, 90),
    ARC(0, 4.5, 1.5, -90, 90),
    L(0, 6, 0, 10),
  ],
  ports: portsNS(),
  labelAnchor: rightLabel(10),
  defaultLabels: ['SR'],
};

export const HV_SYMBOLS: SymbolDef[] = [
  PAS,
  UGS,
  CABLE_HEAD,
  VCT,
  DS,
  VCB,
  LBS,
  VCS,
  PC,
  PF,
  LA,
  CT,
  VT,
  ZCT,
  OCR,
  TR_1PH,
  TR_3PH,
  SC,
  SR,
];
