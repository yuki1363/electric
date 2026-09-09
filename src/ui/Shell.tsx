import { useCallback, useEffect, useRef, useState } from 'react';
import type { Point, SymbolKind } from '../symbols/types';
import type { Project } from '../model/types';
import type { Tool } from './canvas/types';
import { Palette } from './panels/Palette';
import { ExportBar } from './ExportBar';
import { ImportDialog } from './ImportDialog';
import { PropertiesPanel } from './panels/PropertiesPanel';
import type { AppState } from '../state/reducer';
import { canRedo, canUndo } from '../state/history';
import { useDispatch } from '../state/context';
import { newId } from '../model/ids';
import { createEmptyProject, defaultCircuit, defaultHv, defaultPanel, sampleProject } from '../model/defaults';
import { parse, projectFileName, serialize } from '../model/project';
import { downloadBlob, pickFile, readFileAsText } from '../export/download';
import { titleInfoFromMeta } from '../layout/sheet';
import { ProjectMetaForm } from './forms/ProjectMetaForm';
import { HvForm } from './forms/HvForm';
import { LvPanelForm } from './forms/LvPanelForm';
import { SubstationForm } from './forms/SubstationForm';
import { DiagramList } from './panels/DiagramList';
import { Canvas } from './canvas/Canvas';
import { REGEN_CONFIRM, REGEN_TITLE } from './panels/DiagramList';
import type { Clipboard } from '../state/diagramOps';

type Tab = 'spec' | 'draw' | 'export';

export function Shell({ state }: { state: AppState }) {
  const dispatch = useDispatch();
  const project = state.history.present;
  const [tab, setTab] = useState<Tab>('spec');
  const [specNav, setSpecNav] = useState<string>('meta');
  const [activeDiagramId, setActiveDiagramId] = useState<string>(project.diagrams[0]?.id ?? '');
  const [message, setMessage] = useState<string>('');
  const [importing, setImporting] = useState(false);
  const [selection, setSelection] = useState<string[]>([]);
  const [tool, setTool] = useState<Tool>('select');
  /** 配置待ちの図記号（パレットで選ぶと入り、図面をクリックで置く） */
  const [pending, setPending] = useState<SymbolKind | null>(null);
  const [snapStep, setSnapStep] = useState(1);
  const [showGrid, setShowGrid] = useState(true);
  const [clipboard, setClipboard] = useState<Clipboard | null>(null);
  const viewCenter = useRef<Point>({ x: 210, y: 148 });
  const onViewChange = useCallback((c: Point) => {
    viewCenter.current = c;
  }, []);

  useEffect(() => {
    if (!project.diagrams.some((d) => d.id === activeDiagramId)) setActiveDiagramId(project.diagrams[0]?.id ?? '');
  }, [project.diagrams, activeDiagramId]);

  // 図面が差し替わったら存在しない選択を除去
  const activeForSel = project.diagrams.find((d) => d.id === activeDiagramId);
  useEffect(() => {
    if (!activeForSel || selection.length === 0) return;
    const ids = new Set([
      ...activeForSel.elements.map((e) => e.id),
      ...activeForSel.wires.map((w) => w.id),
      ...activeForSel.texts.map((t) => t.id),
    ]);
    if (selection.some((id) => !ids.has(id))) setSelection(selection.filter((id) => ids.has(id)));
  }, [activeForSel, selection]);

  const anyStale = project.diagrams.some((d) => d.stale);
  const anyEdited = project.diagrams.some((d) => d.edited);

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
    downloadBlob(projectFileName(project), serialize(project), 'application/json');
  };
  const addPanel = () => {
    const n = project.panels.length + 1;
    const panel = { ...defaultPanel(newId('panel'), `L-${n}`), circuits: [defaultCircuit(1), defaultCircuit(2)] };
    dispatch({ type: 'ADD_PANEL', panel });
    setSpecNav(panel.id);
  };
  const addSubstation = () => {
    const n = (project.substations?.length ?? 0) + 1;
    // 副変電所は受電部（引込・区分開閉器・取引用計器）を持たない
    const substation = {
      id: newId('sub'),
      name: `副変電所No.${n}`,
      hv: {
        ...defaultHv(),
        pas: { kind: 'none' as const, sog: false, ratedA: 300 },
        vct: false,
        transformers: [],
        capacitors: [],
        feeders: [],
      },
    };
    dispatch({ type: 'ADD_SUBSTATION', substation });
    setSpecNav(substation.id);
  };
  const substations = project.substations ?? [];

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
          <button onClick={() => setImporting(true)} title="機器銘板表の Excel / CSV から設備を取り込む">
            Excel 取り込み
          </button>
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
            onClick={() => {
              if (anyEdited && !confirm(REGEN_CONFIRM)) return;
              dispatch({ type: 'REGENERATE' });
            }}
            title={REGEN_TITLE}
          >
            図面を再生成{anyStale ? ' *' : ''}
          </button>
        </div>
        {message && <div className="message">{message}</div>}
        {state.warnings.length > 0 && <div className="warnings" title={state.warnings.join('\n')}>{state.warnings[0]}{state.warnings.length > 1 ? ` 他${state.warnings.length - 1}件` : ''}</div>}
      </header>

      {importing && <ImportDialog project={project} onClose={() => setImporting(false)} />}

      {tab === 'spec' && (
        <main className="app-main spec">
          <aside className="spec-nav">
            <button className={specNav === 'meta' ? 'active' : ''} onClick={() => setSpecNav('meta')}>プロジェクト情報</button>
            <button className={specNav === 'hv' ? 'active' : ''} onClick={() => setSpecNav('hv')}>高圧受電設備</button>
            <div className="spec-nav-group">副変電所（送りの先）</div>
            {substations.map((s) => (
              <button key={s.id} className={specNav === s.id ? 'active sub' : 'sub'} onClick={() => setSpecNav(s.id)}>
                {s.name}
              </button>
            ))}
            <button className="sub add" onClick={addSubstation}>+ 副変電所を追加</button>
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
            {substations
              .filter((s) => s.id === specNav)
              .map((s) => (
                <SubstationForm key={s.id} substation={s} feeders={project.hv.feeders} panels={project.panels} />
              ))}
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
            <DiagramList
              diagrams={project.diagrams}
              activeId={activeDiagramId}
              onSelect={(id) => {
                setActiveDiagramId(id);
                setSelection([]);
              }}
            />
            {active && (
              <Palette tool={tool} onToolChange={setTool} pending={pending} onPendingChange={setPending} />
            )}
          </aside>
          {active ? (
            <Canvas
              key={active.id}
              diagram={active}
              title={titleInfoFromMeta(project.meta, active.title, active.page, active.pageCount, active.scale)}
              selection={selection}
              onSelectionChange={setSelection}
              tool={tool}
              onToolChange={setTool}
              pending={pending}
              onPendingChange={setPending}
              onViewChange={onViewChange}
              snapStep={snapStep}
              onSnapStepChange={setSnapStep}
              showGrid={showGrid}
              onShowGridChange={setShowGrid}
              clipboard={clipboard}
              onClipboardChange={setClipboard}
            />
          ) : (
            <div className="empty">図面がありません</div>
          )}
          {active && (
            <aside className="side right">
              <PropertiesPanel diagram={active} selection={selection} onSelectionChange={setSelection} />
            </aside>
          )}
        </main>
      )}

      {tab === 'export' && (
        <main className="app-main export">
          <ExportBar project={project} />
        </main>
      )}
    </div>
  );
}
