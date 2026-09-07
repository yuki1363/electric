import { describe, expect, it } from 'vitest';
import { writeDxf } from '../src/export/dxf';
import { regenerateAll } from '../src/layout';
import { sampleProject } from '../src/model/defaults';
import { titleInfoFromMeta } from '../src/layout/sheet';
import { flattenDiagram } from '../src/render/flatten';
import { LAYER_ORDER } from '../src/render/style';
import type { Diagram } from '../src/model/types';

const p = sampleProject();
const diagrams = regenerateAll(p).diagrams;
const hv = diagrams[0]!;
const title = titleInfoFromMeta(p.meta, hv.title);

/** [code, value] の配列に分解 */
function pairs(text: string): [number, string][] {
  const lines = text.split('\r\n');
  if (lines[lines.length - 1] === '') lines.pop();
  expect(lines.length % 2).toBe(0);
  const out: [number, string][] = [];
  for (let i = 0; i < lines.length; i += 2) {
    const code = Number(lines[i]!.trim());
    expect(Number.isInteger(code), `code 行が整数でない: ${lines[i]}`).toBe(true);
    out.push([code, lines[i + 1]!]);
  }
  return out;
}

function makeDiagram(prims: Diagram['shapes']): Diagram {
  return {
    id: 't',
    kind: 'hv-sld',
    title: 't',
    sheet: { size: 'A3', orientation: 'landscape', frameMargin: 10 },
    elements: [],
    wires: [],
    texts: [],
    shapes: prims,
    edited: false,
  };
}

describe('DXF ライタ', () => {
  const text = writeDxf(hv, { title });
  const ps = pairs(text);

  it('セクション順序と EOF', () => {
    const sections = ps.filter(([c], i) => c === 2 && ps[i - 1]?.[0] === 0 && ps[i - 1]?.[1] === 'SECTION').map(([, v]) => v);
    expect(sections).toEqual(['HEADER', 'TABLES', 'BLOCKS', 'ENTITIES']);
    expect(ps[ps.length - 1]).toEqual([0, 'EOF']);
  });

  it('AC1009 と Shift_JIS コードページ', () => {
    const i = ps.findIndex(([c, v]) => c === 9 && v === '$ACADVER');
    expect(ps[i + 1]).toEqual([1, 'AC1009']);
    expect(ps.some(([c, v]) => c === 3 && v === 'ANSI_932')).toBe(true);
    const utf = pairs(writeDxf(hv, { title, codepage: 'utf8' }));
    expect(utf.some(([, v]) => v === '$DWGCODEPAGE')).toBe(false);
  });

  it('全エンティティは宣言済みレイヤを持つ', () => {
    const declared = new Set(ps.filter(([c], i) => c === 2 && ps[i - 1]?.[1] === 'LAYER').map(([, v]) => v));
    for (const l of LAYER_ORDER) expect(declared.has(l)).toBe(true);
    const start = ps.findIndex(([c, v]) => c === 2 && v === 'ENTITIES');
    let n = 0;
    for (let i = start; i < ps.length; i++) {
      const [c, v] = ps[i]!;
      if (c === 0 && !['ENDSEC', 'EOF', 'SECTION'].includes(v)) {
        n++;
        // 直後に 8 (レイヤ)
        expect(ps[i + 1]![0], `${v} にレイヤがない`).toBe(8);
        expect(declared.has(ps[i + 1]![1])).toBe(true);
      }
    }
    expect(n).toBeGreaterThan(50);
  });

  it('値に改行を含まない', () => {
    for (const [, v] of ps) expect(v.includes('\n')).toBe(false);
  });

  it('LINE 数がプリミティブ数と一致し、Y が反転する', () => {
    const d = makeDiagram([{ t: 'line', x1: 0, y1: 10, x2: 100, y2: 10 }]);
    const q = pairs(writeDxf(d));
    const lines = q.filter(([c, v]) => c === 0 && v === 'LINE');
    expect(lines.length).toBe(1);
    const i = q.findIndex(([c, v]) => c === 0 && v === 'LINE');
    expect(q[i + 3]).toEqual([20, '287.0']); // 297 - 10
    expect(q[i + 6]).toEqual([21, '287.0']);
    const flat = flattenDiagram(hv, { frame: title }).filter((x) => x.prim.t === 'line').length;
    expect(ps.filter(([c, v]) => c === 0 && v === 'LINE').length).toBe(flat);
  });

  it('POLYLINE → VERTEX × n → SEQEND', () => {
    const d = makeDiagram([{ t: 'polyline', pts: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }], closed: true }]);
    const q = pairs(writeDxf(d));
    const seq = q.filter(([c]) => c === 0).map(([, v]) => v);
    const i = seq.indexOf('POLYLINE');
    expect(seq.slice(i, i + 5)).toEqual(['POLYLINE', 'VERTEX', 'VERTEX', 'VERTEX', 'SEQEND']);
    const pi = q.findIndex(([c, v]) => c === 0 && v === 'POLYLINE');
    expect(q[pi + 2]).toEqual([66, '1']);
    expect(q[pi + 3]).toEqual([70, '1']);
  });

  it('円弧の角度変換（y 下向き -90→90 は DXF で 270→90）', () => {
    const d = makeDiagram([{ t: 'arc', cx: 0, cy: 0, r: 1, start: -90, end: 90 }]);
    const q = pairs(writeDxf(d));
    const i = q.findIndex(([c, v]) => c === 0 && v === 'ARC');
    const get = (code: number) => q.slice(i).find(([c]) => c === code)![1];
    expect(get(50)).toBe('270.0');
    expect(get(51)).toBe('90.0');
  });

  it('TEXT の整列コードと回転', () => {
    const d = makeDiagram([{ t: 'text', x: 5, y: 7, text: '変圧器 Tr-1', h: 3.5, anchor: 'middle', valign: 'middle', rot: 90 }]);
    const q = pairs(writeDxf(d));
    const i = q.findIndex(([c, v]) => c === 0 && v === 'TEXT');
    const seg = q.slice(i, i + 20);
    const get = (code: number) => seg.find(([c]) => c === code)![1];
    expect(get(1)).toBe('変圧器 Tr-1');
    expect(get(40)).toBe('3.5');
    expect(get(72)).toBe('1');
    expect(get(73)).toBe('2');
    expect(get(11)).toBe('5.0');
    expect(get(21)).toBe('290.0');
    expect(get(50)).toBe('270.0');
  });

  it('塗り三角形は SOLID を伴う', () => {
    const d = makeDiagram([{ t: 'polyline', pts: [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 1, y: 3 }], closed: true, fill: true }]);
    const q = pairs(writeDxf(d));
    expect(q.some(([c, v]) => c === 0 && v === 'SOLID')).toBe(true);
  });

  it('全図面が例外なく出力できる', () => {
    for (const d of diagrams) {
      const t = writeDxf(d, { title: titleInfoFromMeta(p.meta, d.title, d.page, d.pageCount) });
      expect(t.endsWith('  0\r\nEOF\r\n')).toBe(true);
    }
  });
});
