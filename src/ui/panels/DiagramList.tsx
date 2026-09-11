import type { Diagram } from '../../model/types';
import { useDispatch } from '../../state/context';
import { newId } from '../../model/ids';

export const REGEN_TITLE =
  '仕様から全図面を作り直します（手で足した機器・配線・文字、銘板、ラベル位置、手直しした配線経路は残ります）';

export const REGEN_CONFIRM =
  '仕様から図面を作り直します。\n\n' +
  '残るもの: 手で足した機器・配線・文字、入力した銘板、動かしたラベル、手直しした配線の経路\n' +
  '戻るもの: 自動作図した機器の位置・向き・ラベル\n\n' +
  '元に戻す (Ctrl+Z) で 1 回で取り消せます。続けますか？';

export function DiagramList({
  diagrams,
  activeId,
  onSelect,
  autoGenerate = true,
  removedCount = 0,
}: {
  diagrams: Diagram[];
  activeId: string;
  onSelect: (id: string) => void;
  /** false のときは自動作図の操作（再生成）を出さない */
  autoGenerate?: boolean;
  /** ✕ で消した、仕様から作る図面の枚数 */
  removedCount?: number;
}) {
  const dispatch = useDispatch();
  const anyStale = diagrams.some((d) => d.stale);
  const anyEdited = diagrams.some((d) => d.edited);
  /** どの図面も消せる。仕様から作る図面は、消したことを覚えて作り直しでも戻さない */
  const removeDiagram = (d: Diagram) => {
    const msg =
      d.kind === 'free'
        ? `「${d.title}」を削除します。よろしいですか？`
        : `「${d.title}」を削除します。\n\n` +
          '仕様から作る図面ですが、作り直しても戻しません。\n' +
          '戻すときは図面一覧の「消した図面を戻す」を押してください（Ctrl+Z でも取り消せます）。\n\n' +
          '削除しますか？';
    if (confirm(msg)) dispatch({ type: 'REMOVE_DIAGRAM', diagramId: d.id });
  };
  const restoreRemoved = () => {
    if (!confirm(`✕ で消した図面 ${removedCount} 枚を、仕様から作り直せるように戻します。よろしいですか？`)) return;
    dispatch({ type: 'RESTORE_REMOVED_DIAGRAMS' });
  };
  const regenAll = () => {
    // 自動作図を切っているときは銘板表しか作り直さないので、確認は要らない
    if (autoGenerate && anyEdited && !confirm(REGEN_CONFIRM)) return;
    dispatch({ type: 'REGENERATE' });
  };
  return (
    <div className="diagram-list">
      <div className="diagram-list-head">
        <strong>図面一覧</strong>
        <button
          title="仕様に紐づかない白紙の図面を足す（作り直しの対象にならない）"
          onClick={() => {
            // 足した図面をそのまま開く（前の図面に描いてしまわないように）
            const id = newId('dg');
            dispatch({ type: 'ADD_DIAGRAM', id, title: `図面 ${diagrams.length + 1}`, afterId: activeId });
            onSelect(id);
          }}
        >
          + 白紙
        </button>
        <button
          className={anyStale ? 'primary' : ''}
          onClick={regenAll}
          title={
            autoGenerate
              ? REGEN_TITLE
              : '図面に置かれた機器の銘板から、機器銘板表を作り直します（単線結線図には触りません）'
          }
        >
          {autoGenerate ? '全て再生成' : '銘板表を更新'}
        </button>
      </div>
      {removedCount > 0 && (
        <div className="diagram-list-note">
          <span className="muted small">消した図面 {removedCount} 枚</span>
          <button className="small" title="✕ で消した図面を、もう一度 仕様から作れるようにします" onClick={restoreRemoved}>
            戻す
          </button>
        </div>
      )}
      {diagrams.length === 0 && (
        <p className="muted">
          図面がありません。{autoGenerate ? '仕様を入力して再生成するか、' : ''}「+ 白紙」で描き始めてください。
        </p>
      )}
      <ul>
        {diagrams.map((d) => (
          <li key={d.id} className={d.id === activeId ? 'active' : ''}>
            <button className="link" onClick={() => onSelect(d.id)}>
              {d.title}
              {d.pageCount ? ` (${d.page}/${d.pageCount})` : ''}
            </button>
            <span className="badges">
              {d.kind === 'free' && <span className="badge free" title="仕様に紐づかない図面">手描き</span>}
              {d.stale && <span className="badge stale" title="仕様変更後に未再生成">要更新</span>}
              {d.edited && d.kind !== 'free' && <span className="badge edited" title="手動編集あり">編集済</span>}
            </span>
            <button
              className="small"
              title="この図面を複製する（写しは仕様から切り離され、自由に描ける）"
              onClick={() => {
                const id = newId('dg');
                dispatch({ type: 'DUPLICATE_DIAGRAM', diagramId: d.id, newId: id });
                onSelect(id);
              }}
            >
              ⧉
            </button>
            <button
              className="small"
              title="名前を変える"
              onClick={() => {
                const t = prompt('図面名', d.title);
                if (t && t !== d.title) dispatch({ type: 'RENAME_DIAGRAM', diagramId: d.id, title: t });
              }}
            >
              ✎
            </button>
            {d.kind !== 'free' && (
              <button
                className="small"
                title="この図面を仕様から切り離す（絵はそのまま。以後 作り直しの対象になりません）"
                onClick={() => dispatch({ type: 'RELEASE_DIAGRAM', diagramId: d.id })}
              >
                ⛓
              </button>
            )}
            {d.kind !== 'free' && autoGenerate && (
              <button
                className="small"
                title="この図面だけ仕様から作り直す（手で足したものは残ります）"
                onClick={() => dispatch({ type: 'REGENERATE_ONE', diagramId: d.id })}
              >
                ↻
              </button>
            )}
            <button className="small" title="この図面を削除する" onClick={() => removeDiagram(d)}>
              ✕
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
