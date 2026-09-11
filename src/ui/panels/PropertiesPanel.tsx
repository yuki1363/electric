import { useEffect, useState, type ReactNode } from 'react';
import type { Diagram, Element, Nameplate, TextItem, Wire } from '../../model/types';
import type { Rot } from '../../symbols/transform';
import { getSymbol } from '../../symbols';
import { useDispatch } from '../../state/context';
import { MAX_ITEM_SCALE, MIN_ITEM_SCALE, copyItems, itemScale, type AlignMode, type Clipboard } from '../../state/diagramOps';
import { NumberField, Row, SelectField, TextField } from '../fields';
import { NameplateDisclosure } from '../forms/NameplateFields';

export function PropertiesPanel({
  diagram,
  selection,
  onSelectionChange,
  autoGenerate = true,
  clipboard = null,
  onClipboardChange,
  snapStep = 1,
}: {
  diagram: Diagram;
  selection: string[];
  onSelectionChange: (ids: string[]) => void;
  /** false のときは図面が正なので、どの機器にも銘板を入力できる */
  autoGenerate?: boolean;
  /** コピーした中身（図面をまたいで貼り付けられる） */
  clipboard?: Clipboard | null;
  onClipboardChange?: (c: Clipboard | null) => void;
  /** 複製・貼り付けのずらし量を決めるスナップ刻み */
  snapStep?: number;
}) {
  const dispatch = useDispatch();
  const del = () => {
    dispatch({ type: 'DELETE_ITEMS', diagramId: diagram.id, ids: selection });
    onSelectionChange([]);
  };
  /** 元の上に重ねないためのずらし量 */
  const offset = Math.max(snapStep, 2) * 3;
  const duplicate = () =>
    dispatch({ type: 'DUPLICATE_ITEMS', diagramId: diagram.id, ids: selection, dx: offset, dy: offset });
  const copy = () => onClipboardChange?.(copyItems(diagram, new Set(selection)));
  const paste = () => {
    if (!clipboard) return;
    const at = { x: clipboard.origin.x + offset, y: clipboard.origin.y + offset };
    dispatch({ type: 'PASTE_ITEMS', diagramId: diagram.id, clip: clipboard, at });
  };
  const clipCount = clipboard
    ? clipboard.elements.length + clipboard.wires.length + clipboard.texts.length
    : 0;
  const pasteButton = clipCount > 0 && (
    <button onClick={paste} title="コピーした中身をこの図面に貼り付ける (Ctrl+V)">
      貼り付け（{clipCount}）
    </button>
  );
  /** 選択しているものへの操作。複製はその場、コピーはほかの図面にも貼れる */
  const actions = (
    <div className="btn-row">
      <button onClick={duplicate} title="同じものをすぐ横に作る (Ctrl+D)">複製</button>
      <button onClick={copy} title="コピーする。ほかの図面にも貼り付けられます (Ctrl+C)">コピー</button>
      {pasteButton}
      <button onClick={del} title="削除 (Delete)">削除</button>
    </div>
  );

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
        <p className="muted">
          <b>コピー</b>は図記号を選ぶと右の欄に出ます（Shift+クリックでまとめて選べます）。
          Ctrl+D 複製 / Ctrl+C・V コピー＆貼り付け（図面をまたげます） / Ctrl+X 切り取り
        </p>
        {clipCount > 0 && <div className="btn-row">{pasteButton}</div>}
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
    const elIds = diagram.elements.filter((e) => selection.includes(e.id)).map((e) => e.id);
    const scaleBy = (mul: number) => dispatch({ type: 'SCALE_ITEMS', diagramId: diagram.id, ids: elIds, mul });
    const scaleTo = (scale: number) => dispatch({ type: 'SET_ITEM_SCALE', diagramId: diagram.id, ids: elIds, scale });
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
        <div className="align-group">
          <div className="muted">大きさを変える（図記号だけ）</div>
          <div className="btn-row">
            <button disabled={nEl === 0} onClick={() => scaleBy(1 / 1.25)} title="1 段小さくする">－ 小さく</button>
            <button disabled={nEl === 0} onClick={() => scaleBy(1.25)} title="1 段大きくする">＋ 大きく</button>
            <button disabled={nEl === 0} onClick={() => scaleTo(1)} title="まわりの機器と同じ大きさに戻す">等倍</button>
          </div>
        </div>
        {actions}
        <p className="muted">
          複製・コピーは選んだ図記号・配線・文字をまとめて写します。
          整列と大きさは図記号だけが動きます。つながっている配線は自動で引き直します。
        </p>
      </div>
    );
  }

  const id = selection[0]!;
  const el = diagram.elements.find((e) => e.id === id);
  if (el)
    return (
      <ElementProps
        diagram={diagram}
        el={el}
        actions={actions}
        canEditNameplate={canEditNameplate(diagram, el, autoGenerate)}
        nameplateHint={
          autoGenerate
            ? '入力すると機器銘板表に 1 行として出ます（図面を再生成すると表に反映されます）'
            : '入力すると機器銘板表に 1 行として出ます（図面一覧の「銘板表を更新」で反映されます）'
        }
      />
    );
  const w = diagram.wires.find((x) => x.id === id);
  if (w) return <WireProps diagram={diagram} wire={w} actions={actions} />;
  const t = diagram.texts.find((x) => x.id === id);
  if (t) return <TextProps diagram={diagram} text={t} actions={actions} />;
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

/** 空欄だけの銘板は持たない（触っただけで「要更新」が点かないように） */
function cleanNameplate(np: Nameplate): Nameplate | undefined {
  const out = Object.fromEntries(Object.entries(np).filter(([, v]) => v !== undefined && v !== ''));
  return Object.keys(out).length > 0 ? (out as Nameplate) : undefined;
}

/**
 * 銘板を図面側で入力してよい機器か。
 * 自動作図の機器は仕様側に銘板があるので二重にしない。ただし自動作図を切っているときと
 * 仕様に紐づかない図面（白紙・写し）では、図面が正なのでどれでも入力できる。
 */
function canEditNameplate(d: Diagram, el: Element, autoGenerate: boolean): boolean {
  return !autoGenerate || d.kind === 'free' || el.origin === 'manual';
}

function ElementProps({
  diagram,
  el,
  actions,
  canEditNameplate: canEdit,
  nameplateHint,
}: {
  diagram: Diagram;
  el: Element;
  /** 複製・コピー・削除のボタン列 */
  actions: ReactNode;
  canEditNameplate: boolean;
  /** 銘板欄の見出し。反映のしかたは自動作図の入切で変わる */
  nameplateHint: string;
}) {
  const dispatch = useDispatch();
  const def = getSymbol(el.kind);
  const patch = (p: Partial<Element>) => dispatch({ type: 'UPDATE_ELEMENT', diagramId: diagram.id, id: el.id, patch: p });
  /** 図面の縮尺を 1 とした、この図記号の見た目の倍率 */
  const size = itemScale(diagram, el);
  const scaleBy = (mul: number) => dispatch({ type: 'SCALE_ITEMS', diagramId: diagram.id, ids: [el.id], mul });
  const scaleTo = (scale: number) => dispatch({ type: 'SET_ITEM_SCALE', diagramId: diagram.id, ids: [el.id], scale });
  return (
    <div className="props">
      <h3>{def.nameJa}</h3>
      <Row label="X / Y (mm)">
        <NumberField value={el.x} step={1} width={60} onCommit={(v) => patch({ x: v ?? el.x })} />
        <NumberField value={el.y} step={1} width={60} onCommit={(v) => patch({ y: v ?? el.y })} />
      </Row>
      <Row label="回転">
        {([0, 90, 180, 270] as Rot[]).map((r) => (
          <button key={r} className={el.rot === r ? 'active' : ''} onClick={() => patch({ rot: r })}>
            {r}°
          </button>
        ))}
      </Row>
      <Row label="大きさ">
        <button onClick={() => scaleBy(1 / 1.25)} title="1 段小さくする">－</button>
        <NumberField
          value={Math.round(size * 100)}
          width={64}
          min={Math.round(MIN_ITEM_SCALE * 100)}
          max={Math.round(MAX_ITEM_SCALE * 100)}
          step={10}
          onCommit={(v) => scaleTo((v ?? 100) / 100)}
        />
        <span className="muted small">%</span>
        <button onClick={() => scaleBy(1.25)} title="1 段大きくする">＋</button>
        <button onClick={() => scaleTo(1)} title="まわりの機器と同じ大きさに戻す">等倍</button>
      </Row>
      <Row label="ラベル（1行=1段）">
        <LabelsEditor value={el.labels} onCommit={(labels) => patch({ labels })} />
      </Row>
      {el.labelOffset && (
        <Row label="ラベル位置">
          <button onClick={() => patch({ labelOffset: undefined })}>既定位置に戻す</button>
        </Row>
      )}
      {canEdit ? (
        <>
          <Row label="銘板の機器名称">
            <TextField
              value={el.nameplateName ?? ''}
              width={140}
              onCommit={(v) => patch({ nameplateName: v || undefined })}
            />
            <span className="muted small">空なら「{def.nameJa}」</span>
          </Row>
          <NameplateDisclosure
            label={nameplateHint}
            value={el.nameplate}
            onChange={(np) => patch({ nameplate: cleanNameplate(np) })}
          />
          {el.nameplate?.model && !el.labels.includes(el.nameplate.model) && (
            <div className="btn-row">
              <button onClick={() => patch({ labels: [...el.labels, el.nameplate!.model!] })}>型式をラベルに追加</button>
            </div>
          )}
        </>
      ) : (
        <p className="muted small">
          自動作図した機器です。銘板は「仕様入力」タブで入力してください（二重に出さないため）。
        </p>
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
      {actions}
    </div>
  );
}

function WireProps({ diagram, wire, actions }: { diagram: Diagram; wire: Wire; actions: ReactNode }) {
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
      {actions}
    </div>
  );
}

function TextProps({ diagram, text, actions }: { diagram: Diagram; text: TextItem; actions: ReactNode }) {
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
      {actions}
    </div>
  );
}
