import type { Point } from '../symbols/types';
import type { AlignMode } from './diagramOps';
import type { Element, HvSpec, LvPanelSpec, Project, ProjectMeta, TextItem, Wire } from '../model/types';

export type Action =
  | { type: 'LOAD_PROJECT'; project: Project }
  | { type: 'IMPORT_NAMEPLATES'; project: Project }
  | { type: 'SET_META'; meta: Partial<ProjectMeta> }
  | { type: 'SET_HV'; hv: HvSpec }
  | { type: 'UPDATE_PANEL'; panel: LvPanelSpec }
  | { type: 'ADD_PANEL'; panel: LvPanelSpec }
  | { type: 'REMOVE_PANEL'; id: string }
  | { type: 'REGENERATE'; keepEdited: boolean }
  | { type: 'REGENERATE_ONE'; diagramId: string }
  // 図面編集
  | { type: 'MOVE_PREVIEW'; diagramId: string; ids: string[]; dx: number; dy: number }
  | { type: 'MOVE_LABEL_PREVIEW'; diagramId: string; id: string; offset: Point }
  | { type: 'COMMIT_PREVIEW' }
  | { type: 'CANCEL_PREVIEW' }
  | { type: 'UPDATE_ELEMENT'; diagramId: string; id: string; patch: Partial<Element> }
  | { type: 'ADD_ELEMENT'; diagramId: string; element: Element }
  | { type: 'INSERT_INTO_WIRE'; diagramId: string; wireId: string; element: Element }
  | { type: 'ADD_WIRE'; diagramId: string; wire: Wire }
  | { type: 'UPDATE_WIRE'; diagramId: string; id: string; patch: Partial<Wire> }
  | { type: 'ADD_TEXT'; diagramId: string; text: TextItem }
  | { type: 'UPDATE_TEXT'; diagramId: string; id: string; patch: Partial<TextItem> }
  | { type: 'DELETE_ITEMS'; diagramId: string; ids: string[] }
  | { type: 'ALIGN_ITEMS'; diagramId: string; ids: string[]; mode: AlignMode }
  | { type: 'DISTRIBUTE_ITEMS'; diagramId: string; ids: string[]; axis: 'x' | 'y' }
  | { type: 'UNDO' }
  | { type: 'REDO' };
