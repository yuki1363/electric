import { describe, expect, it } from 'vitest';
import { regenerateAll } from '../src/layout';
import { initialState, reducer } from '../src/state/reducer';
import { sampleProject } from '../src/model/defaults';
import type { AppState } from '../src/state/reducer';
import type { Diagram, Element, Project } from '../src/model/types';
import { isPortEnd } from '../src/model/types';

/** サンプル仕様 + 図面 1 式 */
function seeded(): Project {
  const p = sampleProject();
  return { ...p, diagrams: regenerateAll(p).diagrams };
}

const hvOf = (p: Project): Diagram => p.diagrams.find((d) => d.kind === 'hv-sld')!;
const present = (s: AppState) => s.history.present;

/** 図面に機器 1 台・配線 1 本・文字 1 つを手で足した状態を作る */
function withHandWork(p0: Project): { state: AppState; hvId: string } {
  const hv = hvOf(p0);
  // CT は E ポートを持つ（計器回路に出せる）ので、手描き配線の相手に使う
  const anchor = hv.elements.find((e) => e.kind === 'CT')!;
  const el: Element = { id: 'hand1', kind: 'OCR', x: anchor.x + 60, y: anchor.y, rot: 0, labels: ['手で足した OCR'] };
  let s = initialState(p0);
  s = reducer(s, { type: 'ADD_ELEMENT', diagramId: hv.id, element: el });
  s = reducer(s, {
    type: 'ADD_WIRE',
    diagramId: hv.id,
    wire: {
      id: 'handw1',
      from: { elementId: anchor.id, portId: 'E' },
      to: { elementId: 'hand1', portId: 'W' },
      points: [],
      manual: false,
      style: 'normal',
    },
  });
  s = reducer(s, {
    type: 'ADD_TEXT',
    diagramId: hv.id,
    text: { id: 'handt1', x: anchor.x + 60, y: anchor.y + 12, text: '手書きの注記', h: 3.5, anchor: 'start' },
  });
  return { state: s, hvId: hv.id };
}

describe('図面を作り直しても手作業が残る', () => {
  it('手で足した機器・配線・文字が残る', () => {
    const { state } = withHandWork(seeded());
    const after = hvOf(present(reducer(state, { type: 'REGENERATE' })));
    expect(after.elements.some((e) => e.id === 'hand1')).toBe(true);
    expect(after.wires.some((w) => w.id === 'handw1')).toBe(true);
    expect(after.texts.some((t) => t.text === '手書きの注記')).toBe(true);
    expect(after.edited).toBe(true);
  });

  it('仕様を変えても手作業は残り、自動作図は仕様どおりに引き直される', () => {
    const { state } = withHandWork(seeded());
    const p = present(state);
    // 変圧器を 1 台足す = 自動作図の中身が変わる
    const s = reducer(state, {
      type: 'SET_HV',
      hv: {
        ...p.hv,
        transformers: [
          ...p.hv.transformers,
          { id: 'tr-new', name: 'Tr-新', phase: '3φ', kva: 50, secondary: '210V', devices: ['LBS', 'PF'], pfA: 30 },
        ],
      },
    });
    const after = hvOf(present(reducer(s, { type: 'REGENERATE' })));
    expect(after.elements.some((e) => e.labels.includes('Tr-新'))).toBe(true);
    expect(after.elements.some((e) => e.id === 'hand1')).toBe(true);
    expect(after.stale).toBeUndefined();
  });

  it('手で足した機器が用紙の外へ飛ばない', () => {
    const { state } = withHandWork(seeded());
    const after = hvOf(present(reducer(state, { type: 'REGENERATE' })));
    const hand = after.elements.find((e) => e.id === 'hand1')!;
    expect(hand.x).toBeGreaterThan(0);
    expect(hand.x).toBeLessThan(420);
    expect(hand.y).toBeGreaterThan(0);
    expect(hand.y).toBeLessThan(297);
    // 縮尺がかかっていれば手動機器にも同じ倍率が乗る
    expect(hand.scale).toBeCloseTo(after.scale ?? 1, 3);
  });

  it('手で足した配線は相手の新しいポート位置につながり直す', () => {
    const { state } = withHandWork(seeded());
    const after = hvOf(present(reducer(state, { type: 'REGENERATE' })));
    const w = after.wires.find((x) => x.id === 'handw1')!;
    expect(isPortEnd(w.to)).toBe(true);
    const hand = after.elements.find((e) => e.id === 'hand1')!;
    const last = w.points[w.points.length - 1]!;
    expect(Math.abs(last.x - hand.x)).toBeLessThan(20);
    expect(Math.abs(last.y - hand.y)).toBeLessThan(20);
  });

  it('自動作図した機器に入れた銘板とラベル位置は残る', () => {
    const p0 = seeded();
    const hv = hvOf(p0);
    const vcb = hv.elements.find((e) => e.kind === 'VCB')!;
    let s = initialState(p0);
    s = reducer(s, {
      type: 'UPDATE_ELEMENT',
      diagramId: hv.id,
      id: vcb.id,
      patch: { nameplate: { maker: '富士電機' }, labelOffset: { x: 3, y: -4 } },
    });
    const after = hvOf(present(reducer(s, { type: 'REGENERATE' })));
    const kept = after.elements.find((e) => e.id === vcb.id)!;
    expect(kept.nameplate?.maker).toBe('富士電機');
    expect(kept.labelOffset).toBeTruthy();
  });

  it('自動作図した機器を動かしただけなら仕様どおりに戻る', () => {
    const p0 = seeded();
    const hv = hvOf(p0);
    const vcb = hv.elements.find((e) => e.kind === 'VCB')!;
    let s = initialState(p0);
    s = reducer(s, { type: 'UPDATE_ELEMENT', diagramId: hv.id, id: vcb.id, patch: { x: vcb.x + 25 } });
    const after = hvOf(present(reducer(s, { type: 'REGENERATE' })));
    expect(after.elements.find((e) => e.id === vcb.id)!.x).toBe(vcb.x);
    expect(after.edited).toBe(false);
  });

  it('つなぎ先が消えた手動配線は端を座標で止めて警告する', () => {
    const { state, hvId } = withHandWork(seeded());
    // 手動機器だけ消す = 配線の片端が行き先を失う
    const p = present(state);
    const broken: Project = {
      ...p,
      diagrams: p.diagrams.map((d) =>
        d.id === hvId ? { ...d, elements: d.elements.filter((e) => e.id !== 'hand1') } : d,
      ),
    };
    const r = regenerateAll(broken);
    const w = r.diagrams.find((d) => d.id === hvId)!.wires.find((x) => x.id === 'handw1')!;
    expect(isPortEnd(w.to)).toBe(false);
    expect(r.warnings.some((x) => x.includes('つなぎ先が無くなった'))).toBe(true);
  });
});
