// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { NumberField, TextField } from '../src/ui/fields';

/**
 * タブや画面を切り替えると、入力欄にフォーカスが残ったまま外れて blur が起きない。
 * その場合でも打った内容が捨てられないこと。
 */
describe('入力欄の確定', () => {
  it('TextField: blur せずに外れても確定する', () => {
    const onCommit = vi.fn();
    const { unmount } = render(<TextField value="CVT" onCommit={onCommit} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'CV' } });
    expect(onCommit).not.toHaveBeenCalled();
    unmount();
    expect(onCommit).toHaveBeenCalledExactlyOnceWith('CV');
  });

  it('TextField: 値が変わっていなければ確定しない', () => {
    const onCommit = vi.fn();
    const { unmount } = render(<TextField value="CVT" onCommit={onCommit} />);
    unmount();
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('TextField: blur で確定した後に外れても二重に確定しない', () => {
    const onCommit = vi.fn();
    const { unmount, rerender } = render(<TextField value="CVT" onCommit={onCommit} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'CV' } });
    fireEvent.blur(input);
    rerender(<TextField value="CV" onCommit={onCommit} />); // 親が新しい値で描き直す
    unmount();
    expect(onCommit).toHaveBeenCalledExactlyOnceWith('CV');
  });

  it('NumberField: blur せずに外れても確定する', () => {
    const onCommit = vi.fn();
    const { unmount } = render(<NumberField value={38} onCommit={onCommit} />);
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '60' } });
    unmount();
    expect(onCommit).toHaveBeenCalledExactlyOnceWith(60);
  });

  it('NumberField: 空欄は allowEmpty のときだけ未入力として確定する', () => {
    const a = vi.fn();
    const r1 = render(<NumberField value={250} allowEmpty onCommit={a} />);
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '' } });
    r1.unmount();
    expect(a).toHaveBeenCalledExactlyOnceWith(undefined);

    const bfn = vi.fn();
    const r2 = render(<NumberField value={38} onCommit={bfn} />);
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '' } });
    r2.unmount();
    expect(bfn).not.toHaveBeenCalled();
  });

  it('NumberField: 数値にならない入力は捨てる', () => {
    const onCommit = vi.fn();
    const { unmount } = render(<NumberField value={38} onCommit={onCommit} />);
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: 'e' } });
    unmount();
    expect(onCommit).not.toHaveBeenCalled();
  });
});
