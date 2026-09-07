import { useEffect, useState } from 'react';
import type { Project } from '../model/types';
import type { AppState } from '../state/reducer';
import { canRedo, canUndo } from '../state/history';
import { useDispatch } from '../state/context';
import { newId } from '../model/ids';
import { createEmptyProject, defaultCircuit, defaultPanel, sampleProject } from '../model/defaults';
import { FILE_EXT, parse, serialize } from '../model/project';
import { downloadBlob, pickFile, readFileAsText, safeFileName } from '../export/download';
import { titleInfoFromMeta } from '../layout/sheet';
import { ProjectMetaForm } from './forms/ProjectMetaForm';
import { HvForm } from './forms/HvForm';
import { LvPanelForm } from './forms/LvPanelForm';
import { DiagramList } from './panels/DiagramList';
import { Canvas } from './canvas/Canvas';

type Tab = 'spec' | 'draw' | 'export';

export function Shell({ state }: { state: AppState }) {
  const dispatch = useDispatch();
  const project = state.history.present;
  const [tab, setTab] = useState<Tab>('spec');
  const [specNav, setSpecNav] = useState<string>('meta');
  const [activeDiagramId, setActiveDiagramId] = useState<string>(project.diagrams[0]?.id ?? '');
  const [message, setMessage] = useState<string>('');

  useEffect(() => {
    if (!project.diagrams.some((d) => d.id === activeDiagramId)) setActiveDiagramId(project.diagrams[0]?.id ?? '');
  }, [project.diagrams, activeDiagramId]);

  const anyStale = project.diagrams.some((d) => d.stale);

  const loadProject = (p: Project) => dispatch({ type: 'LOAD_PROJECT', project: p });

  const onNew = (kind: 'empty' | 'sample') => {
    if (!confirm('現在の内容を破棄して新規作成しますか？（自動保存も上書きされます）')) return;
    loadProject(kind === 'empty' ? createEmptyProject() : sampleProject());
    setSpecNav('meta');
  };
  const onOpen = async () => {
    const f = await pickFile('.json,application/json');
    if (!f) return;
    try {
      loadProject(parse(await readFileAsText(f)));
      setMessage(`読み込みました: ${f.name}`);
    } catch (e) {
      alert(`読み込みに失敗しました: ${(e as Error).message}`);
    }
  };
  const onSave = () => {
    downloadBlob(`${safeFileName(project.meta.name)}${FILE_EXT}`, serialize(project), 'application/json');
  };
  const addPanel = () => {
    const n = project.panels.length + 1;
    const panel = { ...defaultPanel(newId('panel'), `L-${n}`), circuits: [defaultCircuit(1), defaultCircuit(2)] };
    dispatch({ type: 'ADD_PANEL', panel });
    setSpecNav(panel.id);
  };

  const active = project.diagrams.find((d) => d.id === activeDiagramId);

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>電気図面作成</h1>
        <nav className="tabs">
          {(
            [
              ['spec', '仕様入力'],
              ['draw', '図面'],
              ['export', '出力'],
            ] as const
          ).map(([k, label]) => (
            <button key={k} className={tab === k ? 'tab active' : 'tab'} onClick={() => setTab(k)}>
              {label}
            </button>
          ))}
        </nav>
        <div className="toolbar">
          <button onClick={() => onNew('empty')}>新規</button>
          <button onClick={() => onNew('sample')}>サンプル</button>
          <button onClick={onOpen}>開く</button>
          <button onClick={onSave}>保存 (JSON)</button>
          <span className="sep" />
          <button disabled={!canUndo(state.history)} onClick={() => dispatch({ type: 'UNDO' })} title="Ctrl+Z">
            元に戻す
          </button>
          <button disabled={!canRedo(state.history)} onClick={() => dispatch({ type: 'REDO' })} title="Ctrl+Y">
            やり直す
          </button>
          <span className="sep" />
          <button
            className={anyStale ? 'primary' : ''}
            onClick={() => dispatch({ type: 'REGENERATE', keepEdited: true })}
            title="仕様から図面を再生成（手動編集済みの図面は保持）"
          >
            図面を再生成{anyStale ? ' *' : ''}
          </button>
        </div>
        {message && <div className="message">{message}</div>}
        {state.warnings.length > 0 && <div className="warnings" title={state.warnings.join('\n')}>{state.warnings[0]}{state.warnings.length > 1 ? ` 他${state.warnings.length - 1}件` : ''}</div>}
      </header>

      {tab === 'spec' && (
        <main className="app-main spec">
          <aside className="spec-nav">
            <button className={specNav === 'meta' ? 'active' : ''} onClick={() => setSpecNav('meta')}>プロジェクト情報</button>
            <button className={specNav === 'hv' ? 'active' : ''} onClick={() => setSpecNav('hv')}>高圧受電設備</button>
            <div className="spec-nav-group">分電盤</div>
            {project.panels.map((p) => (
              <button key={p.id} className={specNav === p.id ? 'active sub' : 'sub'} onClick={() => setSpecNav(p.id)}>
                {p.name}
              </button>
            ))}
            <button className="sub add" onClick={addPanel}>+ 分電盤を追加</button>
          </aside>
          <div className="spec-body">
            {specNav === 'meta' && <ProjectMetaForm meta={project.meta} />}
            {specNav === 'hv' && <HvForm hv={project.hv} panels={project.panels} />}
            {project.panels
              .filter((p) => p.id === specNav)
              .map((p) => (
                <LvPanelForm key={p.id} panel={p} transformers={project.hv.transformers} />
              ))}
          </div>
        </main>
      )}

      {tab === 'draw' && (
        <main className="app-main draw">
          <aside className="side left">
            <DiagramList diagrams={project.diagrams} activeId={activeDiagramId} onSelect={setActiveDiagramId} />
          </aside>
          {active ? (
            <Canvas key={active.id} diagram={active} title={titleInfoFromMeta(project.meta, active.title, active.page, active.pageCount)} />
          ) : (
            <div className="empty">図面がありません</div>
          )}
        </main>
      )}

      {tab === 'export' && (
        <main className="app-main export">
          <p className="muted">出力機能は次の段階で追加します。</p>
        </main>
      )}
    </div>
  );
}
