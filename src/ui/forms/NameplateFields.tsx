import { useState } from 'react';
import type { Nameplate } from '../../model/types';
import { NumberField, TextField } from '../fields';

type TextKey = Exclude<keyof Nameplate, 'qty'>;

const FIELDS: { key: TextKey; label: string; width: number }[] = [
  { key: 'model', label: '型式', width: 150 },
  { key: 'ratingText', label: '定格容量', width: 170 },
  { key: 'maker', label: '製造者', width: 120 },
  { key: 'madeOn', label: '製造年月', width: 90 },
  { key: 'serial', label: '製造番号', width: 120 },
  { key: 'location', label: '使用箇所', width: 120 },
  { key: 'note', label: '備考', width: 150 },
];

/** 銘板の入力欄（横並び）。定格容量は空なら仕様から自動生成される */
export function NameplateFields({
  value,
  onChange,
}: {
  value: Nameplate | undefined;
  onChange: (next: Nameplate) => void;
}) {
  const np = value ?? {};
  return (
    <div className="nameplate-fields">
      {FIELDS.map((f) => (
        <label key={f.key}>
          <span>{f.label}</span>
          <TextField
            value={(np[f.key] as string | undefined) ?? ''}
            width={f.width}
            onCommit={(v) => onChange({ ...np, [f.key]: v || undefined })}
          />
        </label>
      ))}
      <label title="同じ機器が複数台あるときの台数。1 台なら空のままで構いません">
        <span>数量</span>
        <NumberField
          value={np.qty ?? 1}
          width={50}
          min={1}
          onCommit={(v) => onChange({ ...np, qty: v && v > 1 ? v : undefined })}
        />
      </label>
    </div>
  );
}

/** 「銘板…」ボタンで開閉する銘板入力欄 */
export function NameplateDisclosure({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Nameplate | undefined;
  onChange: (next: Nameplate) => void;
}) {
  const [open, setOpen] = useState(false);
  const filled = value && Object.values(value).some((v) => v);
  return (
    <div className="nameplate-disclosure">
      <button className="small" onClick={() => setOpen(!open)} title="型式・製造者などを入力">
        {open ? '▼' : '▶'} 銘板{filled ? ' ●' : ''}
      </button>
      {open && (
        <div className="nameplate-body">
          <div className="muted">{label}</div>
          <NameplateFields value={value} onChange={onChange} />
        </div>
      )}
    </div>
  );
}

/** 銘板の入力先が 1 つ分 */
export interface NameplateItem {
  key: string;
  label: string;
  value: Nameplate | undefined;
  onChange: (next: Nameplate) => void;
}

/** 「銘板…」ボタンで開き、機器ごとの銘板入力欄を縦に並べる */
export function NameplateGroup({ title, items }: { title: string; items: NameplateItem[] }) {
  const [open, setOpen] = useState(false);
  const filled = items.some((i) => i.value && Object.values(i.value).some((v) => v));
  return (
    <div className="nameplate-disclosure">
      <button className="small" onClick={() => setOpen(!open)} title="型式・製造者などを入力">
        {open ? '▼' : '▶'} 銘板{filled ? ' ●' : ''}
      </button>
      {open && (
        <div className="nameplate-body">
          <div className="muted">{title}</div>
          {items.map((i) => (
            <div key={i.key} className="slot-nameplate">
              <div className="slot-title">{i.label}</div>
              <NameplateFields value={i.value} onChange={i.onChange} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
