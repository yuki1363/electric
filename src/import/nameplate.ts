import type { SheetData } from './xlsx';
import { keyOf, normalize } from './normalize';

/** 銘板表の列 */
export type NpField = 'deviceName' | 'model' | 'ratingText' | 'maker' | 'madeOn' | 'serial' | 'location' | 'note';

export const NP_FIELD_LABEL: Record<NpField, string> = {
  deviceName: '機器名称',
  model: '型式',
  ratingText: '定格容量',
  maker: '製造者',
  madeOn: '製造年月',
  serial: '製造番号',
  location: '使用箇所',
  note: '備考',
};

/** 見出しの表記ゆれ。上から順に部分一致で判定する */
const HEADER_HINTS: [NpField, string[]][] = [
  ['deviceName', ['機器名称', '機器名', '名称', '機器']],
  ['model', ['型式', '形式', '型番', 'ﾒｰｶ型式']],
  ['ratingText', ['定格容量', '定格', '容量', '仕様']],
  ['maker', ['製造者', 'メーカー', 'メーカ', '製作者']],
  ['madeOn', ['製造年月', '製造年', '年月', '製造日']],
  ['serial', ['製造番号', '製番', 'シリアル', '号機']],
  ['location', ['使用箇所', '設置場所', '場所', '箇所']],
  ['note', ['備考', '所属', '盤名', '系統']],
];

/** 列番号 → 項目 の対応 */
export type ColumnMap = Partial<Record<NpField, number>>;

export interface DetectedHeader {
  /** ヘッダ行の番号（0 始まり） */
  rowIndex: number;
  map: ColumnMap;
  /** 一致した見出し語の数（確からしさ） */
  score: number;
}

/** 1 行を見出し行とみなして列対応を作る */
function mapRow(cells: string[]): { map: ColumnMap; score: number } {
  const map: ColumnMap = {};
  let score = 0;
  cells.forEach((raw, i) => {
    const k = keyOf(raw);
    if (!k) return;
    for (const [field, hints] of HEADER_HINTS) {
      if (map[field] !== undefined) continue;
      if (hints.some((h) => k.includes(keyOf(h)))) {
        map[field] = i;
        score++;
        return;
      }
    }
  });
  return { map, score };
}

/** 見出し行を探す。機器名称を含み、一致数が最も多い行を選ぶ */
export function detectHeader(rows: string[][]): DetectedHeader | null {
  let best: DetectedHeader | null = null;
  rows.forEach((cells, rowIndex) => {
    const { map, score } = mapRow(cells);
    if (map.deviceName === undefined || score < 2) return;
    if (!best || score > best.score) best = { rowIndex, map, score };
  });
  return best;
}

/** シートの中から銘板表らしいものを選ぶ */
export function pickSheet(sheets: SheetData[]): { sheet: SheetData; header: DetectedHeader } | null {
  let best: { sheet: SheetData; header: DetectedHeader } | null = null;
  for (const sheet of sheets) {
    const header = detectHeader(sheet.rows);
    if (!header) continue;
    if (!best || header.score > best.header.score) best = { sheet, header };
  }
  return best;
}

// ---------------------------------------------------------------- 定格の解析

export interface ParsedRating {
  /** 変圧器容量 kVA */
  kva?: number;
  /** コンデンサ容量 kvar */
  kvar?: number;
  /** 電圧 V（一次側） */
  primaryV?: number;
  /** 電圧 V（二次側） */
  secondaryV?: number;
  /** 定格電流 A */
  a?: number;
  /** 遮断容量 kA */
  ka?: number;
  /** CT 比などの比表記 */
  ratio?: string;
  /** リアクトル % */
  reactorPct?: number;
}

/**
 * 定格容量の自由記述から数値を拾う。
 * 例: "500kVA　6600/440" / "7.2kV600A 12.5kA" / "6900V　400/5" / "50kvar 6600V"
 */
export function parseRating(raw: string): ParsedRating {
  const s = normalize(raw).replace(/ｋ/g, 'k');
  const out: ParsedRating = {};

  const kva = s.match(/(\d+(?:\.\d+)?)\s*kVA/i);
  if (kva) out.kva = Number(kva[1]);
  const kvar = s.match(/(\d+(?:\.\d+)?)\s*kvar/i);
  if (kvar) out.kvar = Number(kvar[1]);
  const ka = s.match(/(\d+(?:\.\d+)?)\s*kA/i);
  if (ka) out.ka = Number(ka[1]);
  const pct = s.match(/L\s*=\s*(\d+(?:\.\d+)?)\s*%/i);
  if (pct) out.reactorPct = Number(pct[1]);

  // 電流。kA と紛れないよう直前が k でないものだけ
  const a = s.match(/(?<![k\d.])(\d+(?:\.\d+)?)\s*A(?![A-Za-z])/);
  if (a) out.a = Number(a[1]);
  // 限流ヒューズは "G20" のように記号で書かれることが多い
  if (out.a === undefined) {
    const g = s.match(/\bG\s*(\d+(?:\.\d+)?)/i);
    if (g) out.a = Number(g[1]);
  }

  // 6600/440 や 400/5 のような比。V が付く方を電圧、付かない小さい方を CT 比とみなす
  const ratio = s.match(/(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/);
  if (ratio) {
    const hi = Number(ratio[1]);
    const lo = Number(ratio[2]);
    if (lo <= 10 && hi >= 20) {
      out.ratio = `${ratio[1]}/${ratio[2]}A`;
    } else {
      out.primaryV = hi;
      out.secondaryV = lo;
    }
  }

  if (out.primaryV === undefined) {
    const kv = s.match(/(\d+(?:\.\d+)?)\s*kV/i);
    if (kv) out.primaryV = Number(kv[1]) * 1000;
    else {
      const v = s.match(/(\d{3,4})\s*V(?![A-Za-z])/);
      if (v) out.primaryV = Number(v[1]);
    }
  }
  return out;
}

// ---------------------------------------------------------------- 所属盤の分類

export type GroupKind = 'incoming' | 'main' | 'feeder' | 'capacitor' | 'lvPanel' | 'other';

export interface GroupInfo {
  kind: GroupKind;
  /** 表示用の盤名（原文の空白を整えたもの） */
  name: string;
}

/** 備考欄の文字列から所属を判定する */
export function classifyGroup(rawNote: string, rawLocation = ''): GroupInfo {
  const note = normalize(rawNote);
  const n = keyOf(rawNote);
  const loc = keyOf(rawLocation);
  if (!n && !loc) return { kind: 'other', name: note };
  if (n.includes('柱上') || loc.includes('柱')) return { kind: 'incoming', name: note || '柱上' };
  if (n.includes('受電盤') || n.includes('受電設備')) return { kind: 'main', name: note };
  if (n.includes('分岐盤') || /^F\d/.test(n) || n.includes('コンデンサ盤')) {
    // 「高圧分岐盤No.1 F1 38sq」のように電線サイズが付く行は、同じ盤としてまとめる
    return { kind: 'feeder', name: note.replace(/\s*\d+(?:\.\d+)?\s*sq\s*$/i, '').trim() };
  }
  if (n.includes('SC') || n.includes('コンデンサ')) return { kind: 'capacitor', name: note };
  if (n.includes('低圧') || n.includes('電灯') || n.includes('動力') || n.includes('電源盤')) {
    return { kind: 'lvPanel', name: note };
  }
  if (n.includes('CVT') || n.includes('SQ')) return { kind: 'incoming', name: note };
  return { kind: 'other', name: note };
}

// ---------------------------------------------------------------- 行の抽出

export interface ParsedRow {
  /** シート上の行番号（1 始まり。画面表示用） */
  lineNo: number;
  deviceName: string;
  model: string;
  ratingText: string;
  maker: string;
  madeOn: string;
  serial: string;
  location: string;
  note: string;
  rating: ParsedRating;
  group: GroupInfo;
}

/** 見出し行と同じ内容の行（ページ区切りで繰り返されるもの）か */
function isRepeatedHeader(cells: string[], headerCells: string[]): boolean {
  const a = cells.map(keyOf).filter(Boolean).join('|');
  const b = headerCells.map(keyOf).filter(Boolean).join('|');
  return a.length > 0 && a === b;
}

/** 表題だけの行（「機器銘板表」など 1 セルしか無い行）か */
function isTitleRow(cells: string[]): boolean {
  return cells.filter((c) => c.trim()).length === 1;
}

/** シートと列対応から銘板行を取り出す */
export function parseRows(sheet: SheetData, header: DetectedHeader, map: ColumnMap = header.map): ParsedRow[] {
  const headerCells = sheet.rows[header.rowIndex] ?? [];
  const at = (cells: string[], f: NpField): string => {
    const i = map[f];
    return i === undefined ? '' : normalize(cells[i] ?? '');
  };

  const out: ParsedRow[] = [];
  sheet.rows.forEach((cells, i) => {
    if (i <= header.rowIndex) return;
    if (!cells.some((c) => c.trim())) return;
    if (isRepeatedHeader(cells, headerCells)) return;
    if (isTitleRow(cells)) return;
    const deviceName = at(cells, 'deviceName');
    if (!deviceName) return;
    const ratingText = at(cells, 'ratingText');
    const note = at(cells, 'note');
    const location = at(cells, 'location');
    out.push({
      lineNo: i + 1,
      deviceName,
      model: at(cells, 'model'),
      ratingText,
      maker: at(cells, 'maker'),
      madeOn: at(cells, 'madeOn'),
      serial: at(cells, 'serial'),
      location,
      note,
      rating: parseRating(ratingText),
      group: classifyGroup(note, location),
    });
  });
  return out;
}
