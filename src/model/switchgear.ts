/**
 * 高圧の開閉装置。
 * 変圧器・進相コンデンサ・高圧分岐盤で同じ選択肢を使えるよう、
 * 「どの機器をどの順に直列に並べるか」をここ 1 か所で決める。
 */

export type HvSwitch = 'LBS' | 'LBS+VCS' | 'PC' | 'VCB' | 'VCS';

/** 直列に並ぶ機器（上流から順に） */
export type SwitchDevice = 'LBS' | 'PF' | 'PC' | 'VCB' | 'VCS';

export const HV_SWITCHES: HvSwitch[] = ['LBS', 'LBS+VCS', 'PC', 'VCB', 'VCS'];

export const HV_SWITCH_LABEL: Record<HvSwitch, string> = {
  LBS: 'LBS+PF（負荷開閉器＋限流ヒューズ）',
  'LBS+VCS': 'LBS+PF+VCS（真空電磁接触器付き）',
  PC: 'PC（高圧カットアウト）',
  VCB: 'VCB（真空遮断器）',
  VCS: 'VCS（真空電磁接触器）',
};

const DEVICES: Record<HvSwitch, SwitchDevice[]> = {
  LBS: ['LBS', 'PF'],
  'LBS+VCS': ['LBS', 'PF', 'VCS'],
  PC: ['PC'],
  VCB: ['VCB'],
  VCS: ['VCS'],
};

/** その方式が直列に並べる機器を上流から順に返す */
export function switchDevices(kind: HvSwitch): SwitchDevice[] {
  return DEVICES[kind] ?? DEVICES.LBS;
}

/** 限流ヒューズの定格入力が要るか（PF 欄の有効・無効に使う） */
export function hasFuse(kind: HvSwitch): boolean {
  return switchDevices(kind).includes('PF');
}

/** 遮断容量の入力が要るか */
export function hasBreakingKA(kind: HvSwitch): boolean {
  return kind === 'VCB';
}
