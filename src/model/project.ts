import type { Diagram, Project } from './types';
import { isPortEnd } from './types';
import { getSymbol, isSymbolKind } from '../symbols';
import { safeFileName } from '../export/download';
import { defaultHv, defaultMeta, defaultPanel } from './defaults';
import { migrateDevices } from './switchgear';

export const FILE_EXT = '.elec.json';

export function serialize(project: Project): string {
  return JSON.stringify(project, null, 2);
}

/**
 * 保存ファイル名。ブラウザや CAD が非 ASCII のダウンロード名を落とす場合があるため
 * 図番（ASCII 想定）を基準にする。
 */
export function projectFileName(project: Project): string {
  const base = safeFileName(project.meta.drawingNo || 'project', true);
  return `${base}${FILE_EXT}`;
}

class ParseError extends Error {}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function validateDiagram(d: unknown, idx: number): Diagram {
  if (!isObj(d)) throw new ParseError(`diagrams[${idx}] が不正です`);
  const elements = Array.isArray(d.elements) ? d.elements : [];
  const wires = Array.isArray(d.wires) ? d.wires : [];
  const ids = new Set<string>();
  for (const e of elements) {
    if (!isObj(e) || typeof e.id !== 'string' || !isSymbolKind(e.kind)) {
      throw new ParseError(`diagrams[${idx}] に未知の図記号または不正な要素があります`);
    }
    if (typeof e.x !== 'number' || typeof e.y !== 'number') throw new ParseError(`要素 ${e.id} の座標が不正です`);
    ids.add(e.id);
  }
  for (const w of wires) {
    if (!isObj(w) || typeof w.id !== 'string') throw new ParseError(`diagrams[${idx}] の配線が不正です`);
    for (const end of [w.from, w.to]) {
      if (!isObj(end)) throw new ParseError(`配線 ${w.id} の端点が不正です`);
      if (isPortEnd(end as never)) {
        const pe = end as { elementId: string; portId: string };
        if (!ids.has(pe.elementId)) throw new ParseError(`配線 ${w.id} が存在しない要素 ${pe.elementId} を参照しています`);
        const el = elements.find((e: { id: string }) => e.id === pe.elementId) as { kind: string };
        if (!getSymbol(el.kind as never).ports.some((p) => p.id === pe.portId)) {
          throw new ParseError(`配線 ${w.id} が存在しないポート ${pe.portId} を参照しています`);
        }
      }
    }
  }
  return d as unknown as Diagram;
}

/**
 * 旧形式の開閉装置を移行する。
 * 以前は変圧器/コンデンサが `switch: 'LBS'`、分岐盤が `breaker: 'VCB'` のような
 * 固定パターンの文字列で、主遮断装置は CB 形 / PF・S 形の 2 択だった。
 */
function migrateHv(rawHv: Record<string, unknown>): Record<string, unknown> {
  const withDevices = (v: unknown, legacyKey: 'switch' | 'breaker') => {
    if (!isObj(v)) return v;
    const { [legacyKey]: legacy, ...rest } = v;
    return { ...rest, devices: migrateDevices(v.devices ?? legacy) };
  };
  const list = (v: unknown, legacyKey: 'switch' | 'breaker') =>
    Array.isArray(v) ? v.map((x) => withDevices(x, legacyKey)) : [];

  const out: Record<string, unknown> = {
    ...rawHv,
    feeders: list(rawHv.feeders, 'breaker'),
    transformers: list(rawHv.transformers, 'switch'),
    capacitors: list(rawHv.capacitors, 'switch'),
  };

  const mb = rawHv.mainBreaker;
  if (isObj(mb) && !Array.isArray(mb.devices)) {
    const vcb = isObj(mb.vcb) ? mb.vcb : {};
    const lbs = isObj(mb.lbs) ? mb.lbs : {};
    out.mainBreaker =
      mb.type === 'PF-S'
        ? {
            devices: ['LBS', 'PF'],
            ratedA: typeof lbs.ratedA === 'number' ? lbs.ratedA : 300,
            pfA: typeof mb.pfA === 'number' ? mb.pfA : 40,
            ct: false,
            ocr: false,
          }
        : {
            devices: ['VCB'],
            ratedA: typeof vcb.ratedA === 'number' ? vcb.ratedA : 600,
            breakingKA: typeof vcb.breakingKA === 'number' ? vcb.breakingKA : 12.5,
            ct: true,
            ctRatio: typeof mb.ctRatio === 'string' ? mb.ctRatio : '75/5A',
            ocr: mb.ocr !== false,
          };
  }
  return out;
}

/** JSON 文字列からプロジェクトを復元（検証・移行つき） */
export function parse(text: string): Project {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new ParseError('JSON として読み込めません');
  }
  if (!isObj(raw)) throw new ParseError('プロジェクト形式ではありません');
  if (raw.version !== 1) throw new ParseError(`未対応のバージョンです: ${String(raw.version)}`);
  if (!isObj(raw.meta) || !isObj(raw.hv) || !Array.isArray(raw.panels)) {
    throw new ParseError('meta / hv / panels が不足しています');
  }
  const diagrams = Array.isArray(raw.diagrams) ? raw.diagrams.map(validateDiagram) : [];

  // 欠けたフィールドは既定値で補完
  const meta = { ...defaultMeta(), ...raw.meta } as Project['meta'];
  const hv = { ...defaultHv(), ...migrateHv(raw.hv as Record<string, unknown>) } as Project['hv'];
  const panels = raw.panels.map((p, i) => {
    if (!isObj(p) || typeof p.id !== 'string') throw new ParseError(`panels[${i}] が不正です`);
    const base = defaultPanel(p.id, typeof p.name === 'string' ? p.name : `L-${i + 1}`);
    return { ...base, ...p, circuits: Array.isArray(p.circuits) ? p.circuits : [] } as Project['panels'][number];
  });
  const extraNameplates = Array.isArray(raw.extraNameplates)
    ? (raw.extraNameplates as Project['extraNameplates'])
    : undefined;
  return { version: 1, meta, hv, panels, ...(extraNameplates ? { extraNameplates } : {}), diagrams };
}
