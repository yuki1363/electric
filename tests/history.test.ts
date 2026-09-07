import { describe, expect, it } from 'vitest';
import { MAX_HISTORY, canRedo, canUndo, createHistory, push, redo, replace, undo } from '../src/state/history';
import { initialState, reducer } from '../src/state/reducer';
import { regenerateAll } from '../src/layout';
import { sampleProject } from '../src/model/defaults';

describe('履歴', () => {
  it('push / undo / redo', () => {
    let h = createHistory(0);
    h = push(h, 1);
    h = push(h, 2);
    expect(h.present).toBe(2);
    expect(canUndo(h)).toBe(true);
    h = undo(h);
    expect(h.present).toBe(1);
    expect(canRedo(h)).toBe(true);
    h = redo(h);
    expect(h.present).toBe(2);
    expect(canRedo(h)).toBe(false);
  });

  it('push で future は破棄される', () => {
    let h = push(push(createHistory(0), 1), 2);
    h = undo(h);
    h = push(h, 9);
    expect(h.future).toEqual([]);
    expect(h.past).toEqual([0, 1]);
  });

  it('replace は履歴に積まない', () => {
    const h = replace(createHistory(0), 5);
    expect(h.present).toBe(5);
    expect(h.past).toEqual([]);
  });

  it('上限を超えると古い履歴を捨てる', () => {
    let h = createHistory(0);
    for (let i = 1; i <= MAX_HISTORY + 20; i++) h = push(h, i);
    expect(h.past.length).toBe(MAX_HISTORY);
    expect(h.past[0]).toBe(20);
  });
});

describe('reducer', () => {
  const project = sampleProject();
  project.diagrams = regenerateAll(project).diagrams;
  const s0 = initialState(project);
  const hv = project.diagrams[0]!;
  const el = hv.elements.find((e) => e.kind === 'VCB')!;

  it('MOVE_PREVIEW は履歴に積まず、COMMIT_PREVIEW で 1 手として積む', () => {
    let s = reducer(s0, { type: 'MOVE_PREVIEW', diagramId: hv.id, ids: [el.id], dx: 5, dy: 0 });
    s = reducer(s, { type: 'MOVE_PREVIEW', diagramId: hv.id, ids: [el.id], dx: 10, dy: 0 });
    expect(s.history.past.length).toBe(0);
    const moved = s.history.present.diagrams[0]!.elements.find((e) => e.id === el.id)!;
    expect(moved.x).toBe(el.x + 10); // 開始位置からの累積
    s = reducer(s, { type: 'COMMIT_PREVIEW' });
    expect(s.history.past.length).toBe(1);
    expect(s.previewBase).toBeNull();
    s = reducer(s, { type: 'UNDO' });
    expect(s.history.present.diagrams[0]!.elements.find((e) => e.id === el.id)!.x).toBe(el.x);
  });

  it('要素移動で接続配線が追従する', () => {
    const s = reducer(s0, { type: 'UPDATE_ELEMENT', diagramId: hv.id, id: el.id, patch: { x: el.x + 20 } });
    const d = s.history.present.diagrams[0]!;
    const w = d.wires.find((w) => 'elementId' in w.to && w.to.elementId === el.id)!;
    expect(w.points[w.points.length - 1]!.x).toBe(el.x + 20);
    expect(d.edited).toBe(true);
  });

  it('削除で接続配線も消える', () => {
    const before = hv.wires.length;
    const s = reducer(s0, { type: 'DELETE_ITEMS', diagramId: hv.id, ids: [el.id] });
    const d = s.history.present.diagrams[0]!;
    expect(d.elements.some((e) => e.id === el.id)).toBe(false);
    expect(d.wires.length).toBe(before - 2);
  });

  it('仕様変更で図面が stale になり、再生成で解消。編集済みは keepEdited で保持', () => {
    let s = reducer(s0, { type: 'UPDATE_ELEMENT', diagramId: hv.id, id: el.id, patch: { x: el.x + 5 } });
    s = reducer(s, { type: 'SET_META', meta: { author: 'テスト' } });
    expect(s.history.present.diagrams.every((d) => d.stale)).toBe(true);
    const kept = reducer(s, { type: 'REGENERATE', keepEdited: true });
    expect(kept.history.present.diagrams[0]!.edited).toBe(true);
    const fresh = reducer(s, { type: 'REGENERATE', keepEdited: false });
    expect(fresh.history.present.diagrams[0]!.edited).toBe(false);
    expect(fresh.history.present.diagrams[0]!.stale).toBeUndefined();
  });
});
