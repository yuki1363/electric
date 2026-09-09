import type { CapacitorSpec, HvFeederSpec, HvSlot, HvSpec, LvPanelSpec, Nameplate, TransformerSpec } from '../../model/types';
import { HV_SLOT_LABEL } from '../../model/types';
import { SWITCH_DEVICE_LABEL, deviceKey, hasBreakingKA, hasFuse, orderDevices } from '../../model/switchgear';
import type { SwitchDevice } from '../../model/switchgear';
import type { PanelMetering } from '../../model/types';
import type { RelayKind } from '../../model/relay';
import { TR_CONNECTIONS, TR_CONNECTION_LABEL, trConnection } from '../../model/transformer';
import { NameplateFields, NameplateGroup, type NameplateItem } from './NameplateFields';
import { newId } from '../../model/ids';
import { moveAt } from '../../model/array';
import { useDispatch } from '../../state/context';
import { CheckField, NumberField, RelayPicker, Row, Section, SelectField, SwitchPicker, TextField } from '../fields';
import { RELAY_LABEL, orderRelays, relayKey } from '../../model/relay';

/** 継電器。旧データは ocr 真偽値しか持たないので補う */
const relaysOf = (o: { relays?: RelayKind[]; ocr?: boolean }) => orderRelays(o.relays ?? (o.ocr ? ['OCR'] : []));

/** 一覧の並べ替え（左から右への並びが図面の並びになる） */
function OrderCell({ i, n, onMove }: { i: number; n: number; onMove: (dir: -1 | 1) => void }) {
  return (
    <td className="row-ops">
      <button className="tiny" title="1 つ左へ" disabled={i === 0} onClick={() => onMove(-1)}>
        ←
      </button>
      <button className="tiny" title="1 つ右へ" disabled={i === n - 1} onClick={() => onMove(1)}>
        →
      </button>
    </td>
  );
}

/** 盤・変圧器二次に付ける計器（電流計・電圧計と、その切換開閉器） */
function MeteringPicker({
  value,
  onChange,
}: {
  value: PanelMetering | undefined;
  onChange: (m: PanelMetering) => void;
}) {
  const m = value ?? {};
  return (
    <div className="metering-picker">
      <CheckField
        checked={m.a === true}
        onChange={(v) => onChange({ ...m, a: v })}
        label="A"
        title="電流計。CT 二次の直列（継電器の後ろ）に入ります"
      />{' '}
      <CheckField
        checked={m.v === true}
        onChange={(v) => onChange({ ...m, v })}
        label="V"
        title="電圧計。VT を置いてその二次につなぎます"
      />
      {(m.a || m.v) && (
        <div className="switch-picker-summary">
          {m.a && (
            <>
              <CheckField
                checked={m.as === true}
                onChange={(v) => onChange({ ...m, as: v })}
                label="AS"
                title="電流計切換開閉器。電流計の手前に直列に入ります"
              />{' '}
            </>
          )}
          {m.v && (
            <CheckField
              checked={m.vs === true}
              onChange={(v) => onChange({ ...m, vs: v })}
              label="VS"
              title="電圧計切換開閉器。電圧計の手前に入ります"
            />
          )}
        </div>
      )}
    </div>
  );
}

/** 二次電圧の入力候補（任意の値も入力できる） */
const SECONDARY_OPTIONS = ['105-210V', '210V', '105V', '420V', '440V', '400V', '210/105V'];

/** 一次電圧の入力候補。低圧用変圧器も作れるよう任意の値を入れられる */
const PRIMARY_OPTIONS = ['6.6kV', '440V', '420V', '400V', '210V'];

export function HvForm({
  hv,
  panels,
  onChange,
  variant = 'main',
}: {
  hv: HvSpec;
  panels: LvPanelSpec[];
  /** 保存先。副変電所のときは親から差し替える（既定は受電設備そのもの） */
  onChange?: (next: HvSpec) => void;
  /** substation では引込・区分開閉器・取引用計器を出さない（送りから受けるため） */
  variant?: 'main' | 'substation';
}) {
  const dispatch = useDispatch();
  const set = (patch: Partial<HvSpec>) => {
    const next = { ...hv, ...patch };
    if (onChange) onChange(next);
    else dispatch({ type: 'SET_HV', hv: next });
  };
  const isSub = variant === 'substation';

  const setTr = (id: string, patch: Partial<TransformerSpec>) =>
    set({ transformers: hv.transformers.map((t) => (t.id === id ? { ...t, ...patch } : t)) });
  const addTr = () =>
    set({
      transformers: [
        ...hv.transformers,
        { id: newId('tr'), name: `Tr-${hv.transformers.length + 1}`, phase: '3φ', kva: 100, secondary: '210V', devices: ['LBS', 'PF'], pfA: 30 },
      ],
    });
  const removeTr = (id: string) => set({ transformers: hv.transformers.filter((t) => t.id !== id) });

  const setSc = (id: string, patch: Partial<CapacitorSpec>) =>
    set({ capacitors: hv.capacitors.map((c) => (c.id === id ? { ...c, ...patch } : c)) });
  const addSc = () =>
    set({
      capacitors: [...hv.capacitors, { id: newId('sc'), name: `SC-${hv.capacitors.length + 1}`, kvar: 50, sr: true, devices: ['LBS', 'PF'], pfA: 30 }],
    });
  const removeSc = (id: string) => set({ capacitors: hv.capacitors.filter((c) => c.id !== id) });

  const setFeeder = (id: string, patch: Partial<HvFeederSpec>) =>
    set({ feeders: hv.feeders.map((f) => (f.id === id ? { ...f, ...patch } : f)) });
  const addFeeder = () =>
    set({
      feeders: [
        ...hv.feeders,
        {
          id: newId('fdr'),
          name: `高圧分岐盤No.${hv.feeders.length + 1}`,
          devices: ['VCB'],
          ratedA: 600,
          breakingKA: 12.5,
          ct: true,
          ctRatio: '100/5A',
          ocr: true,
        },
      ],
    });
  const removeFeeder = (id: string) =>
    set({
      feeders: hv.feeders.filter((f) => f.id !== id),
      transformers: hv.transformers.map((t) => (t.feederId === id ? { ...t, feederId: undefined } : t)),
      capacitors: hv.capacitors.map((c) => (c.feederId === id ? { ...c, feederId: undefined } : c)),
    });

  /** 未入力のときの既定値。種別だけ入れても断面積が消えないようにする */
  const cableOf = (f: HvFeederSpec) => f.cable ?? { type: 'CVT', sq: 38 };

  /** 電源にできる変圧器（自分自身と、自分の下流にある変圧器は除く） */
  const sourceCandidates = (id: string): TransformerSpec[] => {
    const downstream = new Set<string>([id]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const t of hv.transformers) {
        if (t.sourceTransformerId && downstream.has(t.sourceTransformerId) && !downstream.has(t.id)) {
          downstream.add(t.id);
          grew = true;
        }
      }
    }
    return hv.transformers.filter((t) => !downstream.has(t.id));
  };

  /** 開閉装置以外（CT・OCR・ケーブル・SR）の銘板入力欄 */
  const npItem = (
    key: string,
    label: string,
    nameplates: Record<string, Nameplate> | undefined,
    onChange: (next: Record<string, Nameplate>) => void,
  ): NameplateItem => ({
    key,
    label,
    value: nameplates?.[key],
    onChange: (np: Nameplate) => onChange({ ...nameplates, [key]: np }),
  });

  /** 開閉装置ごとの銘板入力欄を作る（機器を選ぶと欄が増える） */
  const deviceItems = (
    devices: SwitchDevice[],
    nameplates: Record<string, Nameplate> | undefined,
    onChange: (next: Record<string, Nameplate>) => void,
  ): NameplateItem[] =>
    orderDevices(devices).map((dev) => ({
      key: deviceKey(dev),
      label: SWITCH_DEVICE_LABEL[dev],
      value: nameplates?.[deviceKey(dev)],
      onChange: (np: Nameplate) => onChange({ ...nameplates, [deviceKey(dev)]: np }),
    }));

  const setSlotNp = (slot: HvSlot, np: Nameplate) =>
    set({ nameplates: { ...hv.nameplates, [slot]: np } });

  /** 受電盤で有効になっているスロット */
  const activeSlots = (): HvSlot[] => {
    const out: HvSlot[] = [];
    if (hv.pas.kind !== 'none') out.push('pas');
    out.push('dgr', 'cable');
    if (hv.vct) out.push('vct', 'whTr');
    if (hv.ds) out.push('ds');
    if (hv.metering.vt) out.push('vtf', 'vt');
    if (hv.la) out.push('la');
    if (hv.mainBreaker.ct) out.push('ct');
    if (hv.mainBreaker.ocr) out.push('ocr');
    if (hv.metering.v) {
      if (hv.metering.vs ?? true) out.push('vs');
      out.push('meterV');
    }
    if (hv.metering.a) {
      if (hv.metering.as ?? true) out.push('as');
      out.push('meterA');
    }
    if (hv.metering.w) out.push('meterW');
    if (hv.metering.pf) out.push('meterPf');
    if (hv.metering.wh) out.push('meterWh');
    for (const dev of orderDevices(hv.mainBreaker.devices)) out.push(deviceKey(dev) as HvSlot);
    return out;
  };

  const mb = hv.mainBreaker;
  const mbRelays = relaysOf(mb);

  return (
    <div>
      <datalist id="secondary-options">
        {SECONDARY_OPTIONS.map((v) => (
          <option key={v} value={v} />
        ))}
      </datalist>
      <datalist id="primary-options">
        {PRIMARY_OPTIONS.map((v) => (
          <option key={v} value={v} />
        ))}
      </datalist>
      <Section title={isSub ? 'この副変電所の単線結線図' : '高圧受電設備'}>
        <Row label={isSub ? '図面を作成' : '高圧受電図を作成'}>
          <CheckField
            checked={hv.enabled}
            onChange={(v) => set({ enabled: v })}
            label={isSub ? '有効' : '有効（6.6kV 受電）'}
          />
        </Row>
      </Section>
      {hv.enabled && !isSub && (
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
        </>
      )}
      {hv.enabled && (
        <>
          {isSub && (
            <Section title="受電ケーブル">
              <Row label="ケーブル">
                <TextField value={hv.cable.type} onCommit={(v) => set({ cable: { ...hv.cable, type: v } })} width={70} />{' '}
                <NumberField value={hv.cable.sq} onCommit={(v) => set({ cable: { ...hv.cable, sq: v ?? 38 } })} /> sq{' '}
                長さ{' '}
                <NumberField
                  value={hv.cable.lengthM}
                  allowEmpty
                  onCommit={(v) =>
                    set({ cable: { ...hv.cable, ...(v === undefined ? { lengthM: undefined } : { lengthM: v }) } })
                  }
                />{' '}
                m
              </Row>
            </Section>
          )}

          <Section title={isSub ? '受電部' : '受電設備'}>
            <Row label="機器">
              {!isSub && (
                <>
                  <CheckField checked={hv.vct} onChange={(v) => set({ vct: v })} label="VCT + 取引用電力量計" />{' '}
                </>
              )}
              <CheckField checked={hv.ds} onChange={(v) => set({ ds: v })} label="DS（断路器）" />{' '}
              <CheckField checked={hv.la} onChange={(v) => set({ la: v })} label="LA（避雷器）" />
            </Row>
            <Row label="主遮断装置">
              <SwitchPicker value={mb.devices} onChange={(v) => set({ mainBreaker: { ...mb, devices: v } })} />
            </Row>
            <Row label="定格 / 保護">
              定格 <NumberField value={mb.ratedA} onCommit={(v) => set({ mainBreaker: { ...mb, ratedA: v ?? 600 } })} /> A{' '}
              {hasBreakingKA(mb.devices) && (
                <>
                  遮断容量{' '}
                  <NumberField
                    value={mb.breakingKA}
                    step={0.5}
                    allowEmpty
                    onCommit={(v) => set({ mainBreaker: { ...mb, breakingKA: v } })}
                  />{' '}
                  kA{' '}
                </>
              )}
              {hasFuse(mb.devices) && (
                <>
                  PF <NumberField value={mb.pfA} allowEmpty onCommit={(v) => set({ mainBreaker: { ...mb, pfA: v } })} /> A{' '}
                </>
              )}
              <CheckField checked={mb.ct} onChange={(v) => set({ mainBreaker: { ...mb, ct: v } })} label="CT" />{' '}
              {mb.ct && (
                <>
                  CT 比{' '}
                  <TextField
                    value={mb.ctRatio ?? ''}
                    width={70}
                    placeholder="75/5A"
                    onCommit={(v) => set({ mainBreaker: { ...mb, ctRatio: v || undefined } })}
                  />{' '}
                </>
              )}
            </Row>
            <Row label="保護継電器">
              <RelayPicker
                value={mbRelays}
                onChange={(v) => set({ mainBreaker: { ...mb, relays: v, ocr: v.includes('OCR') } })}
              />
            </Row>
            <Row label="計器">
              <CheckField checked={hv.metering.vt} onChange={(v) => set({ metering: { ...hv.metering, vt: v } })} label="VT" />{' '}
              <CheckField checked={hv.metering.v} onChange={(v) => set({ metering: { ...hv.metering, v } })} label="V 電圧計" />{' '}
              <CheckField checked={hv.metering.a} onChange={(v) => set({ metering: { ...hv.metering, a: v } })} label="A 電流計" />{' '}
              <CheckField checked={hv.metering.w} onChange={(v) => set({ metering: { ...hv.metering, w: v } })} label="W 電力計" />{' '}
              <CheckField checked={hv.metering.pf} onChange={(v) => set({ metering: { ...hv.metering, pf: v } })} label="cosφ 力率計" />{' '}
              <CheckField checked={hv.metering.wh} onChange={(v) => set({ metering: { ...hv.metering, wh: v } })} label="Wh 電力量計" />
            </Row>
            <Row label="計器切換開閉器">
              <CheckField
                checked={hv.metering.as ?? true}
                onChange={(v) => set({ metering: { ...hv.metering, as: v } })}
                label="AS（電流計切換）"
              />{' '}
              <CheckField
                checked={hv.metering.vs ?? true}
                onChange={(v) => set({ metering: { ...hv.metering, vs: v } })}
                label="VS（電圧計切換）"
              />
              <span className="muted"> 計器の手前に直列に入ります</span>
            </Row>
            <Row label="VT ヒューズ">
              <SelectField
                value={hv.metering.vtfLayout ?? 'vertical'}
                width={260}
                options={[
                  { value: 'vertical', label: '縦（VT の真上・同じ列にそろえる）' },
                  { value: 'horizontal', label: '横（引き出し線の途中・縦を 20mm 詰める）' },
                ]}
                onChange={(v) => set({ metering: { ...hv.metering, vtfLayout: v } })}
              />
            </Row>
          </Section>

          <Section title="高圧分岐盤" actions={<button onClick={addFeeder}>+ 追加</button>}>
            <p className="muted">
              高圧母線から分岐する VCB / LBS 付きの盤です。変圧器・コンデンサの「所属」欄でこの盤を選ぶと、盤の下にまとめて描かれます。
            </p>
            <table className="grid-table">
              <thead>
                <tr>
                  <th>並び</th>
                  <th>盤名</th>
                  <th>計器</th>
                  <th>遮断/開閉</th>
                  <th>定格 A</th>
                  <th>遮断 kA / PF A</th>
                  <th>CT</th>
                  <th>CT 比</th>
                  <th>継電器</th>
                  <th>ケーブル種別</th>
                  <th>sq</th>
                  <th>長さ m</th>
                  <th>負荷名</th>
                  <th>銘板</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {hv.feeders.map((f, i) => (
                  <tr key={f.id}>
                    <OrderCell i={i} n={hv.feeders.length} onMove={(dir) => set({ feeders: moveAt(hv.feeders, i, dir) })} />
                    <td><TextField value={f.name} onCommit={(v) => setFeeder(f.id, { name: v })} width={140} /></td>
                    <td>
                      <MeteringPicker
                        value={f.metering}
                        onChange={(m) => setFeeder(f.id, { metering: m })}
                      />
                    </td>
                    <td>
                      <SwitchPicker value={f.devices} onChange={(v) => setFeeder(f.id, { devices: v })} />
                    </td>
                    <td><NumberField value={f.ratedA} width={60} onCommit={(v) => setFeeder(f.id, { ratedA: v ?? f.ratedA })} /></td>
                    <td>
                      {hasBreakingKA(f.devices) && (
                        <NumberField value={f.breakingKA} step={0.5} width={60} allowEmpty onCommit={(v) => setFeeder(f.id, { breakingKA: v })} />
                      )}
                      {hasFuse(f.devices) && (
                        <NumberField value={f.pfA} width={60} allowEmpty onCommit={(v) => setFeeder(f.id, { pfA: v })} />
                      )}
                      {!hasBreakingKA(f.devices) && !hasFuse(f.devices) && <span className="muted">—</span>}
                    </td>
                    <td><CheckField checked={f.ct} onChange={(v) => setFeeder(f.id, { ct: v })} label="" /></td>
                    <td><TextField value={f.ctRatio ?? ''} width={70} onCommit={(v) => setFeeder(f.id, { ctRatio: v || undefined })} /></td>
                    <td>
                      <RelayPicker
                        value={relaysOf(f)}
                        onChange={(v) => setFeeder(f.id, { relays: v, ocr: v.includes('OCR') })}
                      />
                    </td>
                    <td>
                      <TextField
                        value={f.cable?.type ?? ''}
                        width={70}
                        placeholder="CVT"
                        onCommit={(v) => setFeeder(f.id, { cable: v ? { ...cableOf(f), type: v } : undefined })}
                      />
                    </td>
                    <td>
                      <NumberField
                        value={f.cable?.sq}
                        width={60}
                        allowEmpty
                        onCommit={(v) => setFeeder(f.id, { cable: { ...cableOf(f), sq: v ?? 38 } })}
                      />
                    </td>
                    <td>
                      <NumberField
                        value={f.cable?.lengthM}
                        width={60}
                        allowEmpty
                        onCommit={(v) =>
                          setFeeder(f.id, {
                            cable: { ...cableOf(f), ...(v === undefined ? { lengthM: undefined } : { lengthM: v }) },
                          })
                        }
                      />
                    </td>
                    <td><TextField value={f.loadName ?? ''} width={110} onCommit={(v) => setFeeder(f.id, { loadName: v || undefined })} /></td>
                    <td>
                      <NameplateGroup
                        title={`${f.name} の機器銘板`}
                        items={[
                          ...deviceItems(f.devices, f.nameplates, (np) => setFeeder(f.id, { nameplates: np })),
                          ...(f.ct ? [npItem('ct', '変流器 (CT)', f.nameplates, (np) => setFeeder(f.id, { nameplates: np }))] : []),
                          ...relaysOf(f).map((r) =>
                            npItem(relayKey(r), RELAY_LABEL[r], f.nameplates, (np) => setFeeder(f.id, { nameplates: np })),
                          ),
                          ...(f.cable ? [npItem('cable', '高圧ケーブル', f.nameplates, (np) => setFeeder(f.id, { nameplates: np }))] : []),
                        ]}
                      />
                    </td>
                    <td><button onClick={() => removeFeeder(f.id)}>削除</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          <Section title="変圧器" actions={<button onClick={addTr}>+ 追加</button>}>
            <table className="grid-table">
              <thead>
                <tr>
                  <th>並び</th>
                  <th>名称</th>
                  <th>相</th>
                  <th>結線</th>
                  <th>容量 kVA</th>
                  <th>一次電圧</th>
                  <th>二次電圧</th>
                  <th>二次計器</th>
                  <th>開閉器</th>
                  <th>PF A</th>
                  <th>電源</th>
                  <th>給電先</th>
                  <th>銘板</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {hv.transformers.map((t, i) => (
                  <tr key={t.id}>
                    <OrderCell
                      i={i}
                      n={hv.transformers.length}
                      onMove={(dir) => set({ transformers: moveAt(hv.transformers, i, dir) })}
                    />
                    <td><TextField value={t.name} onCommit={(v) => setTr(t.id, { name: v })} width={70} /></td>
                    <td>
                      <SelectField value={t.phase} options={[{ value: '1φ', label: '単相' }, { value: '3φ', label: '三相' }]} onChange={(v) => setTr(t.id, { phase: v })} />
                    </td>
                    <td>
                      {t.phase === '3φ' ? (
                        <SelectField
                          value={trConnection(t.connection)}
                          options={TR_CONNECTIONS.map((c) => ({ value: c, label: TR_CONNECTION_LABEL[c] }))}
                          onChange={(v) => setTr(t.id, { connection: v })}
                        />
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td><NumberField value={t.kva} onCommit={(v) => setTr(t.id, { kva: v ?? 100 })} /></td>
                    <td>
                      <TextField
                        value={t.primary ?? ''}
                        width={80}
                        placeholder="6.6kV"
                        list="primary-options"
                        onCommit={(v) => setTr(t.id, { primary: v || undefined })}
                      />
                    </td>
                    <td>
                      <TextField value={t.secondary} width={90} list="secondary-options" onCommit={(v) => setTr(t.id, { secondary: v })} />
                    </td>
                    <td>
                      <MeteringPicker
                        value={t.secondaryMetering}
                        onChange={(m) => setTr(t.id, { secondaryMetering: m })}
                      />
                    </td>
                    <td><SwitchPicker value={t.devices} onChange={(v) => setTr(t.id, { devices: v })} /></td>
                    <td>
                      {hasFuse(t.devices) ? (
                        <NumberField value={t.pfA} onCommit={(v) => setTr(t.id, { pfA: v ?? 30 })} width={60} />
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td>
                      <select
                        value={
                          t.externalSource
                            ? 'x'
                            : t.sourceTransformerId
                              ? `t:${t.sourceTransformerId}`
                              : t.feederId
                                ? `f:${t.feederId}`
                                : ''
                        }
                        onChange={(e) => {
                          const v = e.target.value;
                          setTr(t.id, {
                            feederId: v.startsWith('f:') ? v.slice(2) : undefined,
                            sourceTransformerId: v.startsWith('t:') ? v.slice(2) : undefined,
                            externalSource: v === 'x' ? (t.externalSource ?? { name: '非常電源盤' }) : undefined,
                          });
                        }}
                      >
                        <option value="">高圧母線に直結</option>
                        <option value="x">その他の電源（名前を入力）</option>
                        {hv.feeders.length > 0 && (
                          <optgroup label="高圧分岐盤">
                            {hv.feeders.map((f) => (
                              <option key={f.id} value={`f:${f.id}`}>{f.name}</option>
                            ))}
                          </optgroup>
                        )}
                        {sourceCandidates(t.id).length > 0 && (
                          <optgroup label="変圧器の二次側（低圧 → 低圧）">
                            {sourceCandidates(t.id).map((x) => (
                              <option key={x.id} value={`t:${x.id}`}>
                                {x.name}（{x.secondary}）
                              </option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                      {t.externalSource && (
                        <div className="ext-source">
                          <TextField
                            value={t.externalSource.name}
                            width={110}
                            placeholder="非常電源盤・DTMC など"
                            onCommit={(v) => setTr(t.id, { externalSource: { ...t.externalSource!, name: v } })}
                          />
                          <TextField
                            value={t.externalSource.ratingText ?? ''}
                            width={90}
                            placeholder="600V 600A"
                            onCommit={(v) =>
                              setTr(t.id, { externalSource: { ...t.externalSource!, ratingText: v || undefined } })
                            }
                          />
                        </div>
                      )}
                    </td>
                    <td>
                      <select value={t.feeds ?? ''} onChange={(e) => setTr(t.id, e.target.value ? { feeds: e.target.value } : { feeds: undefined })}>
                        <option value="">（未指定）</option>
                        {panels.map((p) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <NameplateGroup
                        title={`変圧器 ${t.name} の機器銘板`}
                        items={[
                          { key: 'body', label: '変圧器本体', value: t.nameplate, onChange: (np: Nameplate) => setTr(t.id, { nameplate: np }) },
                          ...deviceItems(t.devices, t.nameplates, (np) => setTr(t.id, { nameplates: np })),
                        ]}
                      />
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
                  <th>並び</th>
                  <th>名称</th>
                  <th>容量 kvar</th>
                  <th>直列リアクトル</th>
                  <th>開閉器</th>
                  <th>PF A</th>
                  <th>所属分岐盤</th>
                  <th>銘板</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {hv.capacitors.map((c, i) => (
                  <tr key={c.id}>
                    <OrderCell
                      i={i}
                      n={hv.capacitors.length}
                      onMove={(dir) => set({ capacitors: moveAt(hv.capacitors, i, dir) })}
                    />
                    <td><TextField value={c.name} onCommit={(v) => setSc(c.id, { name: v })} width={70} /></td>
                    <td><NumberField value={c.kvar} onCommit={(v) => setSc(c.id, { kvar: v ?? 50 })} /></td>
                    <td><CheckField checked={c.sr} onChange={(v) => setSc(c.id, { sr: v })} label="SR 6%" /></td>
                    <td><SwitchPicker value={c.devices} onChange={(v) => setSc(c.id, { devices: v })} /></td>
                    <td>
                      {hasFuse(c.devices) ? (
                        <NumberField value={c.pfA} onCommit={(v) => setSc(c.id, { pfA: v ?? 30 })} width={60} />
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td>
                      <select value={c.feederId ?? ''} onChange={(e) => setSc(c.id, e.target.value ? { feederId: e.target.value } : { feederId: undefined })}>
                        <option value="">高圧母線に直結</option>
                        {hv.feeders.map((f) => (
                          <option key={f.id} value={f.id}>{f.name}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <NameplateGroup
                        title={`進相コンデンサ ${c.name} の機器銘板`}
                        items={[
                          { key: 'body', label: '進相コンデンサ本体 (SC)', value: c.nameplate, onChange: (np: Nameplate) => setSc(c.id, { nameplate: np }) },
                          ...(c.sr ? [npItem('sr', '直列リアクトル (SR)', c.nameplates, (np) => setSc(c.id, { nameplates: np }))] : []),
                          ...deviceItems(c.devices, c.nameplates, (np) => setSc(c.id, { nameplates: np })),
                        ]}
                      />
                    </td>
                    <td><button onClick={() => removeSc(c.id)}>削除</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
          <Section title="受電盤 機器銘板">
            <p className="muted">
              型式・製造者・製造年月・製造番号を入力できます。定格容量を空にすると、上で入力した仕様から自動で埋まります。
              入力した内容は「機器銘板表」の図面に出ます。
            </p>
            {activeSlots().map((slot) => (
              <div key={slot} className="slot-nameplate">
                <div className="slot-title">{HV_SLOT_LABEL[slot]}</div>
                <NameplateFields value={hv.nameplates?.[slot]} onChange={(np) => setSlotNp(slot, np)} />
              </div>
            ))}
          </Section>
        </>
      )}
    </div>
  );
}
