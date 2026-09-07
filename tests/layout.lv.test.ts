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
  const { diagram: d, warnings } = generateLvSld(l1, p.meta, p.hv.transformers);

  it('回路数ぶんの分岐ブレーカーと負荷矢印がある', () => {
    const breakers = d.elements.filter((e) => (e.kind === 'MCB' || e.kind === 'ELB') && e.rot === 0);
    expect(breakers.length).toBe(l1.circuits.length);
    expect(d.elements.filter((e) => e.kind === 'LOAD_ARROW').length).toBe(l1.circuits.length);
    expect(warnings).toEqual([]);
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
    const r = generateLvSld(many, p.meta, p.hv.transformers);
    const busYs = new Set(r.diagram.wires.filter((w) => w.style === 'bus' && w.points[0]!.y === w.points[1]!.y).map((w) => w.points[0]!.y));
    expect(busYs.size).toBe(2);
    expect(r.warnings).toEqual([]);
  });

  it('回路数が上限を超えると警告', () => {
    const many: LvPanelSpec = { ...l1, circuits: Array.from({ length: 40 }, (_, i) => defaultCircuit(i + 1)) };
    const r = generateLvSld(many, p.meta, p.hv.transformers);
    expect(r.warnings.length).toBeGreaterThan(0);
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
  it('高圧 1 + 分電盤ごとに 3 図面', () => {
    const r = regenerateAll(p);
    expect(r.diagrams.length).toBe(1 + p.panels.length * 3);
    expect(new Set(r.diagrams.map((d) => d.id)).size).toBe(r.diagrams.length);
    expect(r.warnings).toEqual([]);
  });
});
