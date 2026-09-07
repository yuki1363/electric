import type { Project } from '../model/types';
import { parse, serialize } from '../model/project';

export const STORAGE_KEY = 'elec-dwg:v1';

export function saveLocal(project: Project): void {
  try {
    localStorage.setItem(STORAGE_KEY, serialize(project));
  } catch {
    /* 容量超過・プライベートモードなどは無視 */
  }
}

export function loadLocal(): Project | null {
  try {
    const text = localStorage.getItem(STORAGE_KEY);
    return text ? parse(text) : null;
  } catch {
    return null;
  }
}

export function clearLocal(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** デバウンス付き保存関数を作る */
export function createAutosaver(delayMs = 500): (p: Project) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (p) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => saveLocal(p), delayMs);
  };
}
