import { describe, expect, it } from 'vitest';
import { DiagramBuilder } from '../src/layout/builder';
import { defaultSheet } from '../src/layout/constants';
import { alignItems, distributeItems, insertIntoWire } from '../src/state/diagramOps';
import { isPortEnd, type Diagram, type Element } from '../src/model/types';
import { isOrthogonal } from '../src/layout/router';
import { elementBBox, elementPort } from '../src/layout/builder';
import { nearestWireAt } from '../src/ui/canvas/hit';

/** 縦につないだ 2 台（LBS の下に変圧器） */
function verticalPair(): { d: Diagram; a: Element; b: Element } {
  const bd = new DiagramBuilder('d1', 'hv-sld', 'テスト', defaultSheet());
  const a = bd.el('LBS', 100, 100, { labels: ['LBS'] });
  const b = bd.el('TR_3PH', 100, 160, { labels: ['Tr'] });
  bd.wire(a, 'S', b, 'N');
  return { d: bd.build(), a, b };
}

const el = (kind: Element['kind'], x: number, y: number): Element => ({
  id: 'new1',
  kind,
  x,
  y,
  rot: 0,
  labels: [],
});

describe('配線の途中に機器を挿し込む', () => {
  it('縦の配線は N/S でつなぎ直す', () => {
    const { d, a, b } = verticalPair();
    const out = insertIntoWire(d, d.wires[0]!.id, el('PF', 100, 130));

    expect(out.elements.length).toBe(3);
    expect(out.wires.length).toBe(2);
    // 上流 LBS → 新機器 → 下流 Tr の順につながる
    const up = out.wires.find((w) => isPortEnd(w.from) && w.from.elementId === a.id)!;
    expect(isPortEnd(up.to) && up.to.elementId).toBe('new1');
    expect(isPortEnd(up.to) && up.to.portId).toBe('N');
    const down = out.wires.find((w) => isPortEnd(w.to) && w.to.elementId === b.id)!;
    expect(isPortEnd(down.from) && down.from.elementId).toBe('new1');
    expect(isPortEnd(down.from) && down.from.portId).toBe('S');
  });

  it('横の配線は W/E でつなぎ直す', () => {
    const bd = new DiagramBuilder('d2', 'hv-sld', 'テスト', defaultSheet());
    const a = bd.el('CT', 100, 100, { labels: [] });
    const b = bd.el('OCR', 160, 100, { labels: [] });
    bd.wire(a, 'E', b, 'W');
    const d = bd.build();

    const out = insertIntoWire(d, d.wires[0]!.id, el('METER_A', 130, 100));
    const up = out.wires.find((w) => isPortEnd(w.from) && w.from.elementId === a.id)!;
    expect(isPortEnd(up.to) && up.to.portId).toBe('W');
    const down = out.wires.find((w) => isPortEnd(w.to) && w.to.elementId === b.id)!;
    expect(isPortEnd(down.from) && down.from.portId).toBe('E');
  });

  it('つなぎ直した配線は直交し、ポート位置に一致する', () => {
    const { d } = verticalPair();
    const out = insertIntoWire(d, d.wires[0]!.id, el('PF', 100, 130));
    for (const w of out.wires) {
      expect(isOrthogonal(w.points)).toBe(true);
      for (const end of [w.from, w.to]) {
        if (!isPortEnd(end)) continue;
        const e = out.elements.find((x) => x.id === end.elementId)!;
        const wp = elementPort(e, end.portId).p;
        const pt = end === w.from ? w.points[0]! : w.points[w.points.length - 1]!;
        expect(pt.x).toBeCloseTo(wp.x, 6);
        expect(pt.y).toBeCloseTo(wp.y, 6);
      }
    }
    expect(out.edited).toBe(true);
  });

  it('線の上にぴったり載せる（格子に丸めない）', () => {
    const bd = new DiagramBuilder('d3', 'hv-sld', 'テスト', defaultSheet());
    // 自動縮尺のかかった図面のように、格子から外れた位置でつなぐ
    const a = bd.el('LBS', 173.522, 100, { labels: [] });
    const b = bd.el('TR_3PH', 173.522, 160, { labels: [] });
    bd.wire(a, 'S', b, 'N');
    const d = bd.build();
    // クリック位置は格子に丸められて 175 になっている
    const out = insertIntoWire(d, d.wires[0]!.id, el('PF', 175, 130));
    const pf = out.elements.find((e) => e.kind === 'PF')!;
    expect(pf.x).toBe(173.522);
    expect(pf.y).toBe(130);
    // 上下の線が真っすぐになる
    for (const w of out.wires) {
      expect(new Set(w.points.map((p) => p.x)).size).toBe(1);
    }
  });

  it('隙間が足りなければ同じ列の下流をずらして場所を空ける', () => {
    const bd = new DiagramBuilder('d4', 'hv-sld', 'テスト', defaultSheet());
    // SR と SC が接している（隙間 0）状態に、20mm の VCS を割り込ませる
    const sr = bd.el('SR', 100, 100, { labels: [] });
    const sc = bd.el('SC', 100, 120, { labels: [] });
    const gnd = bd.el('GROUND_A', 100, 140, { labels: [] });
    const other = bd.el('TR_3PH', 200, 130, { labels: [] }); // 別の列は動かさない
    bd.wire(sr, 'S', sc, 'N');
    bd.wire(sc, 'S', gnd, 'N');
    const d = bd.build();

    const out = insertIntoWire(d, d.wires[0]!.id, el('VCS', 100, 110));
    const at = (id: string) => out.elements.find((e) => e.id === id)!;
    const vcs = out.elements.find((e) => e.kind === 'VCS')!;
    // 割り込んだ機器より下だけが下がる
    expect(at(sr.id).y).toBe(100);
    expect(at(sc.id).y).toBeGreaterThan(vcs.y + 10);
    expect(at(gnd.id).y - at(sc.id).y).toBe(20); // 相対位置は保たれる
    expect(at(other.id).y).toBe(130); // 別の列はそのまま
    // 図記号どうしが重ならない
    expect(at(sc.id).y - vcs.y).toBeGreaterThanOrEqual(20);
  });

  it('隙間が足りていれば何も動かさない', () => {
    const bd = new DiagramBuilder('d5', 'hv-sld', 'テスト', defaultSheet());
    const a = bd.el('LBS', 100, 100, { labels: [] });
    const b = bd.el('TR_3PH', 100, 180, { labels: [] });
    bd.wire(a, 'S', b, 'N');
    const d = bd.build();
    const out = insertIntoWire(d, d.wires[0]!.id, el('PF', 100, 140));
    expect(out.elements.find((e) => e.id === b.id)!.y).toBe(180);
  });

  it('必要なポートが無い図記号は挿し込まない', () => {
    const { d } = verticalPair();
    // LOAD_ARROW は N しか持たないので縦の線に割り込めない
    const out = insertIntoWire(d, d.wires[0]!.id, el('LOAD_ARROW', 100, 130));
    expect(out).toBe(d);
  });

  it('存在しない配線 id なら何もしない', () => {
    const { d } = verticalPair();
    expect(insertIntoWire(d, 'nope', el('PF', 100, 130))).toBe(d);
  });
});

describe('配線の当たり判定', () => {
  it('線の近くをクリックしたときだけ拾う', () => {
    const { d } = verticalPair();
    const id = d.wires[0]!.id;
    expect(nearestWireAt(d, { x: 100, y: 130 }, 2.5)).toBe(id);
    expect(nearestWireAt(d, { x: 102, y: 130 }, 2.5)).toBe(id);
    expect(nearestWireAt(d, { x: 110, y: 130 }, 2.5)).toBeNull();
    // 線の外側（端点より上）は拾わない
    expect(nearestWireAt(d, { x: 100, y: 60 }, 2.5)).toBeNull();
  });
});

describe('整列', () => {
  /** 大きさの違う 3 台をばらばらの位置に置く */
  function scatter(): Diagram {
    const bd = new DiagramBuilder('a1', 'hv-sld', 'テスト', defaultSheet());
    bd.el('LBS', 100, 100, { labels: [], id: 'a' }); // 12 x 20
    bd.el('OCR', 130, 130, { labels: [], id: 'b' }); // 20 x 10
    bd.el('TR_3PH', 170, 160, { labels: [], id: 'c' });
    return bd.build();
  }
  const ids = new Set(['a', 'b', 'c']);
  const at = (d: Diagram, id: string) => d.elements.find((e) => e.id === id)!;
  const box = (d: Diagram, id: string) => elementBBox(at(d, id));

  it('中心線を縦にそろえる（左右中央）', () => {
    const out = alignItems(scatter(), ids, 'centerX');
    expect(new Set(out.elements.map((e) => e.x)).size).toBe(1);
    // 上下は動かさない
    expect(at(out, 'c').y).toBe(160);
  });

  it('中心線を横にそろえる（上下中央）', () => {
    const out = alignItems(scatter(), ids, 'centerY');
    expect(new Set(out.elements.map((e) => e.y)).size).toBe(1);
    expect(at(out, 'c').x).toBe(170);
  });

  it('端そろえは外形の端で合わせる（幅が違っても左端がそろう）', () => {
    const left = alignItems(scatter(), ids, 'left');
    const xs = ['a', 'b', 'c'].map((id) => box(left, id).minX);
    expect(new Set(xs.map((v) => Math.round(v * 100))).size).toBe(1);
    // 中心は幅が違うぶんずれる（＝中央そろえとは別物）
    expect(new Set(left.elements.map((e) => e.x)).size).toBeGreaterThan(1);

    const right = alignItems(scatter(), ids, 'right');
    expect(new Set(['a', 'b', 'c'].map((id) => Math.round(box(right, id).maxX * 100))).size).toBe(1);
    const top = alignItems(scatter(), ids, 'top');
    expect(new Set(['a', 'b', 'c'].map((id) => Math.round(box(top, id).minY * 100))).size).toBe(1);
    const bottom = alignItems(scatter(), ids, 'bottom');
    expect(new Set(['a', 'b', 'c'].map((id) => Math.round(box(bottom, id).maxY * 100))).size).toBe(1);
  });

  it('2 台未満では何もしない', () => {
    const d = scatter();
    expect(alignItems(d, new Set(['a']), 'centerX')).toBe(d);
  });

  it('等間隔は両端を動かさず中を均す', () => {
    const bd = new DiagramBuilder('a2', 'hv-sld', 'テスト', defaultSheet());
    bd.el('LBS', 100, 100, { labels: [], id: 'a' });
    bd.el('LBS', 110, 100, { labels: [], id: 'b' });
    bd.el('LBS', 200, 100, { labels: [], id: 'c' });
    const d = bd.build();
    const out = distributeItems(d, new Set(['a', 'b', 'c']), 'x');
    expect(out.elements.find((e) => e.id === 'a')!.x).toBe(100);
    expect(out.elements.find((e) => e.id === 'c')!.x).toBe(200);
    expect(out.elements.find((e) => e.id === 'b')!.x).toBe(150);
  });

  it('等間隔は 3 台未満では何もしない', () => {
    const d = scatter();
    expect(distributeItems(d, new Set(['a', 'b']), 'x')).toBe(d);
  });

  it('整列すると、つながっている配線も引き直される', () => {
    const bd = new DiagramBuilder('a3', 'hv-sld', 'テスト', defaultSheet());
    const a = bd.el('LBS', 100, 100, { labels: [] });
    const b2 = bd.el('TR_3PH', 130, 160, { labels: [] });
    bd.wire(a, 'S', b2, 'N');
    const d = bd.build();
    // x がずれているので配線は Z 字に折れている
    expect(new Set(d.wires[0]!.points.map((p) => p.x)).size).toBeGreaterThan(1);
    const out = alignItems(d, new Set([a.id, b2.id]), 'centerX');
    // 中心線をそろえると真っすぐになる
    expect(new Set(out.wires[0]!.points.map((p) => p.x)).size).toBe(1);
  });
});
