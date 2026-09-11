import { describe, expect, it } from 'vitest';
import { initialState, reducer, restoreProject } from '../src/state/reducer';
import { regenerateAll } from '../src/layout';
import { createBlankProject, sampleProject } from '../src/model/defaults';
import { nameplateRows } from '../src/model/nameplateRows';
import type { AppState } from '../src/state/reducer';
import type { Diagram, Project } from '../src/model/types';

const present = (s: AppState) => s.history.present;
const kinds = (p: Project): string[] => p.diagrams.map((d) => d.kind);
const textOf = (d: Diagram): string => d.texts.map((t) => t.text).join('\n');

/** ツールバーの「白紙から」= 白紙プロジェクトを読み込む */
function blank(): AppState {
  return reducer(initialState(sampleProject()), { type: 'LOAD_PROJECT', project: createBlankProject() });
}

/** サンプル仕様 + 図面 1 式で、自動作図だけ切った状態 */
function specOff(): AppState {
  const p = sampleProject();
  const off: Project = { ...p, meta: { ...p.meta, autoGenerate: false }, diagrams: regenerateAll(p).diagrams };
  return initialState(off);
}

describe('仕様を使わず 1 から描く', () => {
  it('白紙から始めると、仕様の図面を作らず白紙 1 枚だけになる', () => {
    const p = present(blank());
    expect(p.meta.autoGenerate).toBe(false);
    expect(kinds(p)).toEqual(['free']);
    expect(p.panels).toEqual([]);
    expect(p.hv.enabled).toBe(false);
  });

  it('図面に置いた機器の銘板から機器銘板表を作る', () => {
    let s = blank();
    const id = present(s).diagrams[0]!.id;
    s = reducer(s, {
      type: 'ADD_ELEMENT',
      diagramId: id,
      element: { id: 'e1', kind: 'VCB', x: 100, y: 100, rot: 0, labels: ['VCB'] },
    });
    s = reducer(s, {
      type: 'UPDATE_ELEMENT',
      diagramId: id,
      id: 'e1',
      patch: {
        nameplateName: '真空遮断器',
        nameplate: { model: 'VF-6', maker: 'テスト電機', madeOn: '2026-04', serial: 'No.12', qty: 2 },
      },
    });
    // 銘板を入力すると「要更新」が付き、「銘板表を更新」で表になる
    expect(present(s).diagrams.find((d) => d.kind === 'nameplate')).toBeUndefined();
    s = reducer(s, { type: 'REGENERATE' });
    const table = present(s).diagrams.find((d) => d.kind === 'nameplate')!;
    const t = textOf(table);
    expect(t).toContain('真空遮断器');
    expect(t).toContain('VF-6');
    expect(t).toContain('テスト電機');
    expect(t).toContain('No.12');
    expect(t).toContain('全 2 台');
    // 単線結線図は作られない
    expect(kinds(present(s))).toEqual(['free', 'nameplate']);
  });

  it('銘板を消すと、その機器は表から落ちる', () => {
    let s = blank();
    const id = present(s).diagrams[0]!.id;
    s = reducer(s, {
      type: 'ADD_ELEMENT',
      diagramId: id,
      element: { id: 'e1', kind: 'VCB', x: 100, y: 100, rot: 0, labels: ['VCB'], nameplate: { model: 'VF-6' } },
    });
    s = reducer(s, { type: 'REGENERATE' });
    expect(textOf(present(s).diagrams.find((d) => d.kind === 'nameplate')!)).toContain('VF-6');
    s = reducer(s, { type: 'DELETE_ITEMS', diagramId: id, ids: ['e1'] });
    s = reducer(s, { type: 'REGENERATE' });
    expect(textOf(present(s).diagrams.find((d) => d.kind === 'nameplate')!)).not.toContain('VF-6');
  });

  it('図記号を置いたままの既定ラベルは定格容量の欄に出さない', () => {
    const p0 = present(blank());
    const el = (labels: string[]) => ({
      id: 'e1',
      kind: 'VCB' as const,
      x: 100,
      y: 100,
      rot: 0 as const,
      labels,
      nameplate: { model: 'VF-6' },
    });
    const withLabels = (labels: string[]): Project => ({
      ...p0,
      diagrams: p0.diagrams.map((d) => ({ ...d, elements: [el(labels)] })),
    });
    // パレットから置いただけの「VCB」は機器名なので定格にしない
    expect(nameplateRows(withLabels(['VCB']))[0]!.ratingText).toBe('');
    // 自分で書いたラベルは定格として使う
    expect(nameplateRows(withLabels(['VCB 600A 12.5kA']))[0]!.ratingText).toBe('VCB 600A 12.5kA');
  });
});

describe('図面を削除できる', () => {
  it('自動作図を切っていれば、仕様から作った図面も消せて戻ってこない', () => {
    let s = specOff();
    const hv = present(s).diagrams.find((d) => d.kind === 'hv-sld')!;
    s = reducer(s, { type: 'REMOVE_DIAGRAM', diagramId: hv.id });
    expect(present(s).diagrams.some((d) => d.id === hv.id)).toBe(false);
    // 銘板表を更新しても戻らない
    s = reducer(s, { type: 'REGENERATE' });
    expect(present(s).diagrams.some((d) => d.id === hv.id)).toBe(false);
    // 保存 → 開き直しでも戻らない
    const opened = present(reducer(s, { type: 'LOAD_PROJECT', project: present(s) }));
    expect(opened.diagrams.some((d) => d.id === hv.id)).toBe(false);
    // 自動保存からの復元でも戻らない
    expect(restoreProject(present(s)).project.diagrams.some((d) => d.id === hv.id)).toBe(false);
  });

  it('自動作図が入っていれば、消した仕様の図面は作り直しで戻る', () => {
    const p = sampleProject();
    let s = initialState({ ...p, diagrams: regenerateAll(p).diagrams });
    const hv = present(s).diagrams.find((d) => d.kind === 'hv-sld')!;
    s = reducer(s, { type: 'REMOVE_DIAGRAM', diagramId: hv.id });
    expect(present(s).diagrams.some((d) => d.id === hv.id)).toBe(false);
    s = reducer(s, { type: 'REGENERATE' });
    expect(present(s).diagrams.some((d) => d.id === hv.id)).toBe(true);
  });

  it('手描きの図面を消すと、開き直しても消えたまま', () => {
    let s = blank();
    const id = present(s).diagrams[0]!.id;
    s = reducer(s, { type: 'REMOVE_DIAGRAM', diagramId: id });
    expect(present(s).diagrams).toEqual([]);
    expect(restoreProject(present(s)).project.diagrams).toEqual([]);
  });
});
