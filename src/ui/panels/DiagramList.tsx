import type { Diagram } from '../../model/types';
import { useDispatch } from '../../state/context';

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
    if (anyEdited && !confirm('手動編集した図面も再生成すると編集内容は失われます。続行しますか？')) {
      dispatch({ type: 'REGENERATE', keepEdited: true });
      return;
    }
    dispatch({ type: 'REGENERATE', keepEdited: false });
  };
  return (
    <div className="diagram-list">
      <div className="diagram-list-head">
        <strong>図面一覧</strong>
        <button className={anyStale ? 'primary' : ''} onClick={regenAll} title="仕様から全図面を再生成">
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
