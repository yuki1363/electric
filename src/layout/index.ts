import type { Diagram, Project } from '../model/types';
import { generateHvSld } from './hvSld';
import { generateLvSld } from './lvSld';
import { generateLvFace } from './lvFace';
import { generateLvSchedule } from './lvSchedule';
import { generateNameplate } from './nameplate';
import { fitDiagram, isTight, scaleLabel } from './fit';
import type { GenResult } from './types';

/** 生成結果を用紙に収める。縮小したときは警告で知らせる */
function fitResult(r: GenResult): GenResult {
  const { diagram, scale, overflow } = fitDiagram(r.diagram);
  const warnings = [...r.warnings];
  if (overflow) {
    warnings.push(`内容が多く、縮尺 ${scaleLabel(scale)} でも用紙に収まりません。用紙を A3 にするか機器を分けてください`);
  } else if (scale < 1) {
    warnings.push(
      isTight(scale)
        ? `用紙に収めるため縮尺 ${scaleLabel(scale)} まで縮小しました。図記号が小さいため A3 横を推奨します`
        : `用紙に収めるため縮尺 ${scaleLabel(scale)} で作図しました`,
    );
  }
  return { diagram, warnings };
}

export interface RegenerateResult {
  diagrams: Diagram[];
  warnings: string[];
}

/** 仕様から全図面を生成する */
export function regenerateAll(project: Project): RegenerateResult {
  const raw: GenResult[] = [];
  if (project.hv.enabled) {
    raw.push(generateHvSld(project.hv, project.meta, project.panels));
  }
  for (const panel of project.panels) {
    raw.push(...generateLvSld(panel, project.meta, project.hv.transformers));
    raw.push(generateLvFace(panel, project.meta));
    raw.push(...generateLvSchedule(panel, project.meta, project.hv.transformers));
  }
  raw.push(...generateNameplate(project));
  const results = raw.map(fitResult);
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
