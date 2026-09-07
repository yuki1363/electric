import type { SymbolCategory, SymbolDef, SymbolKind } from './types';
import { HV_SYMBOLS } from './hv';
import { LV_SYMBOLS } from './lv';
import { METER_SYMBOLS } from './meters';
import { MISC_SYMBOLS } from './misc';
import { FACE_SYMBOLS } from './face';

export const ALL_SYMBOLS: SymbolDef[] = [
  ...HV_SYMBOLS,
  ...LV_SYMBOLS,
  ...METER_SYMBOLS,
  ...MISC_SYMBOLS,
  ...FACE_SYMBOLS,
];

export const SYMBOLS: Record<SymbolKind, SymbolDef> = Object.fromEntries(
  ALL_SYMBOLS.map((s) => [s.kind, s]),
) as Record<SymbolKind, SymbolDef>;

export function getSymbol(kind: SymbolKind): SymbolDef {
  const def = SYMBOLS[kind];
  if (!def) throw new Error(`未定義の図記号: ${kind}`);
  return def;
}

export function isSymbolKind(v: unknown): v is SymbolKind {
  return typeof v === 'string' && v in SYMBOLS;
}

export const CATEGORY_NAMES: Record<SymbolCategory, string> = {
  hv: '高圧機器',
  lv: '低圧機器',
  meter: '計器',
  misc: 'その他',
  face: '盤面配置',
};

export function symbolsByCategory(): { category: SymbolCategory; name: string; symbols: SymbolDef[] }[] {
  const cats: SymbolCategory[] = ['hv', 'lv', 'meter', 'misc', 'face'];
  return cats.map((category) => ({
    category,
    name: CATEGORY_NAMES[category],
    symbols: ALL_SYMBOLS.filter((s) => s.category === category),
  }));
}

export type { Prim, Point, PortDef, PortDir, SymbolDef, SymbolKind, SymbolCategory } from './types';
