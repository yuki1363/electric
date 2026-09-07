import type { CapacitorSpec, HvSpec, LvPanelSpec, TransformerSpec } from '../../model/types';
import { newId } from '../../model/ids';
import { useDispatch } from '../../state/context';
import { CheckField, NumberField, Row, Section, SelectField, TextField } from '../fields';

const SECONDARY = [
  { value: '105-210V', label: '105-210V（単相3線）' },
  { value: '210V', label: '210V（三相）' },
  { value: '105V', label: '105V' },
  { value: '420V', label: '420V' },
] as const;

export function HvForm({ hv, panels }: { hv: HvSpec; panels: LvPanelSpec[] }) {
  const dispatch = useDispatch();
  const set = (patch: Partial<HvSpec>) => dispatch({ type: 'SET_HV', hv: { ...hv, ...patch } });

  const setTr = (id: string, patch: Partial<TransformerSpec>) =>
    set({ transformers: hv.transformers.map((t) => (t.id === id ? { ...t, ...patch } : t)) });
  const addTr = () =>
    set({
      transformers: [
        ...hv.transformers,
        { id: newId('tr'), name: `Tr-${hv.transformers.length + 1}`, phase: '3φ', kva: 100, secondary: '210V', switch: 'LBS', pfA: 30 },
      ],
    });
  const removeTr = (id: string) => set({ transformers: hv.transformers.filter((t) => t.id !== id) });

  const setSc = (id: string, patch: Partial<CapacitorSpec>) =>
    set({ capacitors: hv.capacitors.map((c) => (c.id === id ? { ...c, ...patch } : c)) });
  const addSc = () =>
    set({
      capacitors: [...hv.capacitors, { id: newId('sc'), name: `SC-${hv.capacitors.length + 1}`, kvar: 50, sr: true, switch: 'LBS', pfA: 30 }],
    });
  const removeSc = (id: string) => set({ capacitors: hv.capacitors.filter((c) => c.id !== id) });

  const mb = hv.mainBreaker;

  return (
    <div>
      <Section title="高圧受電設備">
        <Row label="高圧受電図を作成">
          <CheckField checked={hv.enabled} onChange={(v) => set({ enabled: v })} label="有効（6.6kV 受電）" />
        </Row>
      </Section>
      {hv.enabled && (
        <>
          <Section title="引込・区分開閉器">
            <Row label="引込方式">
              <SelectField
                value={hv.incoming}
                options={[
                  { value: 'overhead', label: '架空引込' },
                  { value: 'underground', label: '地中引込' },
                ]}
                onChange={(v) => set({ incoming: v })}
              />
            </Row>
            <Row label="区分開閉器">
              <SelectField
                value={hv.pas.kind}
                options={[
                  { value: 'PAS', label: 'PAS（気中負荷開閉器）' },
                  { value: 'UGS', label: 'UGS（地中線用）' },
                  { value: 'none', label: 'なし' },
                ]}
                onChange={(v) => set({ pas: { ...hv.pas, kind: v } })}
              />{' '}
              定格 <NumberField value={hv.pas.ratedA} onCommit={(v) => set({ pas: { ...hv.pas, ratedA: v ?? 300 } })} /> A{' '}
              <CheckField checked={hv.pas.sog} onChange={(v) => set({ pas: { ...hv.pas, sog: v } })} label="SOG 付" />
            </Row>
            <Row label="引込ケーブル">
              <TextField value={hv.cable.type} onCommit={(v) => set({ cable: { ...hv.cable, type: v } })} width={70} />{' '}
              <NumberField value={hv.cable.sq} onCommit={(v) => set({ cable: { ...hv.cable, sq: v ?? 38 } })} /> sq{' '}
              長さ <NumberField value={hv.cable.lengthM} allowEmpty onCommit={(v) => set({ cable: { ...hv.cable, ...(v === undefined ? { lengthM: undefined } : { lengthM: v }) } })} /> m
            </Row>
          </Section>

          <Section title="受電設備">
            <Row label="機器">
              <CheckField checked={hv.vct} onChange={(v) => set({ vct: v })} label="VCT + 取引用電力量計" />{' '}
              <CheckField checked={hv.ds} onChange={(v) => set({ ds: v })} label="DS（断路器）" />{' '}
              <CheckField checked={hv.la} onChange={(v) => set({ la: v })} label="LA（避雷器）" />
            </Row>
            <Row label="主遮断装置">
              <SelectField
                value={mb.type}
                options={[
                  { value: 'CB', label: 'CB 形（VCB + OCR）' },
                  { value: 'PF-S', label: 'PF・S 形（LBS + PF）' },
                ]}
                onChange={(v) =>
                  set({
                    mainBreaker:
                      v === 'CB'
                        ? { type: 'CB', vcb: { ratedA: 600, breakingKA: 12.5 }, ocr: true, ctRatio: '75/5A' }
                        : { type: 'PF-S', lbs: { ratedA: 300 }, pfA: 40 },
                  })
                }
              />
            </Row>
            {mb.type === 'CB' ? (
              <Row label="VCB / CT">
                VCB 定格 <NumberField value={mb.vcb.ratedA} onCommit={(v) => set({ mainBreaker: { ...mb, vcb: { ...mb.vcb, ratedA: v ?? 600 } } })} /> A{' '}
                遮断容量 <NumberField value={mb.vcb.breakingKA} step={0.5} onCommit={(v) => set({ mainBreaker: { ...mb, vcb: { ...mb.vcb, breakingKA: v ?? 12.5 } } })} /> kA{' '}
                CT 比 <TextField value={mb.ctRatio} onCommit={(v) => set({ mainBreaker: { ...mb, ctRatio: v } })} width={70} />{' '}
                <CheckField checked={mb.ocr} onChange={(v) => set({ mainBreaker: { ...mb, ocr: v } })} label="OCR" />
              </Row>
            ) : (
              <Row label="LBS / PF">
                LBS 定格 <NumberField value={mb.lbs.ratedA} onCommit={(v) => set({ mainBreaker: { ...mb, lbs: { ratedA: v ?? 300 } } })} /> A{' '}
                PF <NumberField value={mb.pfA} onCommit={(v) => set({ mainBreaker: { ...mb, pfA: v ?? 40 } })} /> A
              </Row>
            )}
            <Row label="計器">
              <CheckField checked={hv.metering.vt} onChange={(v) => set({ metering: { ...hv.metering, vt: v } })} label="VT" />{' '}
              <CheckField checked={hv.metering.v} onChange={(v) => set({ metering: { ...hv.metering, v } })} label="V 電圧計" />{' '}
              <CheckField checked={hv.metering.a} onChange={(v) => set({ metering: { ...hv.metering, a: v } })} label="A 電流計" />{' '}
              <CheckField checked={hv.metering.w} onChange={(v) => set({ metering: { ...hv.metering, w: v } })} label="W 電力計" />{' '}
              <CheckField checked={hv.metering.pf} onChange={(v) => set({ metering: { ...hv.metering, pf: v } })} label="PF 力率計" />{' '}
              <CheckField checked={hv.metering.wh} onChange={(v) => set({ metering: { ...hv.metering, wh: v } })} label="Wh 電力量計" />
            </Row>
            <Row label="接地">
              <CheckField checked={hv.grounding.aType} onChange={(v) => set({ grounding: { ...hv.grounding, aType: v } })} label="A種（筐体・LA）" />{' '}
              <CheckField checked={hv.grounding.bType} onChange={(v) => set({ grounding: { ...hv.grounding, bType: v } })} label="B種（変圧器二次）" />
            </Row>
          </Section>

          <Section title="変圧器" actions={<button onClick={addTr}>+ 追加</button>}>
            <table className="grid-table">
              <thead>
                <tr>
                  <th>名称</th>
                  <th>相</th>
                  <th>容量 kVA</th>
                  <th>二次電圧</th>
                  <th>開閉器</th>
                  <th>PF A</th>
                  <th>給電先</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {hv.transformers.map((t) => (
                  <tr key={t.id}>
                    <td><TextField value={t.name} onCommit={(v) => setTr(t.id, { name: v })} width={70} /></td>
                    <td>
                      <SelectField value={t.phase} options={[{ value: '1φ', label: '単相' }, { value: '3φ', label: '三相' }]} onChange={(v) => setTr(t.id, { phase: v })} />
                    </td>
                    <td><NumberField value={t.kva} onCommit={(v) => setTr(t.id, { kva: v ?? 100 })} /></td>
                    <td><SelectField value={t.secondary} options={SECONDARY} onChange={(v) => setTr(t.id, { secondary: v })} /></td>
                    <td><SelectField value={t.switch} options={[{ value: 'LBS', label: 'LBS+PF' }, { value: 'PC', label: 'PC' }]} onChange={(v) => setTr(t.id, { switch: v })} /></td>
                    <td><NumberField value={t.pfA} onCommit={(v) => setTr(t.id, { pfA: v ?? 30 })} width={60} /></td>
                    <td>
                      <select value={t.feeds ?? ''} onChange={(e) => setTr(t.id, e.target.value ? { feeds: e.target.value } : { feeds: undefined })}>
                        <option value="">（未指定）</option>
                        {panels.map((p) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </td>
                    <td><button onClick={() => removeTr(t.id)}>削除</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          <Section title="進相コンデンサ" actions={<button onClick={addSc}>+ 追加</button>}>
            <table className="grid-table">
              <thead>
                <tr>
                  <th>名称</th>
                  <th>容量 kvar</th>
                  <th>直列リアクトル</th>
                  <th>開閉器</th>
                  <th>PF A</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {hv.capacitors.map((c) => (
                  <tr key={c.id}>
                    <td><TextField value={c.name} onCommit={(v) => setSc(c.id, { name: v })} width={70} /></td>
                    <td><NumberField value={c.kvar} onCommit={(v) => setSc(c.id, { kvar: v ?? 50 })} /></td>
                    <td><CheckField checked={c.sr} onChange={(v) => setSc(c.id, { sr: v })} label="SR 6%" /></td>
                    <td><SelectField value={c.switch} options={[{ value: 'LBS', label: 'LBS+PF' }, { value: 'PC', label: 'PC' }]} onChange={(v) => setSc(c.id, { switch: v })} /></td>
                    <td><NumberField value={c.pfA} onCommit={(v) => setSc(c.id, { pfA: v ?? 30 })} width={60} /></td>
                    <td><button onClick={() => removeSc(c.id)}>削除</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        </>
      )}
    </div>
  );
}
