import { useEffect, useRef, useState, type ReactNode } from 'react';

/** blur / Enter で確定するテキスト入力（履歴を1手にまとめる） */
export function TextField({
  value,
  onCommit,
  placeholder,
  className,
  width,
  list,
}: {
  value: string;
  onCommit: (v: string) => void;
  placeholder?: string;
  className?: string;
  width?: number | string;
  /** datalist の id（入力候補） */
  list?: string;
}) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  const commit = () => {
    if (v !== value) onCommit(v);
  };
  // タブや画面を切り替えると blur が起きないまま外れることがあるので、
  // アンマウント時にも未確定の入力を確定する
  const latest = useRef({ v, value, onCommit });
  latest.current = { v, value, onCommit };
  useEffect(
    () => () => {
      const cur = latest.current;
      if (cur.v !== cur.value) cur.onCommit(cur.v);
    },
    [],
  );
  return (
    <input
      type="text"
      value={v}
      placeholder={placeholder}
      className={className}
      list={list}
      style={width ? { width } : undefined}
      onChange={(e) => setV(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        if (e.key === 'Escape') setV(value);
      }}
    />
  );
}

export function NumberField({
  value,
  onCommit,
  min,
  max,
  step,
  width = 70,
  allowEmpty = false,
}: {
  value: number | undefined;
  onCommit: (v: number | undefined) => void;
  min?: number;
  max?: number;
  step?: number;
  width?: number | string;
  allowEmpty?: boolean;
}) {
  const [v, setV] = useState(value === undefined ? '' : String(value));
  useEffect(() => setV(value === undefined ? '' : String(value)), [value]);
  const commit = () => {
    if (v.trim() === '') {
      if (allowEmpty) onCommit(undefined);
      else setV(value === undefined ? '' : String(value));
      return;
    }
    const n = Number(v);
    if (!Number.isFinite(n)) {
      setV(value === undefined ? '' : String(value));
      return;
    }
    if (n !== value) onCommit(n);
  };
  // TextField と同じく、アンマウント時にも未確定の入力を確定する
  const latest = useRef({ v, value, allowEmpty, onCommit });
  latest.current = { v, value, allowEmpty, onCommit };
  useEffect(
    () => () => {
      const cur = latest.current;
      if (cur.v.trim() === '') {
        if (cur.allowEmpty && cur.value !== undefined) cur.onCommit(undefined);
        return;
      }
      const n = Number(cur.v);
      if (Number.isFinite(n) && n !== cur.value) cur.onCommit(n);
    },
    [],
  );
  return (
    <input
      type="number"
      value={v}
      min={min}
      max={max}
      step={step}
      style={{ width }}
      onChange={(e) => setV(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
    />
  );
}

export function SelectField<T extends string>({
  value,
  options,
  onChange,
  width,
}: {
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (v: T) => void;
  width?: number | string;
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value as T)} style={width ? { width } : undefined}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function CheckField({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: ReactNode;
}) {
  return (
    <label className="check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /> {label}
    </label>
  );
}

export function Row({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="form-row">
      <div className="form-label">{label}</div>
      <div className="form-control">{children}</div>
    </div>
  );
}

export function Section({ title, children, actions }: { title: ReactNode; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="form-section">
      <div className="form-section-head">
        <h3>{title}</h3>
        {actions && <div className="form-section-actions">{actions}</div>}
      </div>
      {children}
    </section>
  );
}
