import { describe, expect, it } from 'vitest';
import { generateLvSld } from '../src/layout/lvSld';
import { faceRows, generateLvFace } from '../src/layout/lvFace';
import { generateLvSchedule } from '../src/layout/lvSchedule';
import { regenerateAll } from '../src/layout';
import { defaultCircuit, sampleProject } from '../src/model/defaults';
import { isOrthogonal } from '../src/layout/router';
import { sheetGeom } from '../src/layout/constants';
import type { LvPanelSpec } from '../src/model/types';

const p = sampleProject();
const l1 = p.panels[0]!;

describe('分電盤 単線結線図', () => {
  const pages = generateLvSld(l1, p.meta, p.hv.transformers);
  const d = pages[0]!.diagram;

  it('1 枚に収まり、回路数ぶんの分岐ブレーカーと負荷矢印がある', () => {
    expect(pages.length).toBe(1);
    const breakers = d.elements.filter((e) => (e.kind === 'MCB' || e.kind === 'ELB') && e.rot === 0);
    expect(breakers.length).toBe(l1.circuits.length);
    expect(d.elements.filter((e) => e.kind === 'LOAD_ARROW').length).toBe(l1.circuits.length);
    expect(pages[0]!.warnings).toEqual([]);
  });

  it('主幹は回転配置で、母線は 1 行', () => {
    const main = d.elements.find((e) => e.rot === 270);
    expect(main?.kind).toBe('ELB');
    expect(d.wires.filter((w) => w.style === 'bus').length).toBe(1);
  });

  it('配線は直交', () => {
    for (const w of d.wires) expect(isOrthogonal(w.points)).toBe(true);
  });

  it('17 回路以上で 2 行目に折り返す', () => {
    const many: LvPanelSpec = { ...l1, circuits: Array.from({ length: 20 }, (_, i) => defaultCircuit(i + 1)) };
    const rs = generateLvSld(many, p.meta, p.hv.transformers);
    expect(rs.length).toBe(1);
    const busYs = new Set(
      rs[0]!.diagram.wires.filter((w) => w.style === 'bus' && w.points[0]!.y === w.points[1]!.y).map((w) => w.points[0]!.y),
    );
    expect(busYs.size).toBe(2);
    expect(rs[0]!.warnings).toEqual([]);
  });

  it('用紙に収まらない回路は次ページへ送られ、1 回路も欠落しない', () => {
    const many: LvPanelSpec = { ...l1, circuits: Array.from({ length: 80 }, (_, i) => defaultCircuit(i + 1)) };
    const rs = generateLvSld(many, p.meta, p.hv.transformers);
    expect(rs.length).toBeGreaterThan(1);
    const drawn = rs.flatMap((r) => r.diagram.elements.filter((e) => e.kind === 'LOAD_ARROW').length).reduce((a, b) => a + b, 0);
    expect(drawn).toBe(80);
    expect(rs[0]!.warnings.some((w) => w.includes('分割'))).toBe(true);
    expect(new Set(rs.map((r) => r.diagram.id)).size).toBe(rs.length);
    expect(rs[0]!.diagram.pageCount).toBe(rs.length);
    // 2 枚目以降は主幹を描かない
    expect(rs[1]!.diagram.elements.some((e) => e.rot === 270)).toBe(false);
    expect(rs[1]!.diagram.texts.some((t) => t.text.includes('続き'))).toBe(true);
  });

  it('A4 でも回路が欠落しない', () => {
    const meta = { ...p.meta, sheet: { ...p.meta.sheet, size: 'A4' as const } };
    const rs = generateLvSld(l1, meta, p.hv.transformers);
    const drawn = rs.reduce((s, r) => s + r.diagram.elements.filter((e) => e.kind === 'LOAD_ARROW').length, 0);
    expect(drawn).toBe(l1.circuits.length);
  });

  it('回路ラベルに No と負荷名が含まれる', () => {
    const texts = d.texts.map((t) => t.text);
    expect(texts).toContain('No.1');
    expect(texts.some((t) => t.includes('事務室'))).toBe(true);
  });
});

describe('盤面配置図', () => {
  it('奇数上段・偶数下段に振り分ける', () => {
    const rows = faceRows(l1);
    expect(rows.length).toBe(2);
    expect(rows[0]!.every((c) => c.no % 2 === 1)).toBe(true);
    expect(rows[1]!.every((c) => c.no % 2 === 0)).toBe(true);
    expect(rows[0]!.map((c) => c.no)).toEqual([...rows[0]!.map((c) => c.no)].sort((a, b) => a - b));
  });

  it('1 行指定では全回路が 1 行', () => {
    const rows = faceRows({ ...l1, face: { rows: 1, order: 'sequential' } });
    expect(rows.length).toBe(1);
    expect(rows[0]!.length).toBe(l1.circuits.length);
  });

  it('極数に応じたブロックが生成され、用紙に収まる', () => {
    const { diagram: d, warnings } = generateLvFace(l1, p.meta);
    const b1 = d.elements.filter((e) => e.kind === 'FACE_BR_1P').length;
    const b2 = d.elements.filter((e) => e.kind === 'FACE_BR_2P').length;
    expect(b1).toBe(l1.circuits.filter((c) => c.poles === '1P').length);
    expect(b2).toBe(l1.circuits.filter((c) => c.poles === '2P').length);
    expect(d.elements.filter((e) => e.kind === 'FACE_MAIN').length).toBe(1);
    expect(warnings).toEqual([]);
    const g = sheetGeom(d.sheet);
    for (const e of d.elements) expect(e.x).toBeLessThanOrEqual(g.drawable.x2);
  });

  it('A3 / A4 とも盤外形が描画領域（表題欄の外）に収まる', () => {
    for (const size of ['A3', 'A4'] as const) {
      const meta = { ...p.meta, sheet: { ...p.meta.sheet, size } };
      for (const panel of p.panels) {
        const { diagram: d, warnings } = generateLvFace(panel, meta);
        const g = sheetGeom(d.sheet);
        const ys: number[] = [];
        const xs: number[] = [];
        for (const s of d.shapes) {
          if (s.t === 'polyline') for (const q of s.pts) { ys.push(q.y); xs.push(q.x); }
        }
        expect(Math.max(...ys), `${panel.name} ${size} の盤外形が描画領域を超える`).toBeLessThanOrEqual(g.drawable.y2);
        expect(Math.max(...xs)).toBeLessThanOrEqual(g.drawable.x2);
        expect(Math.min(...ys)).toBeGreaterThanOrEqual(g.drawable.y1);
        expect(warnings).toEqual([]);
      }
    }
  });

  it('上段の負荷名と下段の回路番号が重ならない', () => {
    for (const size of ['A3', 'A4'] as const) {
      const meta = { ...p.meta, sheet: { ...p.meta.sheet, size } };
      const { diagram: d } = generateLvFace(l1, meta);
      const blocks = d.elements.filter((e) => e.kind.startsWith('FACE_BR'));
      const rowYs = [...new Set(blocks.map((e) => e.y))].sort((a, b) => a - b);
      expect(rowYs.length).toBe(2);
      const [top, bottom] = rowYs as [number, number];
      // 下段の回路番号（ブロック上 23mm）の上端
      const numberTop = bottom - 23 - 2.5 / 2;
      // 上段ブロックより下にあるテキスト（AT 値と負荷名）の下端
      const upperBottom = Math.max(
        ...d.texts.filter((t) => t.y > top && t.y < numberTop).map((t) => t.y + t.h / 2),
      );
      expect(upperBottom, `${size}: 上段の負荷名が下段の回路番号に接触`).toBeLessThan(numberTop);
    }
  });

  it('同一行のブロックは重ならない', () => {
    const { diagram: d } = generateLvFace(l1, p.meta);
    const blocks = d.elements.filter((e) => e.kind.startsWith('FACE_BR'));
    const byY = new Map<number, typeof blocks>();
    for (const b of blocks) byY.set(b.y, [...(byY.get(b.y) ?? []), b]);
    for (const row of byY.values()) {
      const sorted = [...row].sort((a, b) => a.x - b.x);
      for (let i = 1; i < sorted.length; i++) {
        const a = sorted[i - 1]!;
        const b = sorted[i]!;
        const aw = a.kind === 'FACE_BR_1P' ? 9 : a.kind === 'FACE_BR_2P' ? 18 : 27;
        const bw = b.kind === 'FACE_BR_1P' ? 9 : b.kind === 'FACE_BR_2P' ? 18 : 27;
        expect(b.x - bw / 2).toBeGreaterThanOrEqual(a.x + aw / 2);
      }
    }
  });
});

describe('回路表', () => {
  it('1 ページに回路数ぶんの行がある', () => {
    const rs = generateLvSchedule(l1, p.meta, p.hv.transformers);
    expect(rs.length).toBe(1);
    const d = rs[0]!.diagram;
    expect(d.texts.filter((t) => /^No\.|^\d+$/.test(t.text) && t.h === 2.5).length).toBeGreaterThanOrEqual(l1.circuits.length);
    expect(d.texts.some((t) => t.text.startsWith('合計負荷容量'))).toBe(true);
    expect(d.texts.some((t) => t.text.includes('L1-N'))).toBe(true);
  });

  it('列幅の合計は用紙幅に収まる', () => {
    const meta = { ...p.meta, sheet: { ...p.meta.sheet, size: 'A4' as const } };
    const d = generateLvSchedule(l1, meta, p.hv.transformers)[0]!.diagram;
    const g = sheetGeom(d.sheet);
    for (const s of d.shapes) {
      if (s.t === 'polyline') for (const q of s.pts) expect(q.x).toBeLessThanOrEqual(g.drawable.x2 + 0.01);
    }
  });

  it('行数が多いと複数ページになる', () => {
    const many: LvPanelSpec = { ...l1, circuits: Array.from({ length: 60 }, (_, i) => defaultCircuit(i + 1)) };
    const rs = generateLvSchedule(many, p.meta, p.hv.transformers);
    expect(rs.length).toBeGreaterThan(1);
    expect(rs[0]!.diagram.page).toBe(1);
    expect(rs[0]!.diagram.pageCount).toBe(rs.length);
    expect(new Set(rs.map((r) => r.diagram.id)).size).toBe(rs.length);
  });
});

describe('regenerateAll', () => {
  it('高圧 1 + 分電盤ごとに 3 図面 + 銘板表', () => {
    const r = regenerateAll(p);
    expect(r.diagrams.length).toBe(1 + p.panels.length * 3 + 1);
    expect(r.diagrams.filter((d) => d.kind === 'nameplate').length).toBe(1);
    expect(new Set(r.diagrams.map((d) => d.id)).size).toBe(r.diagrams.length);
    // 縮尺の案内以外の警告は出さない
    expect(r.warnings.filter((w) => !w.includes('縮尺'))).toEqual([]);
  });
});
