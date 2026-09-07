import type { LvPanelSpec, TransformerSpec } from '../../model/types';
import { SUPPLY_LABEL } from '../../model/labels';
import { useDispatch } from '../../state/context';
import { CheckField, NumberField, Row, Section, SelectField, TextField } from '../fields';
import { CircuitTable } from './CircuitTable';

export function LvPanelForm({ panel, transformers }: { panel: LvPanelSpec; transformers: TransformerSpec[] }) {
  const dispatch = useDispatch();
  const set = (patch: Partial<LvPanelSpec>) => dispatch({ type: 'UPDATE_PANEL', panel: { ...panel, ...patch } });
  const m = panel.main;
  const setMain = (patch: Partial<LvPanelSpec['main']>) => set({ main: { ...m, ...patch } });

  return (
    <div>
      <Section
        title={`分電盤 ${panel.name}`}
        actions={
          <button
            onClick={() => {
              if (confirm(`分電盤 ${panel.name} を削除しますか？`)) dispatch({ type: 'REMOVE_PANEL', id: panel.id });
            }}
          >
            この盤を削除
          </button>
        }
      >
        <Row label="盤名">
          <TextField value={panel.name} onCommit={(v) => set({ name: v })} width={120} />
        </Row>
        <Row label="供給方式">
          <SelectField
            value={panel.supply}
            options={(Object.keys(SUPPLY_LABEL) as LvPanelSpec['supply'][]).map((k) => ({ value: k, label: SUPPLY_LABEL[k] }))}
            onChange={(v) => {
              const volt = v === '1φ2W200' ? 200 : v === '3φ3W210' ? 210 : 100;
              set({
                supply: v,
                circuits: panel.circuits.map((c) => (v === '1φ3W100/200' ? c : { ...c, voltage: volt })),
              });
            }}
          />
        </Row>
        <Row label="電源（変圧器）">
          <select value={panel.sourceTransformerId ?? ''} onChange={(e) => set(e.target.value ? { sourceTransformerId: e.target.value } : { sourceTransformerId: undefined })}>
            <option value="">（未指定）</option>
            {transformers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}（{t.phase} {t.kva}kVA）
              </option>
            ))}
          </select>
        </Row>
        <Row label="主幹ブレーカー">
          <SelectField value={m.kind} options={[{ value: 'ELB', label: 'ELB' }, { value: 'MCB', label: 'MCB' }]} onChange={(v) => setMain({ kind: v })} />{' '}
          <NumberField value={m.af} width={60} onCommit={(v) => setMain({ af: v ?? m.af })} /> AF /{' '}
          <NumberField value={m.at} width={60} onCommit={(v) => setMain({ at: v ?? m.at })} /> AT{' '}
          <SelectField value={m.poles} options={[{ value: '2P', label: '2P' }, { value: '3P', label: '3P' }]} onChange={(v) => setMain({ poles: v })} />{' '}
          {m.kind === 'ELB' && (
            <>
              感度 <NumberField value={m.sensitivityMa} width={60} allowEmpty onCommit={(v) => setMain(v === undefined ? { sensitivityMa: undefined } : { sensitivityMa: v })} /> mA
            </>
          )}
        </Row>
        <Row label="盤面配置">
          <SelectField value={String(panel.face.rows) as '1' | '2'} options={[{ value: '2', label: '2 段' }, { value: '1', label: '1 段' }]} onChange={(v) => set({ face: { ...panel.face, rows: Number(v) as 1 | 2 } })} />{' '}
          <CheckField
            checked={panel.face.order === 'oddTopEvenBottom'}
            onChange={(v) => set({ face: { ...panel.face, order: v ? 'oddTopEvenBottom' : 'sequential' } })}
            label="奇数番号を上段・偶数番号を下段に配置"
          />
        </Row>
      </Section>
      <Section title="分岐回路">
        <CircuitTable circuits={panel.circuits} supply={panel.supply} onChange={(circuits) => set({ circuits })} />
      </Section>
    </div>
  );
}
