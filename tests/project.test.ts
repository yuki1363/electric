import { describe, expect, it } from 'vitest';
import { parse, projectFileName, serialize } from '../src/model/project';
import { safeFileName } from '../src/export/download';
import { regenerateAll } from '../src/layout';
import { sampleProject } from '../src/model/defaults';

describe('safeFileName', () => {
  it('パスに使えない文字と空白を置換', () => {
    expect(safeFileName('a/b:c*d?e"f<g>h|i')).toBe('a_b_c_d_e_f_g_h_i');
    expect(safeFileName('回路 表')).toBe('回路_表');
  });

  it('asciiOnly で非 ASCII を落とす', () => {
    expect(safeFileName('E-001_分電盤 L-1', true)).toBe('E-001_L-1');
    expect(safeFileName('高圧受電設備', true)).toBe('drawing');
  });

  it('前後のアンダースコアと連続を整理', () => {
    expect(safeFileName('__a___b__')).toBe('a_b');
  });
});

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

  it('保存ファイル名は図番ベースの ASCII', () => {
    const p = sampleProject();
    expect(projectFileName(p)).toBe('E-001.elec.json');
    expect(projectFileName({ ...p, meta: { ...p.meta, drawingNo: '' } })).toBe('project.elec.json');
    expect(projectFileName({ ...p, meta: { ...p.meta, drawingNo: '図面 1' } })).toBe('1.elec.json');
  });

  it('欠けたフィールドは既定値で補完', () => {
    const back = parse(JSON.stringify({ version: 1, meta: { name: 'x' }, hv: {}, panels: [{ id: 'p1' }] }));
    expect(back.meta.sheet.size).toBe('A3');
    expect(back.hv.pas.kind).toBe('PAS');
    expect(back.panels[0]!.circuits).toEqual([]);
    expect(back.diagrams).toEqual([]);
  });
});
