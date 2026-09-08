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
  /** 図面上の機器ラベルに型式を併記する */
  showModels?: boolean;
}

// ---------------------------------------------------------------- 銘板

/** 機器銘板の記載事項。作図には使わず、銘板表と（任意で）図面ラベルに出す */
export interface Nameplate {
  /** 型式 */
  model?: string;
  /** 定格容量（原文のまま保持する） */
  ratingText?: string;
  /** 製造者 */
  maker?: string;
  /** 製造年月 */
  madeOn?: string;
  /** 製造番号 */
  serial?: string;
  /** 使用箇所 */
  location?: string;
  /** 備考 */
  note?: string;
}

/** 受電盤内の機器スロット（真偽値で持っている機器に銘板を紐付けるためのキー） */
export type HvSlot =
  | 'pas'
  | 'dgr'
  | 'cable'
  | 'vct'
  | 'ds'
  | 'vt'
  | 'la'
  | 'vcb'
  | 'ct'
  | 'ocr'
  | 'lbs'
  | 'pf'
  | 'vcs'
  | 'pc';

export const HV_SLOT_LABEL: Record<HvSlot, string> = {
  pas: '区分開閉器 (PAS/UGS)',
  dgr: '地絡方向継電器 (DGR)',
  cable: '引込ケーブル',
  vct: '計器用変成器 (VCT)',
  ds: '断路器 (DS)',
  vt: '計器用変圧器 (VT)',
  la: '避雷器 (LA)',
  vcb: '真空遮断器 (VCB)',
  ct: '変流器 (CT)',
  ocr: '過電流継電器 (OCR)',
  lbs: '負荷開閉器 (LBS)',
  pf: '限流ヒューズ (PF)',
  vcs: '真空電磁接触器 (VCS)',
  pc: '高圧カットアウト (PC)',
};

/** 図面上の機器に紐付かない銘板（制御補機など）。銘板表にのみ出す */
export interface NameplateEntry extends Nameplate {
  id: Id;
  /** 機器名称 */
  deviceName: string;
  /** 所属盤・系統 */
  group?: string;
}

// ---------------------------------------------------------------- 高圧受電設備

export type TrPhase = '1φ' | '3φ';
/** 二次電圧の表記。よく使う値は候補として出すが、440V など任意の値も入れられる */
export type TrSecondary = string;
export type { SwitchDevice } from './switchgear';
import type { SwitchDevice } from './switchgear';

export interface TransformerSpec {
  id: Id;
  /** 例: Tr-1 */
  name: string;
  phase: TrPhase;
  kva: number;
  /** 一次電圧。低圧用変圧器（440V→210V など）にも使えるよう入力できる */
  primary?: string;
  secondary: TrSecondary;
  /** 高圧側の開閉装置。空なら開閉器なし（母線・分岐盤に直結） */
  devices: SwitchDevice[];
  /** 限流ヒューズ定格 A */
  pfA: number;
  /** 給電先分電盤 id */
  feeds?: Id;
  /** 所属する高圧分岐盤 id。未指定なら高圧母線に直結 */
  feederId?: Id;
  /**
   * 電源が低圧の分電盤のときの盤 id（低圧 → 低圧の変圧器）。
   * 指定すると高圧単線結線図には描かず、その分電盤の単線結線図に分岐として描く。
   */
  sourcePanelId?: Id;
  /** 変圧器本体の銘板 */
  nameplate?: Nameplate;
  /** 開閉装置ごとの銘板。キーは機器名の小文字（lbs / pf / vcs / vcb / pc） */
  nameplates?: Record<string, Nameplate>;
}

export interface CapacitorSpec {
  id: Id;
  name: string;
  kvar: number;
  /** 直列リアクトル（6%）付き */
  sr: boolean;
  /** 高圧側の開閉装置。空なら開閉器なし */
  devices: SwitchDevice[];
  pfA: number;
  /** 所属する高圧分岐盤 id。未指定なら高圧母線に直結 */
  feederId?: Id;
  /** 進相コンデンサ本体の銘板 */
  nameplate?: Nameplate;
  /** 開閉装置と直列リアクトル（sr）の銘板 */
  nameplates?: Record<string, Nameplate>;
}

/** 高圧分岐盤（母線から分岐するフィーダー） */
export interface HvFeederSpec {
  id: Id;
  /** 例: 高圧分岐盤No.1 F1 */
  name: string;
  /** 遮断・開閉装置。空なら開閉器なし */
  devices: SwitchDevice[];
  ratedA: number;
  /** VCB の遮断容量 kA */
  breakingKA?: number;
  /** LBS の限流ヒューズ定格 A */
  pfA?: number;
  ct: boolean;
  /** 例: 100/5A */
  ctRatio?: string;
  ocr: boolean;
  cable?: { type: string; sq: number; lengthM?: number };
  /** 負荷名（配下に機器を置かない場合の行き先表示） */
  loadName?: string;
  /** vcb / lbs / pf / vcs / pc / ct / ocr / cable ごとの銘板 */
  nameplates?: Record<string, Nameplate>;
}

/** 受電盤の主遮断装置。高圧分岐盤と同じ形にそろえてある */
export interface HvMainBreaker {
  /** 空なら主遮断装置なし */
  devices: SwitchDevice[];
  ratedA: number;
  /** VCB の遮断容量 kA */
  breakingKA?: number;
  /** 限流ヒューズ定格 A */
  pfA?: number;
  ct: boolean;
  /** 例: 75/5A */
  ctRatio?: string;
  ocr: boolean;
}

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
  feeders: HvFeederSpec[];
  transformers: TransformerSpec[];
  capacitors: CapacitorSpec[];
  /** 受電盤内の機器銘板 */
  nameplates?: Partial<Record<HvSlot, Nameplate>>;
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
  nameplate?: Nameplate;
}

// ---------------------------------------------------------------- 図面

export type DiagramKind = 'hv-sld' | 'lv-sld' | 'lv-face' | 'lv-schedule' | 'nameplate';

export interface Element {
  id: Id;
  kind: SymbolKind;
  /** 中心座標 */
  x: number;
  y: number;
  rot: Rot;
  /** 図記号の拡大率（既定 1）。用紙に収めるための自動縮尺で設定される */
  scale?: number;
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
  /** 用紙に収めるために適用された縮尺（1 = 等倍） */
  scale?: number;
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
  /** 図面に描かない機器の銘板（制御補機など）。銘板表にのみ出す */
  extraNameplates?: NameplateEntry[];
  diagrams: Diagram[];
}

export const isPortEnd = (e: WireEnd): e is { elementId: Id; portId: string } => 'elementId' in e;
