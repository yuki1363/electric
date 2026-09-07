import { describe, expect, it } from 'vitest';
import { parse, serialize } from '../src/model/project';
import { regenerateAll } from '../src/layout';
import { sampleProject } from '../src/model/defaults';

describe('プロジェクト JSON', () => {
  it('往復で同一になる', () => {
    const p = sampleProject();
    p.diagrams = regenerateAll(p).diagrams;
    const text = serialize(p);
    const back = parse(text);
    expect(back).toEqual(p);
  });

  it('不正な JSON は例外', () => {
    expect(() => parse('{')).toThrow();
    expect(() => parse('[]')).toThrow();
    expect(() => parse(JSON.stringify({ version: 2 }))).toThrow(/バージョン/);
  });

  it('未知の図記号を含む図面は拒否', () => {
    const p = sampleProject();
    p.diagrams = regenerateAll(p).diagrams;
    const raw = JSON.parse(serialize(p));
    raw.diagrams[0].elements[0].kind = 'UNKNOWN';
    expect(() => parse(JSON.stringify(raw))).toThrow(/図記号/);
  });

  it('存在しない要素を参照する配線は拒否', () => {
    const p = sampleProject();
    p.diagrams = regenerateAll(p).diagrams;
    const raw = JSON.parse(serialize(p));
    raw.diagrams[0].wires[0].from = { elementId: 'nope', portId: 'S' };
    expect(() => parse(JSON.stringify(raw))).toThrow(/存在しない要素/);
  });

  it('欠けたフィールドは既定値で補完', () => {
    const back = parse(JSON.stringify({ version: 1, meta: { name: 'x' }, hv: {}, panels: [{ id: 'p1' }] }));
    expect(back.meta.sheet.size).toBe('A3');
    expect(back.hv.pas.kind).toBe('PAS');
    expect(back.panels[0]!.circuits).toEqual([]);
    expect(back.diagrams).toEqual([]);
  });
});
