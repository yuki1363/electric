import { describe, expect, it } from 'vitest';
import {
  SWITCH_DEVICES,
  deviceLabel,
  hasBreakingKA,
  hasFuse,
  migrateDevices,
  orderDevices,
  switchSummary,
  toggleDevice,
} from '../src/model/switchgear';
import { nameplateRows } from '../src/model/nameplateRows';
import { sampleProject } from '../src/model/defaults';
import type { HvFeederSpec, SwitchDevice } from '../src/model/types';

describe('開閉装置の組み合わせ', () => {
  it('選んだ順によらず上流→下流に並べ替え、重複は除く', () => {
    expect(orderDevices(['PF', 'LBS'])).toEqual(['LBS', 'PF']);
    expect(orderDevices(['VCS', 'PF', 'LBS'])).toEqual(['LBS', 'PF', 'VCS']);
    expect(orderDevices(['PF', 'PF'])).toEqual(['PF']);
    expect(orderDevices([])).toEqual([]);
    expect(orderDevices(undefined)).toEqual([]);
  });

  it('チェックの足し引き', () => {
    expect(toggleDevice(['LBS'], 'PF', true)).toEqual(['LBS', 'PF']);
    expect(toggleDevice(['LBS', 'PF'], 'LBS', false)).toEqual(['PF']);
    // ヒューズだけ・開閉器なしも作れる
    expect(toggleDevice(['PF'], 'PF', false)).toEqual([]);
  });

  it('要約は描かれる順に出す', () => {
    expect(switchSummary(['VCS', 'LBS', 'PF'])).toBe('LBS → PF → VCS');
    expect(switchSummary(['PF'])).toBe('PF');
    expect(switchSummary([])).toBe('開閉器なし');
  });

  it('限流ヒューズと遮断容量の要否', () => {
    expect(hasFuse(['LBS', 'PF'])).toBe(true);
    expect(hasFuse(['LBS'])).toBe(false);
    expect(hasFuse(['VCS'])).toBe(false);
    expect(hasBreakingKA(['VCB'])).toBe(true);
    expect(hasBreakingKA(['LBS', 'PF'])).toBe(false);
  });

  it('図面ラベルは定格が分かるときだけ付ける', () => {
    expect(deviceLabel('VCB', { ratedA: 600, breakingKA: 12.5 })).toEqual(['VCB 600A', '12.5kA']);
    expect(deviceLabel('PF', { pfA: 30 })).toEqual(['PF 30A']);
    expect(deviceLabel('LBS', { ratedA: 200 })).toEqual(['LBS 200A']);
    // 分岐の開閉器は定格を持たないので機器名だけ
    expect(deviceLabel('LBS', {})).toEqual(['LBS']);
    expect(deviceLabel('PF', {})).toEqual(['PF']);
  });

  it('旧形式の 5 パターンを配列へ移行する', () => {
    // 以前の 'LBS' は「LBS + 限流ヒューズ」を指していた
    expect(migrateDevices('LBS')).toEqual(['LBS', 'PF']);
    expect(migrateDevices('LBS+VCS')).toEqual(['LBS', 'PF', 'VCS']);
    expect(migrateDevices('PC')).toEqual(['PC']);
    expect(migrateDevices('VCB')).toEqual(['VCB']);
    expect(migrateDevices('VCS')).toEqual(['VCS']);
  });

  it('移行は新形式・壊れた値も受ける', () => {
    expect(migrateDevices(['LBS', 'PF'])).toEqual(['LBS', 'PF']);
    expect(migrateDevices(['PF', 'LBS'])).toEqual(['LBS', 'PF']); // 並べ替える
    expect(migrateDevices(['XX'])).toEqual([]);
    expect(migrateDevices(undefined)).toEqual([]);
    expect(migrateDevices('')).toEqual([]);
  });

  it('選べる機器と並び順', () => {
    expect(SWITCH_DEVICES).toEqual(['LBS_PF', 'LBS', 'VCB', 'PC', 'PF', 'VCS']);
  });

  it('PF付LBS は 1 台でヒューズ込み', () => {
    expect(hasFuse(['LBS_PF'])).toBe(true);
    expect(hasBreakingKA(['LBS_PF'])).toBe(false);
    expect(deviceLabel('LBS_PF', { ratedA: 200, pfA: 30 })).toEqual(['PF付LBS 200A', 'PF 30A']);
    expect(deviceLabel('LBS_PF', {})).toEqual(['PF付LBS']);
    expect(switchSummary(['LBS_PF'])).toBe('PF付LBS');
    // LBS + PF を別々に選んだ場合と混ざらない
    expect(orderDevices(['PF', 'LBS_PF'])).toEqual(['LBS_PF', 'PF']);
  });
});

describe('銘板表の分岐盤の行', () => {
  const p = sampleProject();
  const rowsFor = (devices: HvFeederSpec['devices']) => {
    const f: HvFeederSpec = { id: 'f1', name: 'F1', devices, ratedA: 200, pfA: 30, ct: false, ocr: false };
    const project = { ...p, hv: { ...p.hv, feeders: [f], transformers: [], capacitors: [] } };
    return nameplateRows(project)
      .filter((r) => r.note === 'F1')
      .map((r) => r.deviceName);
  };

  it('選んだ機器の行が順番に出る', () => {
    expect(rowsFor(['LBS', 'PF'])).toEqual(['LBS', 'PF']);
    expect(rowsFor(['LBS', 'PF', 'VCS'])).toEqual(['LBS', 'PF', 'VCS']);
    expect(rowsFor(['VCB'])).toEqual(['VCB']);
    expect(rowsFor(['PF'])).toEqual(['PF']);
    expect(rowsFor([])).toEqual([]);
  });

  it('銘板は機器名の小文字をキーにする', () => {
    const f: HvFeederSpec = {
      id: 'f1',
      name: 'F1',
      devices: ['LBS', 'PF', 'VCS'],
      ratedA: 200,
      pfA: 30,
      ct: false,
      ocr: false,
      nameplates: { vcs: { model: 'VK-6' } },
    };
    const project = { ...p, hv: { ...p.hv, feeders: [f], transformers: [], capacitors: [] } };
    const vcs = nameplateRows(project).find((r) => r.deviceName === 'VCS')!;
    expect(vcs.model).toBe('VK-6');
  });

  it('変圧器・コンデンサの開閉器と SR も銘板表に出る', () => {
    const hv = {
      ...p.hv,
      feeders: [],
      transformers: [{ ...p.hv.transformers[0]!, devices: ['LBS', 'PF'] as SwitchDevice[], nameplates: { lbs: { model: 'LBS-6A' } } }],
      capacitors: [{ ...p.hv.capacitors[0]!, devices: ['LBS', 'PF', 'VCS'] as SwitchDevice[], sr: true }],
    };
    const names = nameplateRows({ ...p, hv }).map((r) => `${r.note}/${r.deviceName}`);
    expect(names).toContain('Tr-1/LBS');
    expect(names).toContain('Tr-1/PF');
    expect(names).toContain('Tr-1/Tr');
    expect(names).toContain('SC-1/VCS');
    expect(names).toContain('SC-1/SR');
    expect(names).toContain('SC-1/SC');
    expect(nameplateRows({ ...p, hv }).find((r) => r.deviceName === 'LBS')!.model).toBe('LBS-6A');
  });
});
