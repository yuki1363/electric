import { useEffect, useMemo, useReducer } from 'react';
import { SymbolGallery } from './ui/SymbolGallery';
import { Shell } from './ui/Shell';
import { sampleProject } from './model/defaults';
import { regenerateAll } from './layout';
import { initialState, reducer } from './state/reducer';
import { DispatchContext } from './state/context';
import { createAutosaver, loadLocal } from './state/autosave';
import type { Project } from './model/types';

function init(): ReturnType<typeof initialState> {
  const restored = loadLocal();
  const project: Project = restored ?? sampleProject();
  const r = regenerateAll(project);
  // 復元時は手動編集済みの図面を保持
  const diagrams = r.diagrams.map((d) => {
    const old = project.diagrams.find((e) => e.id === d.id);
    return old && old.edited ? old : d;
  });
  const s = initialState({ ...project, diagrams });
  return { ...s, warnings: r.warnings };
}

export function App() {
  if (new URLSearchParams(location.search).has('gallery')) {
    return <SymbolGallery />;
  }
  return <Editor />;
}

function Editor() {
  const [state, dispatch] = useReducer(reducer, undefined, init);
  const autosave = useMemo(() => createAutosaver(500), []);
  const project = state.history.present;

  useEffect(() => {
    if (!state.previewBase) autosave(project);
  }, [project, state.previewBase, autosave]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        dispatch({ type: e.shiftKey ? 'REDO' : 'UNDO' });
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        dispatch({ type: 'REDO' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <DispatchContext.Provider value={dispatch}>
      <Shell state={state} />
    </DispatchContext.Provider>
  );
}
