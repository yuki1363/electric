import type { Diagram, Project } from '../model/types';
import { generateHvSld } from './hvSld';
import { generateLvSld } from './lvSld';
import { generateLvFace } from './lvFace';
import { generateLvSchedule } from './lvSchedule';
import { generateNameplate } from './nameplate';
import { carryOverEdits } from './carryOver';
import { findOverlaps } from './overlap';
import { fitDiagram, isTight, scaleLabel } from './fit';
import type { GenResult } from './types';

/** 生成結果を用紙に収める。縮小したときは警告で知らせる */
function fitResult(r: GenResult): GenResult {
  const { diagram, scale, overflow } = fitDiagram(r.diagram);
  const warnings = [...r.warnings];
  // 単線結線図で図記号や文字が重なっていたら知らせる（表の類は文字を枠内に置くので対象外）
  if (diagram.kind === 'hv-sld' || diagram.kind === 'lv-sld') {
    const ov = findOverlaps(diagram);
    if (ov.length > 0) warnings.push(`図記号や文字が ${ov.length} か所重なっています`);
  }
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

/** 仕様から全図面を生成する（用紙に収める前・等倍） */
function buildAll(project: Project): GenResult[] {
  const raw: GenResult[] = [];
  /** 送りに使っている分岐盤 → 副変電所名 */
  const feedsTo: Record<string, string> = {};
  for (const sub of project.substations ?? []) {
    if (sub.sourceFeederId) feedsTo[sub.sourceFeederId] = sub.name;
  }
  if (project.hv.enabled) {
    raw.push(...generateHvSld(project.hv, project.meta, project.panels, undefined, feedsTo));
  }
  // 副変電所は受電部の代わりに「送りより」の注記から始める（母線から下は同じ作り）
  for (const sub of project.substations ?? []) {
    const feeder = project.hv.feeders.find((f) => f.id === sub.sourceFeederId);
    raw.push(
      ...generateHvSld(sub.hv, project.meta, project.panels, {
        idPrefix: `sub-${sub.id}`,
        title: `${sub.name} 単線結線図`,
        fromText: feeder ? `高圧受電盤 ${feeder.name} より` : `${sub.name} 受電`,
      }),
    );
  }
  for (const panel of project.panels) {
    // 分岐回路が未入力の盤は図面を作らない（変圧器の給電先としてだけ存在する状態）
    if (panel.circuits.length === 0) continue;
    raw.push(...generateLvSld(panel, project.meta, project.hv.transformers));
    raw.push(generateLvFace(panel, project.meta));
    raw.push(...generateLvSchedule(panel, project.meta, project.hv.transformers));
  }
  raw.push(...generateNameplate(project));
  return raw;
}

export interface RegenerateResult {
  diagrams: Diagram[];
  warnings: string[];
}

/**
 * 仕様から全図面を生成し、既存図面の手作業を引き継いでから用紙に収める。
 * 手で足した機器・配線・文字は作り直しても消えない（carryOverEdits）。
 * 仕様から消えた図面は結果に含まれない＝削除される。
 */
export function regenerateAll(project: Project, existing: Diagram[] = project.diagrams): RegenerateResult {
  const results = mergeDiagrams(existing, buildAll(project)).map(fitResult);
  // 仕様に紐づかない図面（白紙・生成図面の写し）は触らずそのまま残す
  const free = existing.filter((d) => d.kind === 'free');
  return {
    diagrams: [...results.map((r) => r.diagram), ...free],
    warnings: results.flatMap((r) => r.warnings.map((w) => `[${r.diagram.title}] ${w}`)),
  };
}

/**
 * 機器銘板表だけを作り直す（自動作図を切っているとき用）。
 * 単線結線図などには触らず、図面に置かれた機器から表を組み立て直す。
 */
export function regenerateNameplateOnly(project: Project): RegenerateResult {
  const results = mergeDiagrams(project.diagrams, generateNameplate(project)).map(fitResult);
  const others = project.diagrams.filter((d) => d.kind !== 'nameplate');
  return {
    diagrams: [...others, ...results.map((r) => r.diagram)],
    warnings: results.flatMap((r) => r.warnings.map((w) => `[${r.diagram.title}] ${w}`)),
  };
}

/** 生成し直した図面（等倍）へ、同 id の既存図面の手作業を載せ替える */
export function mergeDiagrams(existing: Diagram[], generated: GenResult[]): GenResult[] {
  return generated.map((r) => {
    const c = carryOverEdits(
      existing.find((e) => e.id === r.diagram.id),
      r.diagram,
    );
    return { diagram: c.diagram, warnings: [...r.warnings, ...c.warnings] };
  });
}

/** 1 図面のみ再生成（id で特定） */
export function regenerate(project: Project, diagramId: string): GenResult | null {
  const all = regenerateAll(project);
  const d = all.diagrams.find((x) => x.id === diagramId);
  if (!d) return null;
  return { diagram: d, warnings: all.warnings };
}
