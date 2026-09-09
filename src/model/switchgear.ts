import type { SymbolKind } from '../symbols/types';

/**
 * 高圧の開閉装置。
 * 変圧器・進相コンデンサ・高圧分岐盤・受電盤の主遮断装置で、同じ機器を自由に組み合わせられる。
 * 「どの機器をどの順に直列に並べるか」をここ 1 か所で決める。
 */

export type SwitchDevice = 'DTMC' | 'LBS_PF' | 'LBS' | 'VCB' | 'MCCB' | 'PC' | 'PF' | 'VCS';

/** 上流から下流への既定の並び順。チェックを入れたときはこの位置に差し込む */
export const SWITCH_DEVICES: SwitchDevice[] = ['DTMC', 'LBS_PF', 'LBS', 'VCB', 'MCCB', 'PC', 'PF', 'VCS'];

/** 低圧（600V 系）の機器。定格の表記を 6.6kV 系と分ける */
export const LV_DEVICES: SwitchDevice[] = ['MCCB', 'DTMC'];

export const SWITCH_DEVICE_LABEL: Record<SwitchDevice, string> = {
  DTMC: 'DTMC（ダブルスロー切替開閉器・発電／受電）',
  MCCB: 'MCCB（配線用遮断器・低圧）',
  LBS_PF: 'PF付LBS（限流ヒューズ付負荷開閉器・1 台）',
  LBS: 'LBS（負荷開閉器）',
  VCB: 'VCB（真空遮断器）',
  PC: 'PC（高圧カットアウト）',
  PF: 'PF（限流ヒューズ）',
  VCS: 'VCS（真空電磁接触器）',
};

/** チェックボックスや要約に出す短い名前 */
export const SWITCH_DEVICE_SHORT: Record<SwitchDevice, string> = {
  DTMC: 'DTMC',
  MCCB: 'MCCB',
  LBS_PF: 'PF付LBS',
  LBS: 'LBS',
  VCB: 'VCB',
  PC: 'PC',
  PF: 'PF',
  VCS: 'VCS',
};

const isDevice = (v: unknown): v is SwitchDevice => SWITCH_DEVICES.includes(v as SwitchDevice);

/** 重複を除き、上流→下流の順に並べ替える */
export function orderDevices(devs: readonly SwitchDevice[] | undefined): SwitchDevice[] {
  if (!Array.isArray(devs)) return [];
  return SWITCH_DEVICES.filter((d) => devs.includes(d));
}

/** チェックの入切 */
export function toggleDevice(devs: readonly SwitchDevice[], dev: SwitchDevice, on: boolean): SwitchDevice[] {
  const set = new Set(orderDevices(devs));
  if (on) set.add(dev);
  else set.delete(dev);
  return orderDevices([...set]);
}

/** 画面表示用の要約 */
export function switchSummary(devs: readonly SwitchDevice[] | undefined): string {
  const o = orderDevices(devs);
  return o.length === 0 ? '開閉器なし' : o.map((d) => SWITCH_DEVICE_SHORT[d]).join(' → ');
}

/** 限流ヒューズの定格入力が要るか（PF 単体でも PF付LBS でも要る） */
export function hasFuse(devs: readonly SwitchDevice[] | undefined): boolean {
  const o = orderDevices(devs);
  return o.includes('PF') || o.includes('LBS_PF');
}

/** 遮断容量の入力が要るか（真空遮断器・配線用遮断器） */
export function hasBreakingKA(devs: readonly SwitchDevice[] | undefined): boolean {
  const o = orderDevices(devs);
  return o.includes('VCB') || o.includes('MCCB');
}

/** 低圧の機器か（定格の頭に 7.2kV を付けない） */
export const isLvDevice = (dev: SwitchDevice): boolean => LV_DEVICES.includes(dev);

/**
 * 図記号の名前。SwitchDevice と SymbolKind は基本同じだが、
 * MCCB は既存の配線用遮断器（MCB）の図記号をそのまま使う。
 */
export function deviceSymbol(dev: SwitchDevice): SymbolKind {
  return dev === 'MCCB' ? 'MCB' : dev;
}

/** 図面ラベル。定格が分からない場合（分岐の開閉器など）は機器名だけにする */
export function deviceLabel(
  dev: SwitchDevice,
  o: { ratedA?: number; breakingKA?: number; pfA?: number } = {},
): string[] {
  if (dev === 'PF') return [o.pfA ? `PF ${o.pfA}A` : 'PF'];
  if (dev === 'LBS_PF') {
    return [o.ratedA ? `PF付LBS ${o.ratedA}A` : 'PF付LBS', o.pfA ? `PF ${o.pfA}A` : ''].filter(Boolean);
  }
  if (dev === 'PC') {
    const a = o.pfA ?? o.ratedA;
    return [a ? `PC ${a}A` : 'PC'];
  }
  if (dev === 'VCB' || dev === 'MCCB') {
    return [o.ratedA ? `${dev} ${o.ratedA}A` : dev, o.breakingKA ? `${o.breakingKA}kA` : ''].filter(Boolean);
  }
  return [o.ratedA ? `${dev} ${o.ratedA}A` : dev];
}

/** 銘板のキー（機器名の小文字） */
export const deviceKey = (dev: SwitchDevice): string => dev.toLowerCase();

/**
 * 旧データの移行。
 * 以前は 'LBS' | 'LBS+VCS' | 'PC' | 'VCB' | 'VCS' の 5 パターン固定で、
 * 'LBS' は「LBS + 限流ヒューズ」を意味していた。
 */
export function migrateDevices(v: unknown): SwitchDevice[] {
  if (Array.isArray(v)) return orderDevices(v.filter(isDevice));
  if (typeof v !== 'string') return [];
  const parts = v.split('+').map((s) => s.trim().toUpperCase());
  if (parts.length === 1 && parts[0] === 'LBS_PF') return ['LBS_PF'];
  const out: SwitchDevice[] = [];
  for (const p of parts) {
    if (!isDevice(p)) continue;
    out.push(p);
    // 旧 'LBS' / 'LBS+VCS' は限流ヒューズ付きを指していた
    if (p === 'LBS' && !parts.includes('PF')) out.push('PF');
  }
  return orderDevices(out);
}
