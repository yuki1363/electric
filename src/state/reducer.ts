import type { Diagram, Project } from '../model/types';
import { regenerateAll, regenerateNameplateOnly } from '../layout';
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

/** 自動作図が有効か（既定 true）。false のときは仕様から図面を作らない */
export const autoGenerates = (p: Project): boolean => p.meta.autoGenerate !== false;

/**
 * 仕様変更 → 生成済み図面を stale にする。
 * 自動作図を切っているときは単線結線図を作り直さないので、機器銘板表だけに印を付ける。
 */
function markStale(p: Project): Project {
  const all = autoGenerates(p);
  return {
    ...p,
    diagrams: p.diagrams.map((d) => (d.stale || (!all && d.kind !== 'nameplate') ? d : { ...d, stale: true })),
  };
}

function withDiagram(p: Project, id: string, f: (d: Diagram) => Diagram): Project {
  return { ...p, diagrams: p.diagrams.map((d) => (d.id === id ? f(d) : d)) };
}

/** 仕様に紐づかない白紙の図面 */
function blankDiagram(p: Project, id: string, title: string): Diagram {
  return {
    id,
    kind: 'free',
    title,
    sheet: p.meta.sheet,
    elements: [],
    wires: [],
    texts: [],
    shapes: [],
    edited: true,
  };
}

const insertAfter = (list: Diagram[], d: Diagram, afterId?: string): Diagram[] => {
  const i = afterId ? list.findIndex((x) => x.id === afterId) : -1;
  return i < 0 ? [...list, d] : [...list.slice(0, i + 1), d, ...list.slice(i + 1)];
};

/**
 * 仕様から図面を作り直す。手で足した機器・配線・文字は regenerateAll が引き継ぐ。
 * 自動作図を切っているときは図面に触らない（決まった形に作り直す動作をやめる）。
 */
function regenerateProject(p: Project): { project: Project; warnings: string[] } {
  // 自動作図を切っていても、機器銘板表は図面に置かれた機器から作り直す
  const r = autoGenerates(p) ? regenerateAll(p) : regenerateNameplateOnly(p);
  return { project: { ...p, diagrams: r.diagrams }, warnings: r.warnings };
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
      const r = regenerateProject(action.project);
      return { history: createHistory(r.project), previewBase: null, warnings: r.warnings };
    }
    case 'IMPORT_NAMEPLATES': {
      // 取り込みは 1 手として履歴に積む（Undo 1 回で元に戻せる）
      const r = regenerateProject(markStale(action.project));
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
    case 'ADD_SUBSTATION':
      return commit(markStale({ ...p, substations: [...(p.substations ?? []), action.substation] }));
    case 'UPDATE_SUBSTATION':
      return commit(
        markStale({
          ...p,
          substations: (p.substations ?? []).map((s) => (s.id === action.substation.id ? action.substation : s)),
        }),
      );
    case 'REMOVE_SUBSTATION': {
      const next = markStale({ ...p, substations: (p.substations ?? []).filter((s) => s.id !== action.id) });
      // 図面も消す（regenerateAll は仕様から消えた図面を落とすが、free 図面は残るため明示的に）
      return commit({ ...next, diagrams: next.diagrams.filter((d) => !d.id.startsWith(`sub-${action.id}`)) });
    }
    case 'REGENERATE': {
      const r = regenerateProject(p);
      return commit(r.project, r.warnings);
    }
    case 'RELEASE_DIAGRAM':
      // 仕様から切り離す。絵はそのままで、以後は作り直しの対象にしない
      return commit({
        ...p,
        diagrams: p.diagrams.map((d) =>
          d.id === action.diagramId
            ? { ...d, kind: 'free', sourceId: undefined, page: undefined, pageCount: undefined, stale: undefined }
            : d,
        ),
      });
    case 'REGENERATE_ONE': {
      if (!autoGenerates(p)) return state;
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
    case 'WIRE_SEGMENT_PREVIEW': {
      const base = state.previewBase ?? p;
      const next = withDiagram(base, action.diagramId, (d) =>
        ops.moveWireSegment(d, action.wireId, action.index, action.delta, action.base),
      );
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
    case 'UPDATE_ELEMENT': {
      const next = withDiagram(p, action.diagramId, (d) => ops.updateElement(d, action.id, action.patch));
      // 銘板の中身が変わったときだけ機器銘板表を作り直す対象にする
      const npOf = (proj: Project) => {
        const e = proj.diagrams.find((d) => d.id === action.diagramId)?.elements.find((x) => x.id === action.id);
        return JSON.stringify([e?.nameplate ?? null, e?.nameplateName ?? null]);
      };
      return commit(npOf(p) !== npOf(next) ? markStale(next) : next);
    }
    case 'ADD_ELEMENT':
      return commit(withDiagram(p, action.diagramId, (d) => ops.addElement(d, action.element)));
    case 'INSERT_INTO_WIRE':
      return commit(withDiagram(p, action.diagramId, (d) => ops.insertIntoWire(d, action.wireId, action.element)));
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
    case 'DISTRIBUTE_ITEMS':
      return commit(withDiagram(p, action.diagramId, (d) => ops.distributeItems(d, new Set(action.ids), action.axis)));
    case 'ADD_DIAGRAM': {
      const d = blankDiagram(p, action.id, action.title);
      return commit({ ...p, diagrams: insertAfter(p.diagrams, d, action.afterId) });
    }
    case 'DUPLICATE_DIAGRAM': {
      const src = p.diagrams.find((d) => d.id === action.diagramId);
      if (!src) return state;
      // 写しは仕様から切り離す。以降は手で描く図面になる
      const copy: Diagram = {
        ...src,
        id: action.newId,
        kind: 'free',
        title: `${src.title}（写し）`,
        sourceId: undefined,
        page: undefined,
        pageCount: undefined,
        stale: undefined,
        edited: true,
      };
      return commit({ ...p, diagrams: insertAfter(p.diagrams, copy, src.id) });
    }
    case 'RENAME_DIAGRAM':
      return commit({
        ...p,
        diagrams: p.diagrams.map((d) => (d.id === action.diagramId ? { ...d, title: action.title } : d)),
      });
    case 'REMOVE_DIAGRAM':
      return commit({ ...p, diagrams: p.diagrams.filter((d) => d.id !== action.diagramId) });
    case 'DUPLICATE_ITEMS':
      return commit(
        withDiagram(p, action.diagramId, (d) => ops.duplicateItems(d, new Set(action.ids), action.dx, action.dy).diagram),
      );
    case 'PASTE_ITEMS':
      return commit(withDiagram(p, action.diagramId, (d) => ops.pasteItems(d, action.clip, action.at).diagram));
    case 'UNDO':
      return { ...state, history: undo(h), previewBase: null };
    case 'REDO':
      return { ...state, history: redo(h), previewBase: null };
  }
}
