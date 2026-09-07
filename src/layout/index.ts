import type { Diagram, Project } from '../model/types';
import { generateHvSld } from './hvSld';
import { generateLvSld } from './lvSld';
import { generateLvFace } from './lvFace';
import { generateLvSchedule } from './lvSchedule';
import type { GenResult } from './types';

export interface RegenerateResult {
  diagrams: Diagram[];
  warnings: string[];
}

/** 仕様から全図面を生成する */
export function regenerateAll(project: Project): RegenerateResult {
  const results: GenResult[] = [];
  if (project.hv.enabled) {
    results.push(generateHvSld(project.hv, project.meta, project.panels));
  }
  for (const panel of project.panels) {
    results.push(generateLvSld(panel, project.meta, project.hv.transformers));
    results.push(generateLvFace(panel, project.meta));
    results.push(...generateLvSchedule(panel, project.meta, project.hv.transformers));
  }
  return {
    diagrams: results.map((r) => r.diagram),
    warnings: results.flatMap((r) => r.warnings.map((w) => `[${r.diagram.title}] ${w}`)),
  };
}

/** 既存の図面リストへ再生成結果をマージする。
 *  - 同 id の図面は置換（keepEdited のとき手動編集済みは残す）
 *  - 仕様から消えた図面は削除
 */
export function mergeDiagrams(existing: Diagram[], generated: Diagram[], keepEdited: boolean): Diagram[] {
  return generated.map((d) => {
    const old = existing.find((e) => e.id === d.id);
    if (old && keepEdited && old.edited) return { ...old, stale: true };
    return d;
  });
}

/** 1 図面のみ再生成（id で特定） */
export function regenerate(project: Project, diagramId: string): GenResult | null {
  const all = regenerateAll(project);
  const d = all.diagrams.find((x) => x.id === diagramId);
  if (!d) return null;
  return { diagram: d, warnings: all.warnings };
}
