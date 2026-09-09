import type { SymbolKind } from '../symbols/types';
import type { TrPhase } from './types';

/**
 * 三相変圧器の結線。
 * 図記号（重なる 2 円の中の巻線記号）と、銘板の定格表記に使う。
 */
export type TrConnection = 'Δ-Δ' | 'Δ-Y' | 'Y-Δ' | 'Y-Y' | 'V-V' | 'スコット';

export const TR_CONNECTIONS: TrConnection[] = ['Δ-Δ', 'Δ-Y', 'Y-Δ', 'Y-Y', 'V-V', 'スコット'];

export const TR_CONNECTION_LABEL: Record<TrConnection, string> = {
  'Δ-Δ': 'Δ-Δ（デルタ・デルタ）',
  'Δ-Y': 'Δ-Y（デルタ・スター）',
  'Y-Δ': 'Y-Δ（スター・デルタ）',
  'Y-Y': 'Y-Y（スター・スター）',
  'V-V': 'V-V（開放デルタ）',
  スコット: 'スコット結線（T 結線）',
};

const SYMBOL: Record<TrConnection, SymbolKind> = {
  'Δ-Δ': 'TR_3PH',
  'Δ-Y': 'TR_3PH_DY',
  'Y-Δ': 'TR_3PH_YD',
  'Y-Y': 'TR_3PH_YY',
  'V-V': 'TR_3PH_VV',
  スコット: 'TR_SCOTT',
};

const isConnection = (v: unknown): v is TrConnection => TR_CONNECTIONS.includes(v as TrConnection);

/** 既定は Δ-Δ（従来の描き方） */
export const trConnection = (v: unknown): TrConnection => (isConnection(v) ? v : 'Δ-Δ');

/** 変圧器の図記号。単相は結線を持たない */
export function trSymbolKind(t: { phase: TrPhase; connection?: unknown }): SymbolKind {
  return t.phase === '1φ' ? 'TR_1PH' : SYMBOL[trConnection(t.connection)];
}

/** 銘板・図面に出す結線の表記。既定（Δ-Δ）は書かない */
export function trConnectionText(t: { phase: TrPhase; connection?: unknown }): string {
  if (t.phase === '1φ') return '';
  const c = trConnection(t.connection);
  return c === 'Δ-Δ' ? '' : c;
}
