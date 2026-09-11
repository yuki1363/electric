// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { PropertiesPanel } from '../src/ui/panels/PropertiesPanel';
import { DispatchContext } from '../src/state/context';
import { copyItems } from '../src/state/diagramOps';
import { regenerateAll } from '../src/layout';
import { sampleProject } from '../src/model/defaults';
import type { Diagram } from '../src/model/types';

// globals を使わない設定なので、描画の後片付けは自分でする
afterEach(cleanup);

const hv = (): Diagram => regenerateAll(sampleProject()).diagrams.find((d) => d.kind === 'hv-sld')!;

function show(diagram: Diagram, selection: string[], clipboard = null as ReturnType<typeof copyItems>) {
  const dispatch = vi.fn();
  const onClipboardChange = vi.fn();
  render(
    <DispatchContext.Provider value={dispatch}>
      <PropertiesPanel
        diagram={diagram}
        selection={selection}
        onSelectionChange={() => {}}
        clipboard={clipboard}
        onClipboardChange={onClipboardChange}
        snapStep={1}
      />
    </DispatchContext.Provider>,
  );
  return { dispatch, onClipboardChange };
}

describe('図面上の図記号をコピーする', () => {
  it('1 つ選ぶと 複製・コピー・削除 のボタンが出る', () => {
    const d = hv();
    const { dispatch, onClipboardChange } = show(d, [d.elements[3]!.id]);
    for (const name of ['複製', 'コピー', '削除']) expect(screen.getByRole('button', { name })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '複製' }));
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'DUPLICATE_ITEMS', ids: [d.elements[3]!.id] }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'コピー' }));
    const clip = onClipboardChange.mock.calls[0]![0]!;
    expect(clip.elements).toHaveLength(1);
  });

  it('複数選ぶとまとめてコピーできる', () => {
    const d = hv();
    const ids = d.elements.slice(0, 3).map((e) => e.id);
    const { dispatch, onClipboardChange } = show(d, ids);
    expect(screen.getByText('3 項目を選択中')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'コピー' }));
    expect(onClipboardChange.mock.calls[0]![0]!.elements).toHaveLength(3);

    fireEvent.click(screen.getByRole('button', { name: '複製' }));
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'DUPLICATE_ITEMS', ids }));
  });

  it('コピーしたものは、何も選んでいなくても貼り付けられる', () => {
    const d = hv();
    const clip = copyItems(d, new Set(d.elements.slice(0, 2).map((e) => e.id)))!;
    const { dispatch } = show(d, [], clip);
    const btn = screen.getByRole('button', { name: `貼り付け（${clip.elements.length + clip.wires.length + clip.texts.length}）` });
    fireEvent.click(btn);
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'PASTE_ITEMS', clip }));
  });

  it('コピーしていないときは貼り付けボタンを出さない', () => {
    const d = hv();
    show(d, []);
    expect(screen.queryByRole('button', { name: /貼り付け/ })).toBeNull();
  });
});
