export interface History<T> {
  past: T[];
  present: T;
  future: T[];
}

export const MAX_HISTORY = 100;

export const createHistory = <T>(present: T): History<T> => ({ past: [], present, future: [] });

/** 新しい状態を履歴に積む */
export function push<T>(h: History<T>, next: T): History<T> {
  if (next === h.present) return h;
  const past = [...h.past, h.present];
  if (past.length > MAX_HISTORY) past.splice(0, past.length - MAX_HISTORY);
  return { past, present: next, future: [] };
}

/** 履歴に積まずに現在値を差し替える（プレビュー用） */
export function replace<T>(h: History<T>, next: T): History<T> {
  return { ...h, present: next };
}

export function undo<T>(h: History<T>): History<T> {
  const prev = h.past[h.past.length - 1];
  if (prev === undefined) return h;
  return { past: h.past.slice(0, -1), present: prev, future: [h.present, ...h.future] };
}

export function redo<T>(h: History<T>): History<T> {
  const next = h.future[0];
  if (next === undefined) return h;
  return { past: [...h.past, h.present], present: next, future: h.future.slice(1) };
}

export const canUndo = <T>(h: History<T>): boolean => h.past.length > 0;
export const canRedo = <T>(h: History<T>): boolean => h.future.length > 0;
