import { describe, expect, it } from 'vitest';
import { TR_CONNECTIONS, trConnection, trConnectionText, trSymbolKind } from '../src/model/transformer';
import { generateHvSld } from '../src/layout/hvSld';
import { sampleProject } from '../src/model/defaults';
import { getSymbol } from '../src/symbols';
import type { HvSpec } from '../src/model/types';

describe('変圧器の結線', () => {
  it('既定は Δ-Δ で、単相は結線を持たない', () => {
    expect(trConnection(undefined)).toBe('Δ-Δ');
    expect(trConnection('でたらめ')).toBe('Δ-Δ');
    expect(trSymbolKind({ phase: '3φ' })).toBe('TR_3PH');
    expect(trSymbolKind({ phase: '1φ', connection: 'Y-Y' })).toBe('TR_1PH');
    expect(trConnectionText({ phase: '1φ', connection: 'Y-Y' })).toBe('');
    // 既定は表記しない（今までの図面と同じ見た目）
    expect(trConnectionText({ phase: '3φ', connection: 'Δ-Δ' })).toBe('');
  });

  it('結線ごとに別の図記号を使い、すべて定義済み', () => {
    const kinds = TR_CONNECTIONS.map((c) => trSymbolKind({ phase: '3φ', connection: c }));
    expect(new Set(kinds).size).toBe(TR_CONNECTIONS.length);
    for (const k of kinds) expect(() => getSymbol(k)).not.toThrow();
  });

  it('図面の図記号とラベルに結線が出る', () => {
    const p = sampleProject();
    const hv: HvSpec = {
      ...p.hv,
      transformers: p.hv.transformers.map((t) => ({ ...t, phase: '3φ' as const, connection: 'Δ-Y' as const })),
    };
    const d = generateHvSld(hv, p.meta, p.panels)[0]!.diagram;
    expect(d.elements.some((e) => e.kind === 'TR_3PH_DY')).toBe(true);
    expect(d.elements.some((e) => e.labels.some((l) => l.includes('Δ-Y')))).toBe(true);
  });
});
