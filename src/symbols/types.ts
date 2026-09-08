/**
 * 図記号プリミティブ定義。
 * 座標系: 記号ローカル座標、原点=記号中心、単位 mm、y 下向き。
 */
export interface Point {
  x: number;
  y: number;
}

/** 線幅クラス（mm 換算は render/style.ts） */
export type StrokeClass = 'thin' | 'medium' | 'thick';

export type TextAnchor = 'start' | 'middle' | 'end';
export type TextVAlign = 'baseline' | 'middle' | 'top';

export type Prim =
  | { t: 'line'; x1: number; y1: number; x2: number; y2: number; stroke?: StrokeClass }
  | { t: 'circle'; cx: number; cy: number; r: number; stroke?: StrokeClass; fill?: boolean }
  | {
      /** 角度は度。point(θ) = (cx + r cosθ, cy + r sinθ)（y 下向き空間）。start→end を +θ 方向に掃引 */
      t: 'arc';
      cx: number;
      cy: number;
      r: number;
      start: number;
      end: number;
      stroke?: StrokeClass;
    }
  | { t: 'polyline'; pts: Point[]; closed?: boolean; stroke?: StrokeClass; fill?: boolean }
  | {
      t: 'text';
      x: number;
      y: number;
      text: string;
      /** 文字高 mm */
      h: number;
      anchor?: TextAnchor;
      valign?: TextVAlign;
      /** 度。y 下向き空間で時計回り正 */
      rot?: number;
    };

export type PortDir = 'N' | 'S' | 'E' | 'W';

export interface PortDef {
  id: string;
  x: number;
  y: number;
  dir: PortDir;
}

export type SymbolCategory = 'hv' | 'lv' | 'meter' | 'misc' | 'face';

export type SymbolKind =
  // 高圧
  | 'PAS'
  | 'UGS'
  | 'CABLE_HEAD'
  | 'VCT'
  | 'DS'
  | 'VCB'
  | 'LBS'
  | 'LBS_PF'
  | 'VCS'
  | 'PC'
  | 'PF'
  | 'LA'
  | 'CT'
  | 'VT'
  | 'ZCT'
  | 'OCR'
  | 'TR_1PH'
  | 'TR_3PH'
  | 'SC'
  | 'SR'
  // 低圧
  | 'MCB'
  | 'ELB'
  | 'TERMINAL'
  | 'LOAD_ARROW'
  // 計器
  | 'METER_A'
  | 'METER_V'
  | 'METER_W'
  | 'METER_WH'
  | 'METER_PF'
  | 'AS'
  | 'VS'
  // その他
  | 'GROUND_A'
  | 'GROUND_B'
  | 'JUNCTION'
  | 'INCOMING'
  | 'LABEL'
  // 盤面配置図
  | 'FACE_MAIN'
  | 'FACE_BR_1P'
  | 'FACE_BR_2P'
  | 'FACE_BR_3P'
  | 'FACE_BAR';

export interface LabelAnchor {
  dx: number;
  dy: number;
  anchor: TextAnchor;
}

export interface SymbolDef {
  kind: SymbolKind;
  /** パレット表示名 */
  nameJa: string;
  category: SymbolCategory;
  /** 原点中心の外形寸法 */
  bbox: { w: number; h: number };
  prims: Prim[];
  ports: PortDef[];
  /** 既定ラベル位置（中心からの相対） */
  labelAnchor: LabelAnchor;
  defaultLabels?: string[];
}
