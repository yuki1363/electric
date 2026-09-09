import type { SymbolKind } from '../symbols/types';
import { moveAt } from './array';

/**
 * 保護継電器。
 * どの計測回路（CT 二次・VT 二次・ZCT 二次）に入るかをここで宣言し、
 * 作図側は計器と同じ仕組みで直列につなぐ。
 */
export type RelayKind = 'OCR' | 'OCGR' | 'DGR' | 'OVGR' | 'UVR' | 'OVR' | 'RPR' | 'UFR' | 'OFR' | 'RELAY';

export const RELAY_KINDS: RelayKind[] = ['OCR', 'OCGR', 'DGR', 'OVGR', 'UVR', 'OVR', 'RPR', 'UFR', 'OFR', 'RELAY'];

export const RELAY_LABEL: Record<RelayKind, string> = {
  OCR: 'OCR 過電流継電器（51）',
  OCGR: 'OCGR 地絡過電流継電器（51G）',
  DGR: 'DGR 地絡方向継電器（67G）',
  OVGR: 'OVGR 地絡過電圧継電器（64）',
  UVR: 'UVR 不足電圧継電器（27）',
  OVR: 'OVR 過電圧継電器（59）',
  RPR: 'RPR 逆電力継電器（67P）',
  UFR: 'UFR 不足周波数継電器（81U）',
  OFR: 'OFR 過周波数継電器（81O）',
  RELAY: 'その他の継電器（名称はラベルで）',
};

export const RELAY_SHORT: Record<RelayKind, string> = {
  OCR: 'OCR',
  OCGR: 'OCGR',
  DGR: 'DGR',
  OVGR: 'OVGR',
  UVR: 'UVR',
  OVR: 'OVR',
  RPR: 'RPR',
  UFR: 'UFR',
  OFR: 'OFR',
  RELAY: 'その他',
};

/** 使う計測回路。c: CT 二次 / v: VT 二次 / z: ZCT 二次 */
export const RELAY_CIRCUIT: Record<RelayKind, { c: boolean; v: boolean; z: boolean }> = {
  OCR: { c: true, v: false, z: false },
  OCGR: { c: false, v: false, z: true },
  DGR: { c: false, v: true, z: true },
  OVGR: { c: false, v: true, z: false },
  UVR: { c: false, v: true, z: false },
  OVR: { c: false, v: true, z: false },
  RPR: { c: true, v: true, z: false },
  UFR: { c: false, v: true, z: false },
  OFR: { c: false, v: true, z: false },
  RELAY: { c: true, v: false, z: false },
};

const isRelay = (v: unknown): v is RelayKind => RELAY_KINDS.includes(v as RelayKind);

/** 重複と未知の値を除く。並びは入力どおり */
export function orderRelays(v: readonly RelayKind[] | undefined): RelayKind[] {
  if (!Array.isArray(v)) return [];
  const seen = new Set<RelayKind>();
  const out: RelayKind[] = [];
  for (const r of v) {
    if (!isRelay(r) || seen.has(r)) continue;
    seen.add(r);
    out.push(r);
  }
  return out;
}

/** チェックの入切。入れるときは既定順の位置に差し込む */
export function toggleRelay(v: readonly RelayKind[], r: RelayKind, on: boolean): RelayKind[] {
  const cur = orderRelays(v);
  if (!on) return cur.filter((x) => x !== r);
  if (cur.includes(r)) return cur;
  const rank = (x: RelayKind) => RELAY_KINDS.indexOf(x);
  const at = cur.findIndex((x) => rank(x) > rank(r));
  return at < 0 ? [...cur, r] : [...cur.slice(0, at), r, ...cur.slice(at)];
}

export function moveRelay(v: readonly RelayKind[], r: RelayKind, dir: -1 | 1): RelayKind[] {
  const cur = orderRelays(v);
  return moveAt(cur, cur.indexOf(r), dir);
}

export const relaySymbolKind = (r: RelayKind): SymbolKind => r;

/** 銘板スロットのキー */
export const relayKey = (r: RelayKind): string => r.toLowerCase();

/** 旧データの移行。ocr: true → ['OCR'] */
export function migrateRelays(relays: unknown, legacyOcr: unknown): RelayKind[] {
  if (Array.isArray(relays)) return orderRelays(relays.filter(isRelay));
  return legacyOcr === true ? ['OCR'] : [];
}

export const summaryRelays = (v: readonly RelayKind[] | undefined): string => {
  const o = orderRelays(v);
  return o.length === 0 ? '継電器なし' : o.map((r) => RELAY_SHORT[r]).join(' → ');
};
