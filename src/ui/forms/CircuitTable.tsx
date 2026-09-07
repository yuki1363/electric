import type { CircuitSpec, SupplyKind } from '../../model/types';
import { defaultCircuit } from '../../model/defaults';
import { NumberField, SelectField, TextField } from '../fields';

const POLES = [
  { value: '1P', label: '1P' },
  { value: '2P', label: '2P' },
  { value: '3P', label: '3P' },
] as const;

export function voltageOptions(supply: SupplyKind): readonly { value: '100' | '200' | '210'; label: string }[] {
  switch (supply) {
    case '1φ2W100':
      return [{ value: '100', label: '100V' }];
    case '1φ2W200':
      return [{ value: '200', label: '200V' }];
    case '1φ3W100/200':
      return [
        { value: '100', label: '100V' },
        { value: '200', label: '200V' },
      ];
    case '3φ3W210':
      return [{ value: '210', label: '210V' }];
  }
}

export function CircuitTable({
  circuits,
  supply,
  onChange,
}: {
  circuits: CircuitSpec[];
  supply: SupplyKind;
  onChange: (next: CircuitSpec[]) => void;
}) {
  const vOpts = voltageOptions(supply);
  const update = (i: number, patch: Partial<CircuitSpec>) => onChange(circuits.map((c, k) => (k === i ? { ...c, ...patch } : c)));
  const remove = (i: number) => onChange(circuits.filter((_, k) => k !== i));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= circuits.length) return;
    const next = [...circuits];
    [next[i], next[j]] = [next[j]!, next[i]!];
    onChange(next);
  };
  const add = () => {
    const no = circuits.reduce((m, c) => Math.max(m, c.no), 0) + 1;
    const last = circuits[circuits.length - 1];
    const v = vOpts[0]!.value;
    const base = { ...defaultCircuit(no), voltage: Number(v) as 100 | 200 | 210 };
    onChange([...circuits, last ? { ...base, poles: last.poles, at: last.at, wireSize: last.wireSize } : base]);
  };
  const renumber = () => onChange(circuits.map((c, i) => ({ ...c, no: i + 1 })));

  return (
    <div>
      <div className="table-actions">
        <button onClick={add}>+ 回路追加</button>
        <button onClick={renumber}>No を連番に振り直す</button>
        <span className="muted">{circuits.length} 回路</span>
      </div>
      <table className="grid-table circuits">
        <thead>
          <tr>
            <th>No</th>
            <th>回路名</th>
            <th>種別</th>
            <th>感度mA</th>
            <th>極数</th>
            <th>AT</th>
            <th>電圧</th>
            <th>負荷名</th>
            <th>負荷VA</th>
            <th>電線</th>
            <th>備考</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {circuits.map((c, i) => (
            <tr key={i}>
              <td><NumberField value={c.no} width={50} onCommit={(v) => update(i, { no: v ?? c.no })} /></td>
              <td><TextField value={c.name} width={90} onCommit={(v) => update(i, { name: v })} /></td>
              <td>
                <SelectField value={c.breaker} options={[{ value: 'MCB', label: 'MCB' }, { value: 'ELB', label: 'ELB' }]} onChange={(v) => update(i, { breaker: v, ...(v === 'ELB' && !c.sensitivityMa ? { sensitivityMa: 30 } : {}) })} />
              </td>
              <td>
                {c.breaker === 'ELB' ? (
                  <NumberField value={c.sensitivityMa} width={55} allowEmpty onCommit={(v) => update(i, v === undefined ? { sensitivityMa: undefined } : { sensitivityMa: v })} />
                ) : (
                  <span className="muted">-</span>
                )}
              </td>
              <td><SelectField value={c.poles} options={POLES} onChange={(v) => update(i, { poles: v })} /></td>
              <td><NumberField value={c.at} width={55} onCommit={(v) => update(i, { at: v ?? c.at })} /></td>
              <td>
                <SelectField value={String(c.voltage) as '100' | '200' | '210'} options={vOpts} onChange={(v) => update(i, { voltage: Number(v) as 100 | 200 | 210 })} />
              </td>
              <td><TextField value={c.loadName} width={150} onCommit={(v) => update(i, { loadName: v })} /></td>
              <td><NumberField value={c.loadVA} width={65} onCommit={(v) => update(i, { loadVA: v ?? 0 })} /></td>
              <td><TextField value={c.wireSize} width={90} onCommit={(v) => update(i, { wireSize: v })} /></td>
              <td><TextField value={c.note ?? ''} width={90} onCommit={(v) => update(i, { note: v })} /></td>
              <td className="row-ops">
                <button title="上へ" onClick={() => move(i, -1)}>↑</button>
                <button title="下へ" onClick={() => move(i, 1)}>↓</button>
                <button title="削除" onClick={() => remove(i)}>×</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
