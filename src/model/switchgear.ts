/**
 * 高圧の開閉装置。
 * 変圧器・進相コンデンサ・高圧分岐盤・受電盤の主遮断装置で、同じ機器を自由に組み合わせられる。
 * 「どの機器をどの順に直列に並べるか」をここ 1 か所で決める。
 */

export type SwitchDevice = 'LBS' | 'VCB' | 'PC' | 'PF' | 'VCS';

/** 上流から下流への並び順。選んだ機器はこの順に描く */
export const SWITCH_DEVICES: SwitchDevice[] = ['LBS', 'VCB', 'PC', 'PF', 'VCS'];

export const SWITCH_DEVICE_LABEL: Record<SwitchDevice, string> = {
  LBS: 'LBS（負荷開閉器）',
  VCB: 'VCB（真空遮断器）',
  PC: 'PC（高圧カットアウト）',
  PF: 'PF（限流ヒューズ）',
  VCS: 'VCS（真空電磁接触器）',
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
  return o.length === 0 ? '開閉器なし' : o.join(' → ');
}

/** 限流ヒューズの定格入力が要るか */
export function hasFuse(devs: readonly SwitchDevice[] | undefined): boolean {
  return orderDevices(devs).includes('PF');
}

/** 遮断容量の入力が要るか */
export function hasBreakingKA(devs: readonly SwitchDevice[] | undefined): boolean {
  return orderDevices(devs).includes('VCB');
}

/** 図面ラベル。定格が分からない場合（分岐の開閉器など）は機器名だけにする */
export function deviceLabel(
  dev: SwitchDevice,
  o: { ratedA?: number; breakingKA?: number; pfA?: number } = {},
): string[] {
  if (dev === 'PF') return [o.pfA ? `PF ${o.pfA}A` : 'PF'];
  if (dev === 'PC') {
    const a = o.pfA ?? o.ratedA;
    return [a ? `PC ${a}A` : 'PC'];
  }
  if (dev === 'VCB') {
    return [o.ratedA ? `VCB ${o.ratedA}A` : 'VCB', o.breakingKA ? `${o.breakingKA}kA` : ''].filter(Boolean);
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
  const out: SwitchDevice[] = [];
  for (const p of parts) {
    if (!isDevice(p)) continue;
    out.push(p);
    // 旧 'LBS' / 'LBS+VCS' は限流ヒューズ付きを指していた
    if (p === 'LBS' && !parts.includes('PF')) out.push('PF');
  }
  return orderDevices(out);
}
