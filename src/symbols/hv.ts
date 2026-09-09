import type { Prim, SymbolDef, SymbolKind } from './types';
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

/** 限流ヒューズ付高圧交流負荷開閉器 PF付LBS: 負荷開閉器とヒューズを 1 台にまとめた記号 */
export const LBS_PF: SymbolDef = {
  kind: 'LBS_PF',
  nameJa: 'PF付負荷開閉器 (LBS)',
  category: 'hv',
  bbox: { w: 12, h: 30 },
  prims: [
    // 上半分が負荷開閉器、下半分が限流ヒューズ（1 台にまとまった機器）
    L(0, -15, 0, -9), // 上側リード
    L(0, -1, 4.5, -9.5), // ブレード（開路状態）
    C(4.5, -9.5, 1.2), // 固定接点
    L(0, -1, 0, 1), // 開閉器とヒューズの間
    RECT(-2, 1, 2, 9), // 限流ヒューズ
    L(0, 9, 0, 15), // 下側リード
  ],
  ports: [
    { id: 'N', x: 0, y: -15, dir: 'N' },
    { id: 'S', x: 0, y: 15, dir: 'S' },
  ],
  labelAnchor: rightLabel(12),
  defaultLabels: ['PF付LBS'],
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

/**
 * 継電器のひな形: 箱 + 文字。
 * W から入って E へ抜けるので、計器回路の横一列にそのまま直列で入る。
 */
function relaySymbol(kind: SymbolKind, text: string, nameJa: string): SymbolDef {
  return {
    kind,
    nameJa,
    category: 'hv',
    bbox: { w: 20, h: 10 },
    // 文字数が多いと箱に収まらないので少し小さくする
    prims: [L(-10, 0, -8, 0), RECT(-8, -5, 8, 5), T(0, 0, text, text.length >= 4 ? 2.4 : 3), L(8, 0, 10, 0)],
    // W→E は計測回路の直列。N/S は電圧回路の横母線へ引き下げるのに使う
    ports: [
      { id: 'W', x: -10, y: 0, dir: 'W' },
      { id: 'E', x: 10, y: 0, dir: 'E' },
      { id: 'N', x: 0, y: -5, dir: 'N' },
      { id: 'S', x: 0, y: 5, dir: 'S' },
    ],
    labelAnchor: rightLabel(20),
    defaultLabels: [],
  };
}

/** 過電流継電器 OCR (51) */
export const OCR = relaySymbol('OCR', 'OCR', '過電流継電器 (OCR・51)');
export const OCGR = relaySymbol('OCGR', 'OCGR', '地絡過電流継電器 (OCGR・51G)');
export const DGR = relaySymbol('DGR', 'DGR', '地絡方向継電器 (DGR・67G)');
export const OVGR = relaySymbol('OVGR', 'OVGR', '地絡過電圧継電器 (OVGR・64)');
export const UVR = relaySymbol('UVR', 'UVR', '不足電圧継電器 (UVR・27)');
export const OVR = relaySymbol('OVR', 'OVR', '過電圧継電器 (OVR・59)');
export const RPR = relaySymbol('RPR', 'RPR', '逆電力継電器 (RPR・67P)');
export const UFR = relaySymbol('UFR', 'UFR', '不足周波数継電器 (UFR・81U)');
export const OFR = relaySymbol('OFR', 'OFR', '過周波数継電器 (OFR・81O)');
/** 名前をラベルで打つための無地の継電器 */
export const RELAY = relaySymbol('RELAY', '', '継電器（名称はラベル）');

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

/** 巻線の結線記号。円の中心 cy に描く */
type Winding = 'D' | 'Y' | 'V' | 'T';

function windingPrims(cy: number, w: Winding): Prim[] {
  switch (w) {
    case 'D': // Δ 結線（三角）
      return [
        PL(
          [
            [-1.8, cy + 1.6],
            [1.8, cy + 1.6],
            [0, cy - 1.6],
          ],
          true,
        ),
      ];
    case 'Y': // Y（星形）結線。中心から 3 方向
      return [L(0, cy, 0, cy - 2.2), L(0, cy, -1.9, cy + 1.3), L(0, cy, 1.9, cy + 1.3)];
    case 'V': // V 結線（開放 Δ）。三角の 2 辺だけ
      return [L(-1.8, cy - 1.6, 0, cy + 1.6), L(0, cy + 1.6, 1.8, cy - 1.6)];
    case 'T': // スコット（T）結線
      return [L(-1.8, cy - 1.6, 1.8, cy - 1.6), L(0, cy - 1.6, 0, cy + 1.8)];
  }
}

/** 三相変圧器のひな形。重なる 2 円の中に一次側・二次側の結線記号を描く */
function trSymbol(kind: SymbolKind, nameJa: string, pri: Winding, sec: Winding, labels: string[]): SymbolDef {
  return {
    kind,
    nameJa,
    category: 'hv',
    bbox: { w: 12, h: 20 },
    prims: [
      L(0, -10, 0, -8),
      C(0, -3, 5),
      C(0, 3, 5),
      ...windingPrims(-3.7, pri),
      ...windingPrims(3.7, sec),
      L(0, 8, 0, 10),
    ],
    ports: portsNS(),
    labelAnchor: rightLabel(12),
    defaultLabels: labels,
  };
}

/** 三相変圧器 Δ-Δ（既定） */
export const TR_3PH = trSymbol('TR_3PH', '三相変圧器 (Δ-Δ)', 'D', 'D', ['Tr', '3φ']);
export const TR_3PH_DY = trSymbol('TR_3PH_DY', '三相変圧器 (Δ-Y)', 'D', 'Y', ['Tr', '3φ']);
export const TR_3PH_YD = trSymbol('TR_3PH_YD', '三相変圧器 (Y-Δ)', 'Y', 'D', ['Tr', '3φ']);
export const TR_3PH_YY = trSymbol('TR_3PH_YY', '三相変圧器 (Y-Y)', 'Y', 'Y', ['Tr', '3φ']);
export const TR_3PH_VV = trSymbol('TR_3PH_VV', '三相変圧器 (V-V)', 'V', 'V', ['Tr', '3φ']);
export const TR_SCOTT = trSymbol('TR_SCOTT', 'スコット結線変圧器', 'T', 'T', ['Tr', 'スコット']);

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
  LBS_PF,
  VCS,
  PC,
  PF,
  LA,
  CT,
  VT,
  ZCT,
  OCR,
  OCGR,
  DGR,
  OVGR,
  UVR,
  OVR,
  RPR,
  UFR,
  OFR,
  RELAY,
  TR_1PH,
  TR_3PH,
  TR_3PH_DY,
  TR_3PH_YD,
  TR_3PH_YY,
  TR_3PH_VV,
  TR_SCOTT,
  SC,
  SR,
];
