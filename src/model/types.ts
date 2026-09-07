/**
 * プロジェクトのコアデータモデル。
 * 座標は用紙空間 mm、y 下向き、原点 = 用紙左上。
 */
import type { Point, Prim, SymbolKind, TextAnchor } from '../symbols/types';
import type { Rot } from '../symbols/transform';

export type Id = string;
export type PaperSize = 'A3' | 'A4';

export interface SheetSpec {
  size: PaperSize;
  orientation: 'landscape';
  /** 図枠の用紙端からの余白 mm */
  frameMargin: number;
}

export interface ProjectMeta {
  name: string;
  drawingNo: string;
  /** YYYY-MM-DD */
  date: string;
  author: string;
  company?: string;
  sheet: SheetSpec;
}

// ---------------------------------------------------------------- 高圧受電設備

export type TrPhase = '1φ' | '3φ';
export type TrSecondary = '105-210V' | '210V' | '105V' | '420V';
export type HvSwitch = 'LBS' | 'PC';

export interface TransformerSpec {
  id: Id;
  /** 例: Tr-1 */
  name: string;
  phase: TrPhase;
  kva: number;
  secondary: TrSecondary;
  switch: HvSwitch;
  /** 限流ヒューズ定格 A */
  pfA: number;
  /** 給電先分電盤 id */
  feeds?: Id;
}

export interface CapacitorSpec {
  id: Id;
  name: string;
  kvar: number;
  /** 直列リアクトル（6%）付き */
  sr: boolean;
  switch: HvSwitch;
  pfA: number;
}

export type HvMainBreaker =
  | { type: 'CB'; vcb: { ratedA: number; breakingKA: number }; ocr: boolean; ctRatio: string }
  | { type: 'PF-S'; lbs: { ratedA: number }; pfA: number };

export interface HvSpec {
  enabled: boolean;
  /** 架空 / 地中 */
  incoming: 'overhead' | 'underground';
  pas: { kind: 'PAS' | 'UGS' | 'none'; sog: boolean; ratedA: number };
  cable: { type: string; sq: number; lengthM?: number };
  /** 取引用計器（VCT + Wh） */
  vct: boolean;
  ds: boolean;
  mainBreaker: HvMainBreaker;
  la: boolean;
  metering: { vt: boolean; a: boolean; v: boolean; w: boolean; wh: boolean; pf: boolean };
  transformers: TransformerSpec[];
  capacitors: CapacitorSpec[];
  grounding: { aType: boolean; bType: boolean };
}

// ---------------------------------------------------------------- 低圧分電盤

export type SupplyKind = '1φ2W100' | '1φ2W200' | '1φ3W100/200' | '3φ3W210';
export type BreakerKind = 'MCB' | 'ELB';
export type Poles = '1P' | '2P' | '3P';

export interface CircuitSpec {
  no: number;
  name: string;
  breaker: BreakerKind;
  at: number;
  poles: Poles;
  voltage: 100 | 200 | 210;
  loadName: string;
  loadVA: number;
  wireSize: string;
  sensitivityMa?: number;
  note?: string;
}

export interface LvPanelSpec {
  id: Id;
  /** 例: L-1 */
  name: string;
  supply: SupplyKind;
  sourceTransformerId?: Id;
  main: { kind: BreakerKind; af: number; at: number; poles: '2P' | '3P'; sensitivityMa?: number };
  circuits: CircuitSpec[];
  face: { rows: 1 | 2; order: 'oddTopEvenBottom' | 'sequential' };
}

// ---------------------------------------------------------------- 図面

export type DiagramKind = 'hv-sld' | 'lv-sld' | 'lv-face' | 'lv-schedule';

export interface Element {
  id: Id;
  kind: SymbolKind;
  /** 中心座標 */
  x: number;
  y: number;
  rot: Rot;
  /** labelAnchor（+labelOffset）に積む行 */
  labels: string[];
  labelOffset?: Point;
  /** 仕様のエコー（プロパティパネル表示用） */
  props?: Record<string, string | number | boolean>;
}

export type WireEnd = { elementId: Id; portId: string } | { x: number; y: number };

export interface Wire {
  id: Id;
  from: WireEnd;
  to: WireEnd;
  /** 端点を含む直交折線（ワールド座標） */
  points: Point[];
  /** true のとき自動ルータは points を上書きしない */
  manual: boolean;
  style: 'normal' | 'bus';
}

export interface TextItem {
  id: Id;
  x: number;
  y: number;
  text: string;
  h: number;
  anchor: TextAnchor;
  rot?: number;
}

export interface Diagram {
  id: Id;
  kind: DiagramKind;
  title: string;
  sheet: SheetSpec;
  /** lv-* の場合は LvPanelSpec.id */
  sourceId?: Id;
  /** 複数ページのときのページ番号 (1 始まり) */
  page?: number;
  pageCount?: number;
  elements: Element[];
  wires: Wire[];
  texts: TextItem[];
  /** 選択不可の図形（表の罫線など）。ワールド座標 */
  shapes: Prim[];
  /** 手動編集あり → 再生成時に警告 */
  edited: boolean;
  /** 仕様変更後に未再生成 */
  stale?: boolean;
}

export interface Project {
  version: 1;
  meta: ProjectMeta;
  hv: HvSpec;
  panels: LvPanelSpec[];
  diagrams: Diagram[];
}

export const isPortEnd = (e: WireEnd): e is { elementId: Id; portId: string } => 'elementId' in e;
