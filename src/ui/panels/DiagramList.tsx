import type { Diagram } from '../../model/types';
import { useDispatch } from '../../state/context';

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
}: {
  diagrams: Diagram[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  const dispatch = useDispatch();
  const anyStale = diagrams.some((d) => d.stale);
  const anyEdited = diagrams.some((d) => d.edited);
  const regenAll = () => {
    if (anyEdited && !confirm(REGEN_CONFIRM)) return;
    dispatch({ type: 'REGENERATE' });
  };
  return (
    <div className="diagram-list">
      <div className="diagram-list-head">
        <strong>図面一覧</strong>
        <button className={anyStale ? 'primary' : ''} onClick={regenAll} title={REGEN_TITLE}>
          全て再生成
        </button>
      </div>
      {diagrams.length === 0 && <p className="muted">図面がありません。仕様を入力して再生成してください。</p>}
      <ul>
        {diagrams.map((d) => (
          <li key={d.id} className={d.id === activeId ? 'active' : ''}>
            <button className="link" onClick={() => onSelect(d.id)}>
              {d.title}
              {d.pageCount ? ` (${d.page}/${d.pageCount})` : ''}
            </button>
            <span className="badges">
              {d.stale && <span className="badge stale" title="仕様変更後に未再生成">要更新</span>}
              {d.edited && <span className="badge edited" title="手動編集あり">編集済</span>}
            </span>
            <button
              className="small"
              title="この図面を再生成"
              onClick={() => {
                if (d.edited && !confirm('手動編集内容は失われます。再生成しますか？')) return;
                dispatch({ type: 'REGENERATE_ONE', diagramId: d.id });
              }}
            >
              ↻
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
