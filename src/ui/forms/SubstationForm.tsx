import type { HvFeederSpec, HvSpec, LvPanelSpec, SubstationSpec } from '../../model/types';
import { useDispatch } from '../../state/context';
import { Row, Section, SelectField, TextField } from '../fields';
import { HvForm } from './HvForm';

/**
 * 副変電所（高圧受電盤の「送り」から高圧で受ける設備）。
 * 中身は受電設備とまったく同じ構造なので、入力欄は HvForm をそのまま使い、
 * 保存先だけ差し替える。
 */
export function SubstationForm({
  substation,
  feeders,
  panels,
}: {
  substation: SubstationSpec;
  /** 親（高圧受電盤）の分岐盤。どの送りから受けるかを選ぶ */
  feeders: HvFeederSpec[];
  panels: LvPanelSpec[];
}) {
  const dispatch = useDispatch();
  const set = (patch: Partial<SubstationSpec>) =>
    dispatch({ type: 'UPDATE_SUBSTATION', substation: { ...substation, ...patch } });
  const setHv = (hv: HvSpec) => set({ hv });

  return (
    <div>
      <Section
        title={substation.name}
        actions={
          <button
            onClick={() => {
              if (confirm(`「${substation.name}」を削除します。図面も消えます。よろしいですか？`)) {
                dispatch({ type: 'REMOVE_SUBSTATION', id: substation.id });
              }
            }}
          >
            削除
          </button>
        }
      >
        <Row label="名称">
          <TextField value={substation.name} width={180} onCommit={(v) => set({ name: v || substation.name })} />
        </Row>
        <Row label="電源（送り）">
          <SelectField
            value={substation.sourceFeederId ?? ''}
            options={[
              { value: '', label: '未設定（受電とだけ書く）' },
              ...feeders.map((f) => ({ value: f.id, label: `高圧受電盤 ${f.name}` })),
            ]}
            onChange={(v) => set({ sourceFeederId: v || undefined })}
          />
          <span className="muted small">
            選んだ分岐盤が親の図面で「{substation.name} へ」と書かれ、この図面はそこから始まります
          </span>
        </Row>
      </Section>
      <HvForm hv={substation.hv} panels={panels} onChange={setHv} variant="substation" />
    </div>
  );
}
