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
  /**
   * 仕様から図面を自動作図する（既定 true）。
   * false にすると決まった形に作り直す動作をやめ、図面は手描きのものだけになる。
   */
  autoGenerate?: boolean;
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
  /** 台数（未設定＝1 台）。VT・CT が 2 台組のときなどに使う */
  qty?: number;
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
  | 'ocgr'
  | 'ovgr'
  | 'uvr'
  | 'ovr'
  | 'rpr'
  | 'ufr'
  | 'ofr'
  | 'relay'
  | 'lbs'
  | 'pf'
  | 'vcs'
  | 'pc'
  | 'lbs_pf'
  | 'zct'
  | 'vtf'
  | 'whTr'
  | 'meterA'
  | 'meterV'
  | 'meterW'
  | 'meterPf'
  | 'meterWh'
  | 'as'
  | 'mccb'
  | 'dtmc'
  | 'vs';

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
  ocgr: '地絡過電流継電器 (OCGR)',
  ovgr: '地絡過電圧継電器 (OVGR)',
  uvr: '不足電圧継電器 (UVR)',
  ovr: '過電圧継電器 (OVR)',
  rpr: '逆電力継電器 (RPR)',
  ufr: '不足周波数継電器 (UFR)',
  ofr: '過周波数継電器 (OFR)',
  relay: 'その他の継電器',
  lbs: '負荷開閉器 (LBS)',
  pf: '限流ヒューズ (PF)',
  vcs: '真空電磁接触器 (VCS)',
  pc: '高圧カットアウト (PC)',
  lbs_pf: 'PF付負荷開閉器 (LBS)',
  mccb: '配線用遮断器 (MCCB)',
  dtmc: '切替開閉器 (DTMC)',
  zct: '零相変流器 (ZCT)',
  vtf: 'VT ヒューズ',
  whTr: '取引用電力量計 (Wh)',
  meterA: '電流計 (A)',
  meterV: '電圧計 (V)',
  meterW: '電力計 (W)',
  meterPf: '力率計 (PF)',
  meterWh: '電力量計 (Wh)',
  as: '電流計切換開閉器 (AS)',
  vs: '電圧計切換開閉器 (VS)',
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

export type { TrConnection } from './transformer';
export type { RelayKind } from './relay';
import type { RelayKind } from './relay';
import type { TrConnection } from './transformer';

export interface TransformerSpec {
  id: Id;
  /** 例: Tr-1 */
  name: string;
  phase: TrPhase;
  /** 三相の結線（既定 Δ-Δ）。図記号と銘板の表記に効く */
  connection?: TrConnection;
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
   * 電源が別の変圧器の二次側のときの変圧器 id（低圧 → 低圧の変圧器）。
   * 6600 → 440 → 440 → 220 のように、高圧単線結線図の中で数珠つなぎに描く。
   */
  sourceTransformerId?: Id;
  /**
   * 高圧母線・分岐盤・他の変圧器のどれでもない電源（非常電源盤・発電機盤など）。
   * 母線につながず、変圧器の真上に引き込み線と名前を描く。
   */
  externalSource?: { name: string; ratingText?: string };
  /** 二次側に付ける計器（CT を置いて電流計、VT を置いて電圧計） */
  secondaryMetering?: PanelMetering;
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

/**
 * 分岐盤・変圧器二次に付ける計器。
 * 電流計は CT 二次、電圧計は盤に置いた VT の二次から取る。
 * as / vs は計器の手前に入れる切換開閉器（既定は付けない）。
 */
export interface PanelMetering {
  a?: boolean;
  v?: boolean;
  as?: boolean;
  vs?: boolean;
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
  /** 保護継電器。未設定なら ocr から移行する */
  relays?: RelayKind[];
  /** 盤に付ける計器。電流計は CT 二次、電圧計は盤に置いた VT から取る */
  metering?: PanelMetering;
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
  /** 保護継電器。未設定なら ocr から移行する */
  relays?: RelayKind[];
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
  metering: {
    vt: boolean;
    a: boolean;
    v: boolean;
    w: boolean;
    wh: boolean;
    pf: boolean;
    /** 電流計切換開閉器（未指定なら付ける） */
    as?: boolean;
    /** 電圧計切換開閉器（未指定なら付ける） */
    vs?: boolean;
    /**
     * VT ヒューズの向き。
     * 'vertical'（既定）: VT の真上に縦に入れる。直列の 2 台が同じ列に並ぶ
     * 'horizontal': 引き出し線の途中に横向きで入れる。縦に 20mm 詰められる
     */
    vtfLayout?: 'vertical' | 'horizontal';
  };
  feeders: HvFeederSpec[];
  transformers: TransformerSpec[];
  capacitors: CapacitorSpec[];
  /** 受電盤内の機器銘板 */
  nameplates?: Partial<Record<HvSlot, Nameplate>>;
}

/**
 * 副変電所。高圧受電盤の「送り」（高圧分岐盤）から高圧で受けて、
 * その先にまた母線・分岐盤・変圧器を持つ設備。中身は受電設備と同じ構造をそのまま使う。
 */
export interface SubstationSpec {
  id: Id;
  /** 例: 副変電所No.1 */
  name: string;
  /** 電源になる親の高圧分岐盤（送り）の id。未設定なら電源名だけ書く */
  sourceFeederId?: Id;
  hv: HvSpec;
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

/** free は仕様に紐づかない図面（白紙・生成図面の写し）。作り直しの対象にしない */
export type DiagramKind = 'hv-sld' | 'lv-sld' | 'lv-face' | 'lv-schedule' | 'nameplate' | 'free';

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
  /** 手で足したものは 'manual'。図面を作り直しても引き継ぐ目印（自動生成では付けない） */
  origin?: 'manual';
  /** 機器銘板。図面で足した機器はここに入力する（仕様から生成した機器は仕様側に持つ） */
  nameplate?: Nameplate;
  /** 銘板表に出す機器名称。未入力なら図記号の名前を使う */
  nameplateName?: string;
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
  /** normal: 主回路 / bus: 母線 / control: 計器・制御回路（細線） */
  style: 'normal' | 'bus' | 'control';
  /** 手で引いたものは 'manual'。図面を作り直しても引き継ぐ */
  origin?: 'manual';
}

export interface TextItem {
  id: Id;
  x: number;
  y: number;
  text: string;
  h: number;
  anchor: TextAnchor;
  rot?: number;
  /** 手で足したものは 'manual'。図面を作り直しても引き継ぐ */
  origin?: 'manual';
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
  /**
   * 用紙に収めるときに適用した変換 (x' = ox + x * k)。
   * 図面を作り直すとき、手で足したものをこの逆変換で等倍に戻してから引き継ぐ。
   */
  fit?: { k: number; ox: number; oy: number };
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
  /** 送りでつながる副変電所 */
  substations?: SubstationSpec[];
  /** 図面に描かない機器の銘板（制御補機など）。銘板表にのみ出す */
  extraNameplates?: NameplateEntry[];
  diagrams: Diagram[];
}

export const isPortEnd = (e: WireEnd): e is { elementId: Id; portId: string } => 'elementId' in e;
