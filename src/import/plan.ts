import type {
  CapacitorSpec,
  HvFeederSpec,
  HvSlot,
  SwitchDevice,
  HvSpec,
  LvPanelSpec,
  Nameplate,
  NameplateEntry,
  Project,
  SupplyKind,
  TransformerSpec,
} from '../model/types';
import { defaultPanel } from '../model/defaults';
import { newId } from '../model/ids';
import { keyOf } from './normalize';
import { deviceKey, orderDevices } from '../model/switchgear';
import type { ParsedRow } from './nameplate';

/** 銘板行から共通の銘板情報を取り出す */
function toNameplate(r: ParsedRow): Nameplate {
  const np: Nameplate = {};
  if (r.model) np.model = r.model;
  if (r.ratingText) np.ratingText = r.ratingText;
  if (r.maker) np.maker = r.maker;
  if (r.madeOn) np.madeOn = r.madeOn;
  if (r.serial) np.serial = r.serial;
  if (r.location) np.location = r.location;
  return np;
}

/** 機器名称 → 受電盤スロット */
const SLOT_OF_DEVICE: [string, HvSlot][] = [
  ['SOG', 'pas'],
  ['PAS', 'pas'],
  ['UGS', 'pas'],
  ['DGR', 'dgr'],
  ['高圧ケーブル', 'cable'],
  ['ケーブル', 'cable'],
  ['CH', 'cable'],
  ['VCT', 'vct'],
  ['DS', 'ds'],
  ['VT', 'vt'],
  ['OPTR', 'vt'],
  ['LA', 'la'],
  ['VCB', 'vcb'],
  ['CT', 'ct'],
  ['ZCT', 'ct'],
  ['OCR', 'ocr'],
  ['LBS', 'lbs'],
  ['PF', 'pf'],
  ['VCS', 'vcs'],
  ['PC', 'pc'],
];

/**
 * 台帳の行から開閉装置の組み合わせを決める。
 * 見つかった機器をそのまま並べ、1 つも無ければ高圧カットアウトとみなす。
 */
function switchOf(rows: Partial<Record<Lowercase<SwitchDevice>, ParsedRow | undefined>>): SwitchDevice[] {
  const out: SwitchDevice[] = [];
  if (rows.lbs) out.push('LBS');
  if (rows.vcb) out.push('VCB');
  if (rows.pc) out.push('PC');
  if (rows.pf || rows.lbs) out.push('PF'); // LBS は限流ヒューズ付きが通例
  if (rows.vcs) out.push('VCS');
  return orderDevices(out.length > 0 ? out : ['PC']);
}

/** 選ばれた開閉装置と直列リアクトルの銘板を、機器名の小文字キーでまとめる */
function deviceNameplates(
  devices: SwitchDevice[],
  rows: Partial<Record<Lowercase<SwitchDevice>, ParsedRow | undefined>>,
  sr?: ParsedRow,
): Record<string, Nameplate> {
  const out: Record<string, Nameplate> = {};
  for (const dev of devices) {
    const r = rows[deviceKey(dev) as Lowercase<SwitchDevice>];
    if (r) out[deviceKey(dev)] = toNameplate(r);
  }
  if (sr) out.sr = toNameplate(sr);
  return out;
}

function slotOf(deviceName: string): HvSlot | undefined {
  const k = keyOf(deviceName);
  for (const [name, slot] of SLOT_OF_DEVICE) if (k === keyOf(name)) return slot;
  return undefined;
}

const isDevice = (r: ParsedRow, ...names: string[]) => names.some((n) => keyOf(r.deviceName) === keyOf(n));

/** ケーブル種別。CV と明記が無ければ高圧では一般的な CVT とみなす */
function cableType(text: string): string {
  return /\bCV\b/i.test(text) && !/CVT/i.test(text) ? 'CV' : 'CVT';
}

/** 二次電圧の表記を定格文字列から取り出す（6600/440 → 440V、6600/210/105 → 210/105V） */
function secondaryOf(ratingText: string): string | undefined {
  const m = ratingText.replace(/\s/g, '').match(/(\d{3,5})\/([\d/]+)/);
  if (!m) return undefined;
  return `${m[2]}V`;
}

/** 単相か三相か。二次に 105/100 が出てくるものを単相とみなす */
function phaseOf(ratingText: string): '1φ' | '3φ' {
  const sec = secondaryOf(ratingText) ?? '';
  return /(105|100)/.test(sec) ? '1φ' : '3φ';
}

/** 盤名から供給方式を推定する */
function supplyOf(name: string): SupplyKind {
  const k = keyOf(name);
  if (k.includes('電灯')) return '1φ3W100/200';
  return '3φ3W210';
}

export interface ImportPlan {
  /** 取り込み対象として解析できた行 */
  rows: ParsedRow[];
  feeders: HvFeederSpec[];
  transformers: TransformerSpec[];
  capacitors: CapacitorSpec[];
  panels: LvPanelSpec[];
  /** 受電盤スロットの銘板と、そこから読み取れた定格 */
  hvSlots: Partial<Record<HvSlot, Nameplate>>;
  hvPatch: Partial<HvSpec>;
  /** 図面に描かない機器 */
  extras: NameplateEntry[];
  /** 取り込みで決められなかったこと */
  notes: string[];
}

/** 解析済みの行から、プロジェクトへ反映する内容を組み立てる */
export function buildImportPlan(rows: ParsedRow[]): ImportPlan {
  const plan: ImportPlan = {
    rows,
    feeders: [],
    transformers: [],
    capacitors: [],
    panels: [],
    hvSlots: {},
    hvPatch: {},
    extras: [],
    notes: [],
  };

  // 所属盤ごとにまとめる（盤名に空白が入りうるので文字列キーは使わない）
  const groups: { kind: ParsedRow['group']['kind']; name: string; rows: ParsedRow[] }[] = [];
  for (const r of rows) {
    const found = groups.find((g) => g.kind === r.group.kind && g.name === r.group.name);
    if (found) found.rows.push(r);
    else groups.push({ kind: r.group.kind, name: r.group.name || '(名称なし)', rows: [r] });
  }

  const usedRows = new Set<ParsedRow>();
  const use = (r: ParsedRow) => usedRows.add(r);

  for (const { kind, name, rows: gRows } of groups) {

    if (kind === 'incoming' || kind === 'main') {
      for (const r of gRows) {
        const slot = slotOf(r.deviceName);
        if (!slot) continue;
        // 同じスロットに 2 台目以降がある場合（VT が 2 台など）は
        // 図面には出せないので銘板表に残す
        if (plan.hvSlots[slot]) continue;
        plan.hvSlots[slot] = toNameplate(r);
        use(r);

        if (slot === 'pas') {
          plan.hvPatch.pas = {
            kind: keyOf(r.deviceName) === keyOf('UGS') ? 'UGS' : 'PAS',
            sog: keyOf(r.deviceName) === keyOf('SOG'),
            ratedA: r.rating.a ?? 300,
          };
        }
        if (slot === 'cable') {
          const sq = r.note.match(/(\d+(?:\.\d+)?)\s*sq/i) ?? r.ratingText.match(/(\d+(?:\.\d+)?)\s*sq/i);
          const len = r.note.match(/(\d+(?:\.\d+)?)\s*m(?![a-z])/i);
          const type = cableType(`${r.note} ${r.ratingText}`);
          plan.hvPatch.cable = {
            type,
            sq: sq ? Number(sq[1]) : 38,
            ...(len ? { lengthM: Number(len[1]) } : {}),
          };
        }
        if (slot === 'ds') plan.hvPatch.ds = true;
        if (slot === 'la') plan.hvPatch.la = true;
        if (slot === 'vct') plan.hvPatch.vct = true;
      }
      // 受電盤の主遮断装置
      const vcb = gRows.find((r) => isDevice(r, 'VCB'));
      const ct = gRows.find((r) => isDevice(r, 'CT'));
      const ocr = gRows.find((r) => isDevice(r, 'OCR'));
      const mainLbs = gRows.find((r) => isDevice(r, 'LBS'));
      const mainPf = gRows.find((r) => isDevice(r, 'PF'));
      if (vcb || mainLbs) {
        const main = vcb ?? mainLbs!;
        plan.hvPatch.mainBreaker = {
          devices: switchOf({ vcb, lbs: mainLbs, pf: mainPf }),
          ratedA: main.rating.a ?? 600,
          ...(vcb?.rating.ka ? { breakingKA: vcb.rating.ka } : {}),
          ...(mainPf?.rating.a ? { pfA: mainPf.rating.a } : {}),
          ct: !!ct,
          ...(ct?.rating.ratio ? { ctRatio: ct.rating.ratio } : {}),
          ocr: !!ocr,
        };
      }
      const vt = gRows.find((r) => isDevice(r, 'VT'));
      if (vt) plan.hvPatch.metering = { vt: true, a: true, v: true, w: true, wh: false, pf: false, as: true, vs: true };
      continue;
    }

    if (kind === 'feeder') {
      const vcb = gRows.find((r) => isDevice(r, 'VCB'));
      const lbs = gRows.find((r) => isDevice(r, 'LBS'));
      const vcs = gRows.find((r) => isDevice(r, 'VCS'));
      const pc = gRows.find((r) => isDevice(r, 'PC'));
      const pf = gRows.find((r) => isDevice(r, 'PF'));
      const ct = gRows.find((r) => isDevice(r, 'CT'));
      const ocr = gRows.find((r) => isDevice(r, 'OCR'));
      const cable = gRows.find((r) => isDevice(r, '高圧ケーブル', 'ケーブル'));
      const nameplates: Record<string, Nameplate> = {};
      if (vcb) nameplates.vcb = toNameplate(vcb);
      if (lbs) nameplates.lbs = toNameplate(lbs);
      if (vcs) nameplates.vcs = toNameplate(vcs);
      if (pc) nameplates.pc = toNameplate(pc);
      if (pf) nameplates.pf = toNameplate(pf);
      if (ct) nameplates.ct = toNameplate(ct);
      if (ocr) nameplates.ocr = toNameplate(ocr);
      if (cable) nameplates.cable = toNameplate(cable);
      for (const r of [vcb, lbs, vcs, pc, pf, ct, ocr, cable]) if (r) use(r);

      const sq = cable ? (cable.note.match(/(\d+(?:\.\d+)?)\s*sq/i) ?? [])[1] : undefined;
      plan.feeders.push({
        id: newId('fdr'),
        name,
        devices: switchOf({ vcb, lbs, vcs, pc, pf }),
        ratedA: (vcb ?? lbs ?? vcs ?? pc)?.rating.a ?? 600,
        ...(vcb?.rating.ka ? { breakingKA: vcb.rating.ka } : {}),
        ...(!vcb && pf?.rating.a ? { pfA: pf.rating.a } : {}),
        ct: !!ct,
        ...(ct?.rating.ratio ? { ctRatio: ct.rating.ratio } : {}),
        ocr: !!ocr,
        ...(cable ? { cable: { type: cableType(`${cable.note} ${cable.ratingText}`), sq: sq ? Number(sq) : 38 } } : {}),
        nameplates,
      });
      continue;
    }

    if (kind === 'capacitor') {
      const sc = gRows.find((r) => isDevice(r, 'SC'));
      const sr = gRows.find((r) => isDevice(r, 'SR'));
      const lbs = gRows.find((r) => isDevice(r, 'LBS'));
      const vcs = gRows.find((r) => isDevice(r, 'VCS'));
      const pc = gRows.find((r) => isDevice(r, 'PC'));
      const pf = gRows.find((r) => isDevice(r, 'PF'));
      const devices = switchOf({ lbs, vcs, pc, pf });
      const nameplates = deviceNameplates(devices, { lbs, vcs, pc, pf }, sr);
      for (const r of [sc, lbs, vcs, pc, pf, sr]) if (r) use(r);
      plan.capacitors.push({
        id: newId('sc'),
        name,
        kvar: sc?.rating.kvar ?? 50,
        sr: !!sr,
        devices,
        pfA: pf?.rating.a ?? 30,
        ...(sc ? { nameplate: toNameplate(sc) } : {}),
        ...(Object.keys(nameplates).length > 0 ? { nameplates } : {}),
      });
      continue;
    }

    if (kind === 'lvPanel') {
      // 低圧系のグループは「変圧器 + 高圧側の開閉器」。盤そのものも 1 面作る
      const trs = gRows.filter((r) => isDevice(r, 'Tr', '変圧器', 'T'));
      const lbs = gRows.find((r) => isDevice(r, 'LBS'));
      const vcs = gRows.find((r) => isDevice(r, 'VCS'));
      const pc = gRows.find((r) => isDevice(r, 'PC'));
      const pf = gRows.find((r) => isDevice(r, 'PF'));
      const devices = switchOf({ lbs, vcs, pc, pf });
      const nameplates = deviceNameplates(devices, { lbs, vcs, pc, pf });
      for (const r of [lbs, vcs, pc, pf]) if (r) use(r);
      const panelId = newId('panel');
      let linked = false;
      for (const r of trs) {
        use(r);
        const secondary = secondaryOf(r.ratingText);
        plan.transformers.push({
          id: newId('tr'),
          name: name,
          phase: phaseOf(r.ratingText),
          kva: r.rating.kva ?? 0,
          secondary: secondary ?? '210V',
          devices,
          pfA: pf?.rating.a ?? 30,
          ...(linked ? {} : { feeds: panelId }),
          nameplate: toNameplate(r),
          // 高圧側の開閉器は 1 グループに 1 台ぶんしか無いので先頭の変圧器に付ける
          ...(!linked && Object.keys(nameplates).length > 0 ? { nameplates } : {}),
        });
        linked = true;
      }
      plan.panels.push({
        ...defaultPanel(panelId, name),
        supply: supplyOf(name),
        nameplate: { note: name },
      });
      continue;
    }
  }

  // どこにも割り当てられなかった行は銘板表だけに載せる
  for (const r of rows) {
    if (usedRows.has(r)) continue;
    plan.extras.push({
      id: newId('np'),
      deviceName: r.deviceName,
      group: r.group.name,
      ...toNameplate(r),
      note: r.note,
    });
  }

  if (plan.feeders.length > 0 && plan.transformers.length > 0) {
    plan.notes.push(
      '分岐盤と変圧器の対応は台帳に情報が無いため、取り込み後は変圧器が高圧母線に直結した状態になります。' +
        '「高圧受電設備」画面の変圧器一覧にある「所属分岐盤」欄で選び直してください。',
    );
  }
  if (plan.extras.length > 0) {
    plan.notes.push(`図面に描かない機器 ${plan.extras.length} 件は機器銘板表にのみ載せます。`);
  }
  return plan;
}

/** 取り込み計画をプロジェクトへ反映する */
export function applyImportPlan(project: Project, plan: ImportPlan, mode: 'replace' | 'merge'): Project {
  const hv = project.hv;
  const base: HvSpec =
    mode === 'replace'
      ? { ...hv, ...plan.hvPatch, feeders: [], transformers: [], capacitors: [], nameplates: {} }
      : { ...hv, ...plan.hvPatch };

  const next: Project = {
    ...project,
    hv: {
      ...base,
      enabled: true,
      nameplates: { ...base.nameplates, ...plan.hvSlots },
      feeders: [...base.feeders, ...plan.feeders],
      transformers: [...base.transformers, ...plan.transformers],
      capacitors: [...base.capacitors, ...plan.capacitors],
    },
    panels: mode === 'replace' ? plan.panels : [...project.panels, ...plan.panels],
    extraNameplates: mode === 'replace' ? plan.extras : [...(project.extraNameplates ?? []), ...plan.extras],
  };
  return next;
}
