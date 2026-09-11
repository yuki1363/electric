import { describe, expect, it } from 'vitest';
import { initialState, reducer } from '../src/state/reducer';
import { regenerateAll } from '../src/layout';
import { sampleProject } from '../src/model/defaults';
import { elementPorts } from '../src/layout/builder';
import { itemScale } from '../src/state/diagramOps';
import { bboxOfPrims } from '../src/geom/bbox';
import { elementPrims } from '../src/render/flatten';
import type { AppState } from '../src/state/reducer';
import type { Diagram, Element, Project } from '../src/model/types';

const present = (s: AppState) => s.history.present;
const hvOf = (p: Project): Diagram => p.diagrams.find((d) => d.kind === 'hv-sld')!;
const elOf = (d: Diagram, id: string): Element => d.elements.find((e) => e.id === id)!;
const widthOf = (el: Element): number => {
  const b = bboxOfPrims(elementPrims(el));
  return b.maxX - b.minX;
};

function seeded(): { state: AppState; id: string; elId: string } {
  const p = sampleProject();
  const s = initialState({ ...p, diagrams: regenerateAll(p).diagrams });
  const d = hvOf(present(s));
  return { state: s, id: d.id, elId: d.elements.find((e) => e.kind === 'VCB')!.id };
}

describe('図記号の拡大縮小', () => {
  it('＋ で大きく、－ で小さくなり、等倍に戻せる', () => {
    const { state, id, elId } = seeded();
    const d0 = hvOf(present(state));
    const w0 = widthOf(elOf(d0, elId));

    let s = reducer(state, { type: 'SCALE_ITEMS', diagramId: id, ids: [elId], mul: 1.25 });
    const big = elOf(hvOf(present(s)), elId);
    expect(itemScale(hvOf(present(s)), big)).toBeCloseTo(1.25, 3);
    expect(widthOf(big)).toBeCloseTo(w0 * 1.25, 3);

    s = reducer(s, { type: 'SCALE_ITEMS', diagramId: id, ids: [elId], mul: 1 / 1.25 });
    expect(itemScale(hvOf(present(s)), elOf(hvOf(present(s)), elId))).toBeCloseTo(1, 3);

    s = reducer(s, { type: 'SET_ITEM_SCALE', diagramId: id, ids: [elId], scale: 2 });
    expect(widthOf(elOf(hvOf(present(s)), elId))).toBeCloseTo(w0 * 2, 3);
    s = reducer(s, { type: 'SET_ITEM_SCALE', diagramId: id, ids: [elId], scale: 1 });
    expect(widthOf(elOf(hvOf(present(s)), elId))).toBeCloseTo(w0, 3);
  });

  it('大きさを変えると、つながった配線が新しい端子位置に引き直される', () => {
    const { state, id, elId } = seeded();
    const s = reducer(state, { type: 'SET_ITEM_SCALE', diagramId: id, ids: [elId], scale: 2 });
    const d = hvOf(present(s));
    const el = elOf(d, elId);
    for (const w of d.wires) {
      for (const [end, pt] of [
        [w.from, w.points[0]!],
        [w.to, w.points[w.points.length - 1]!],
      ] as const) {
        if (!('elementId' in end) || end.elementId !== elId) continue;
        const port = elementPorts(el).find((p) => p.id === end.portId)!;
        expect(pt.x).toBeCloseTo(port.p.x, 3);
        expect(pt.y).toBeCloseTo(port.p.y, 3);
      }
    }
  });

  it('行きすぎた倍率は 25%〜400% で止める', () => {
    const { state, id, elId } = seeded();
    let s = reducer(state, { type: 'SET_ITEM_SCALE', diagramId: id, ids: [elId], scale: 99 });
    expect(itemScale(hvOf(present(s)), elOf(hvOf(present(s)), elId))).toBeCloseTo(4, 3);
    s = reducer(s, { type: 'SET_ITEM_SCALE', diagramId: id, ids: [elId], scale: 0.01 });
    expect(itemScale(hvOf(present(s)), elOf(hvOf(present(s)), elId))).toBeCloseTo(0.25, 3);
  });

  it('複数選んでまとめて変えられる', () => {
    const { state, id } = seeded();
    const ids = hvOf(present(state)).elements.slice(0, 3).map((e) => e.id);
    const s = reducer(state, { type: 'SCALE_ITEMS', diagramId: id, ids, mul: 1.25 });
    const d = hvOf(present(s));
    for (const i of ids) expect(itemScale(d, elOf(d, i))).toBeCloseTo(1.25, 3);
  });

  it('手で変えた大きさは図面を作り直しても残る', () => {
    const { state, id, elId } = seeded();
    let s = reducer(state, { type: 'SET_ITEM_SCALE', diagramId: id, ids: [elId], scale: 1.5 });
    s = reducer(s, { type: 'REGENERATE' });
    const d = hvOf(present(s));
    expect(itemScale(d, elOf(d, elId))).toBeCloseTo(1.5, 2);
    // 触っていない機器は等倍のまま
    const other = d.elements.find((e) => e.id !== elId && e.kind === 'CT')!;
    expect(itemScale(d, other)).toBeCloseTo(1, 2);
  });
});
