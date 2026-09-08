import type { Diagram, Project } from '../model/types';
import { mergeDiagrams, regenerateAll } from '../layout';
import type { Action } from './actions';
import * as ops from './diagramOps';
import { createHistory, push, redo, replace, undo, type History } from './history';

export interface AppState {
  history: History<Project>;
  /** ドラッグ開始時のスナップショット（プレビュー中のみ） */
  previewBase: Project | null;
  warnings: string[];
}

export function initialState(project: Project): AppState {
  return { history: createHistory(project), previewBase: null, warnings: [] };
}

/** 仕様変更 → 生成済み図面を stale にする */
function markStale(p: Project): Project {
  return { ...p, diagrams: p.diagrams.map((d) => (d.stale ? d : { ...d, stale: true })) };
}

function withDiagram(p: Project, id: string, f: (d: Diagram) => Diagram): Project {
  return { ...p, diagrams: p.diagrams.map((d) => (d.id === id ? f(d) : d)) };
}

function regenerateProject(p: Project, keepEdited: boolean): { project: Project; warnings: string[] } {
  const r = regenerateAll(p);
  return { project: { ...p, diagrams: mergeDiagrams(p.diagrams, r.diagrams, keepEdited) }, warnings: r.warnings };
}

export function reducer(state: AppState, action: Action): AppState {
  const h = state.history;
  const p = h.present;
  const commit = (next: Project, warnings = state.warnings): AppState => ({
    history: push(h, next),
    previewBase: null,
    warnings,
  });

  switch (action.type) {
    case 'LOAD_PROJECT': {
      const r = regenerateProject(action.project, true);
      return { history: createHistory(r.project), previewBase: null, warnings: r.warnings };
    }
    case 'IMPORT_NAMEPLATES': {
      // 取り込みは 1 手として履歴に積む（Undo 1 回で元に戻せる）
      const r = regenerateProject(markStale(action.project), false);
      return commit(r.project, r.warnings);
    }
    case 'SET_META':
      return commit(markStale({ ...p, meta: { ...p.meta, ...action.meta } }));
    case 'SET_HV':
      return commit(markStale({ ...p, hv: action.hv }));
    case 'UPDATE_PANEL':
      return commit(markStale({ ...p, panels: p.panels.map((x) => (x.id === action.panel.id ? action.panel : x)) }));
    case 'ADD_PANEL':
      return commit(markStale({ ...p, panels: [...p.panels, action.panel] }));
    case 'REMOVE_PANEL':
      return commit(markStale({ ...p, panels: p.panels.filter((x) => x.id !== action.id) }));
    case 'REGENERATE': {
      const r = regenerateProject(p, action.keepEdited);
      return commit(r.project, r.warnings);
    }
    case 'REGENERATE_ONE': {
      const r = regenerateAll(p);
      const d = r.diagrams.find((x) => x.id === action.diagramId);
      if (!d) return state;
      return commit(withDiagram(p, action.diagramId, () => d), r.warnings);
    }
    case 'MOVE_PREVIEW': {
      const base = state.previewBase ?? p;
      const next = withDiagram(base, action.diagramId, (d) => ops.moveItems(d, new Set(action.ids), action.dx, action.dy));
      return { ...state, history: replace(h, next), previewBase: base };
    }
    case 'MOVE_LABEL_PREVIEW': {
      const base = state.previewBase ?? p;
      const next = withDiagram(base, action.diagramId, (d) => ops.moveLabel(d, action.id, action.offset));
      return { ...state, history: replace(h, next), previewBase: base };
    }
    case 'COMMIT_PREVIEW': {
      if (!state.previewBase) return state;
      if (state.previewBase === p) return { ...state, previewBase: null };
      return { history: push({ ...h, present: state.previewBase }, p), previewBase: null, warnings: state.warnings };
    }
    case 'CANCEL_PREVIEW': {
      if (!state.previewBase) return state;
      return { ...state, history: replace(h, state.previewBase), previewBase: null };
    }
    case 'UPDATE_ELEMENT':
      return commit(withDiagram(p, action.diagramId, (d) => ops.updateElement(d, action.id, action.patch)));
    case 'ADD_ELEMENT':
      return commit(withDiagram(p, action.diagramId, (d) => ops.addElement(d, action.element)));
    case 'ADD_WIRE':
      return commit(withDiagram(p, action.diagramId, (d) => ops.addWire(d, action.wire)));
    case 'UPDATE_WIRE':
      return commit(withDiagram(p, action.diagramId, (d) => ops.updateWire(d, action.id, action.patch)));
    case 'ADD_TEXT':
      return commit(withDiagram(p, action.diagramId, (d) => ops.addText(d, action.text)));
    case 'UPDATE_TEXT':
      return commit(withDiagram(p, action.diagramId, (d) => ops.updateText(d, action.id, action.patch)));
    case 'DELETE_ITEMS':
      return commit(withDiagram(p, action.diagramId, (d) => ops.deleteItems(d, new Set(action.ids))));
    case 'ALIGN_ITEMS':
      return commit(withDiagram(p, action.diagramId, (d) => ops.alignItems(d, new Set(action.ids), action.mode)));
    case 'UNDO':
      return { ...state, history: undo(h), previewBase: null };
    case 'REDO':
      return { ...state, history: redo(h), previewBase: null };
  }
}
