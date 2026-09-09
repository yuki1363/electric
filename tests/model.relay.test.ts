import { describe, expect, it } from 'vitest';
import {
  RELAY_CIRCUIT,
  RELAY_KINDS,
  migrateRelays,
  moveRelay,
  orderRelays,
  relaySymbolKind,
  toggleRelay,
} from '../src/model/relay';
import { generateHvSld } from '../src/layout/hvSld';
import { parse, serialize } from '../src/model/project';
import { sampleProject } from '../src/model/defaults';
import { getSymbol } from '../src/symbols';
import type { HvSpec, RelayKind } from '../src/model/types';

describe('保護継電器', () => {
  it('すべての種類に図記号がある', () => {
    for (const r of RELAY_KINDS) expect(() => getSymbol(relaySymbolKind(r))).not.toThrow();
  });

  it('足し引き・並べ替えは開閉装置と同じ扱い', () => {
    expect(toggleRelay([], 'UVR', true)).toEqual(['UVR']);
    expect(toggleRelay(['UVR'], 'OCR', true)).toEqual(['OCR', 'UVR']);
    expect(toggleRelay(['OCR', 'UVR'], 'OCR', false)).toEqual(['UVR']);
    expect(moveRelay(['OCR', 'UVR'], 'UVR', -1)).toEqual(['UVR', 'OCR']);
    expect(orderRelays(['OCR', 'OCR', 'xx' as RelayKind])).toEqual(['OCR']);
  });

  it('旧データの ocr 真偽値から移行する', () => {
    expect(migrateRelays(undefined, true)).toEqual(['OCR']);
    expect(migrateRelays(undefined, false)).toEqual([]);
    expect(migrateRelays(['UVR'], true)).toEqual(['UVR']);
  });

  it('電流回路と電圧回路の区別を持つ', () => {
    expect(RELAY_CIRCUIT.OCR.c).toBe(true);
    expect(RELAY_CIRCUIT.UVR.v).toBe(true);
    expect(RELAY_CIRCUIT.UVR.c).toBe(false);
    expect(RELAY_CIRCUIT.RPR).toEqual({ c: true, v: true, z: false });
  });

  it('CT 二次の継電器は CT の右に直列、VT 二次の継電器は電圧回路につながる', () => {
    const p = sampleProject();
    const hv: HvSpec = {
      ...p.hv,
      mainBreaker: { ...p.hv.mainBreaker, relays: ['OCR', 'RPR', 'UVR', 'OVR'] },
    };
    const d = generateHvSld(hv, p.meta, p.panels)[0]!.diagram;
    const ct = d.elements.find((e) => e.kind === 'CT')!;
    for (const k of ['OCR', 'RPR', 'UVR', 'OVR'] as const) {
      const el = d.elements.find((e) => e.kind === k);
      expect(el, k).toBeTruthy();
      // 継電器はすべて CT と同じ段の右側に並ぶ
      expect(el!.x).toBeGreaterThan(ct.x);
      expect(el!.y).toBe(ct.y);
    }
    // OCR は CT のすぐ右（電流回路の先頭）
    const ocr = d.elements.find((e) => e.kind === 'OCR')!;
    const uvr = d.elements.find((e) => e.kind === 'UVR')!;
    expect(ocr.x).toBeLessThan(uvr.x);
  });

  it('旧形式 JSON を読むと ocr: true が OCR になる', () => {
    const p = sampleProject();
    const raw = JSON.parse(serialize(p));
    delete raw.hv.mainBreaker.relays;
    raw.hv.mainBreaker.ocr = true;
    const back = parse(JSON.stringify(raw));
    expect(back.hv.mainBreaker.relays).toEqual(['OCR']);
  });
});
