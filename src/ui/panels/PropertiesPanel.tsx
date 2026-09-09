import { useEffect, useState } from 'react';
import type { Diagram, Element, TextItem, Wire } from '../../model/types';
import type { Rot } from '../../symbols/transform';
import { getSymbol } from '../../symbols';
import { GRID } from '../../layout/constants';
import { snapValue } from '../../geom/point';
import { useDispatch } from '../../state/context';
import type { AlignMode } from '../../state/diagramOps';
import { NumberField, Row, SelectField, TextField } from '../fields';

export function PropertiesPanel({
  diagram,
  selection,
  onSelectionChange,
}: {
  diagram: Diagram;
  selection: string[];
  onSelectionChange: (ids: string[]) => void;
}) {
  const dispatch = useDispatch();
  const del = () => {
    dispatch({ type: 'DELETE_ITEMS', diagramId: diagram.id, ids: selection });
    onSelectionChange([]);
  };

  if (selection.length === 0) {
    return (
      <div className="props">
        <h3>プロパティ</h3>
        <p className="muted">
          項目をクリックして選択。ドラッグで移動、Shift+クリックで複数選択、Delete で削除。
          <b>配線はドラッグすると曲がりの位置を動かせます。</b>
        </p>
        <p className="muted">
          刻みは右下の「スナップ」で変えられます（Alt を押している間はスナップしません）。
          矢印キーで 1 刻み、Shift+矢印で 5 刻み。
        </p>
        <p className="muted">Ctrl+D 複製 / Ctrl+C・V コピー＆貼り付け（図面をまたげます） / Ctrl+X 切り取り</p>
        <p className="muted">ホイール: 拡縮 / Space+ドラッグ・中ボタン: パン</p>
        <p className="muted">
          {diagram.kind === 'free'
            ? '手描きの図面（仕様から作り直されません）'
            : diagram.edited
              ? '手作業あり（作り直しても残ります）'
              : '自動生成のまま'}
          {diagram.stale ? ' / 仕様変更後に未再生成' : ''}
        </p>
      </div>
    );
  }

  if (selection.length > 1) {
    const align = (mode: AlignMode) => dispatch({ type: 'ALIGN_ITEMS', diagramId: diagram.id, ids: selection, mode });
    const distribute = (axis: 'x' | 'y') =>
      dispatch({ type: 'DISTRIBUTE_ITEMS', diagramId: diagram.id, ids: selection, axis });
    const nEl = diagram.elements.filter((e) => selection.includes(e.id)).length;
    return (
      <div className="props">
        <h3>{selection.length} 項目を選択中</h3>
        <div className="align-group">
          <div className="muted">縦に並べる（左右をそろえる）</div>
          <div className="btn-row">
            <button onClick={() => align('left')} title="外形の左端をそろえる">左</button>
            <button onClick={() => align('centerX')} title="中心線を縦にそろえる（配線が真っすぐになります）">左右中央</button>
            <button onClick={() => align('right')} title="外形の右端をそろえる">右</button>
          </div>
        </div>
        <div className="align-group">
          <div className="muted">横に並べる（上下をそろえる）</div>
          <div className="btn-row">
            <button onClick={() => align('top')} title="外形の上端をそろえる">上</button>
            <button onClick={() => align('centerY')} title="中心線を横にそろえる（配線が真っすぐになります）">上下中央</button>
            <button onClick={() => align('bottom')} title="外形の下端をそろえる">下</button>
          </div>
        </div>
        <div className="align-group">
          <div className="muted">等間隔に並べる（3 台以上）</div>
          <div className="btn-row">
            <button disabled={nEl < 3} onClick={() => distribute('x')}>左右</button>
            <button disabled={nEl < 3} onClick={() => distribute('y')}>上下</button>
          </div>
        </div>
        <div className="btn-row">
          <button onClick={del}>削除</button>
        </div>
        <p className="muted">整列は図記号だけが動きます。つながっている配線は自動で引き直します。</p>
      </div>
    );
  }

  const id = selection[0]!;
  const el = diagram.elements.find((e) => e.id === id);
  if (el) return <ElementProps diagram={diagram} el={el} onDelete={del} />;
  const w = diagram.wires.find((x) => x.id === id);
  if (w) return <WireProps diagram={diagram} wire={w} onDelete={del} />;
  const t = diagram.texts.find((x) => x.id === id);
  if (t) return <TextProps diagram={diagram} text={t} onDelete={del} />;
  return null;
}

function LabelsEditor({ value, onCommit }: { value: string[]; onCommit: (lines: string[]) => void }) {
  const joined = value.join('\n');
  const [v, setV] = useState(joined);
  useEffect(() => setV(joined), [joined]);
  return (
    <textarea
      rows={4}
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => {
        if (v !== joined) onCommit(v.split('\n').map((s) => s.trimEnd()));
      }}
    />
  );
}

function ElementProps({ diagram, el, onDelete }: { diagram: Diagram; el: Element; onDelete: () => void }) {
  const dispatch = useDispatch();
  const def = getSymbol(el.kind);
  const patch = (p: Partial<Element>) => dispatch({ type: 'UPDATE_ELEMENT', diagramId: diagram.id, id: el.id, patch: p });
  return (
    <div className="props">
      <h3>{def.nameJa}</h3>
      <Row label="X / Y (mm)">
        <NumberField value={el.x} step={GRID} width={60} onCommit={(v) => patch({ x: snapValue(v ?? el.x, GRID) })} />
        <NumberField value={el.y} step={GRID} width={60} onCommit={(v) => patch({ y: snapValue(v ?? el.y, GRID) })} />
      </Row>
      <Row label="回転">
        {([0, 90, 180, 270] as Rot[]).map((r) => (
          <button key={r} className={el.rot === r ? 'active' : ''} onClick={() => patch({ rot: r })}>
            {r}°
          </button>
        ))}
      </Row>
      <Row label="ラベル（1行=1段）">
        <LabelsEditor value={el.labels} onCommit={(labels) => patch({ labels })} />
      </Row>
      {el.labelOffset && (
        <Row label="ラベル位置">
          <button onClick={() => patch({ labelOffset: undefined })}>既定位置に戻す</button>
        </Row>
      )}
      {el.props && Object.keys(el.props).length > 0 && (
        <Row label="仕様">
          <div className="muted">
            {Object.entries(el.props)
              .map(([k, v]) => `${k}: ${String(v)}`)
              .join(' / ')}
          </div>
        </Row>
      )}
      <div className="btn-row">
        <button onClick={onDelete}>削除</button>
      </div>
    </div>
  );
}

function WireProps({ diagram, wire, onDelete }: { diagram: Diagram; wire: Wire; onDelete: () => void }) {
  const dispatch = useDispatch();
  const patch = (p: Partial<Wire>) => dispatch({ type: 'UPDATE_WIRE', diagramId: diagram.id, id: wire.id, patch: p });
  const endLabel = (e: Wire['from']) => ('elementId' in e ? `${e.elementId} : ${e.portId}` : `(${e.x}, ${e.y})`);
  return (
    <div className="props">
      <h3>配線</h3>
      <Row label="線種">
        <SelectField value={wire.style} options={[{ value: 'normal', label: '通常' }, { value: 'bus', label: '母線（太線）' }]} onChange={(v) => patch({ style: v })} />
      </Row>
      <Row label="経路">
        {wire.manual ? (
          <button onClick={() => patch({ manual: false })}>自動配線に戻す</button>
        ) : (
          <span className="muted">自動</span>
        )}
      </Row>
      <Row label="始点">
        <span className="muted small">{endLabel(wire.from)}</span>
      </Row>
      <Row label="終点">
        <span className="muted small">{endLabel(wire.to)}</span>
      </Row>
      <div className="btn-row">
        <button onClick={onDelete}>削除</button>
      </div>
    </div>
  );
}

function TextProps({ diagram, text, onDelete }: { diagram: Diagram; text: TextItem; onDelete: () => void }) {
  const dispatch = useDispatch();
  const patch = (p: Partial<TextItem>) => dispatch({ type: 'UPDATE_TEXT', diagramId: diagram.id, id: text.id, patch: p });
  return (
    <div className="props">
      <h3>テキスト</h3>
      <Row label="文字">
        <TextField value={text.text} onCommit={(v) => patch({ text: v })} width={180} />
      </Row>
      <Row label="文字高 (mm)">
        <NumberField value={text.h} step={0.5} min={1} width={60} onCommit={(v) => patch({ h: v ?? text.h })} />
      </Row>
      <Row label="揃え">
        <SelectField value={text.anchor} options={[{ value: 'start', label: '左' }, { value: 'middle', label: '中央' }, { value: 'end', label: '右' }]} onChange={(v) => patch({ anchor: v })} />
      </Row>
      <Row label="回転">
        <SelectField value={String(text.rot ?? 0) as '0' | '90' | '270'} options={[{ value: '0', label: '0°' }, { value: '90', label: '90°' }, { value: '270', label: '270°' }]} onChange={(v) => patch({ rot: Number(v) })} />
      </Row>
      <Row label="X / Y (mm)">
        <NumberField value={text.x} step={1} width={60} onCommit={(v) => patch({ x: v ?? text.x })} />
        <NumberField value={text.y} step={1} width={60} onCommit={(v) => patch({ y: v ?? text.y })} />
      </Row>
      <div className="btn-row">
        <button onClick={onDelete}>削除</button>
      </div>
    </div>
  );
}
