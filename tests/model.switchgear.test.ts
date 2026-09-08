import { describe, expect, it } from 'vitest';
import { HV_SWITCHES, hasBreakingKA, hasFuse, switchDevices } from '../src/model/switchgear';
import { nameplateRows } from '../src/model/nameplateRows';
import { sampleProject } from '../src/model/defaults';
import type { HvFeederSpec } from '../src/model/types';

describe('開閉装置', () => {
  it('方式ごとに直列に並ぶ機器', () => {
    expect(switchDevices('LBS')).toEqual(['LBS', 'PF']);
    expect(switchDevices('LBS+VCS')).toEqual(['LBS', 'PF', 'VCS']);
    expect(switchDevices('PC')).toEqual(['PC']);
    expect(switchDevices('VCB')).toEqual(['VCB']);
    expect(switchDevices('VCS')).toEqual(['VCS']);
  });

  it('限流ヒューズと遮断容量の要否', () => {
    expect(HV_SWITCHES.filter(hasFuse)).toEqual(['LBS', 'LBS+VCS']);
    expect(HV_SWITCHES.filter(hasBreakingKA)).toEqual(['VCB']);
  });

  it('保存済みの古い値もそのまま使える', () => {
    // 以前は 'LBS' | 'PC' の 2 種類しか無かった
    expect(switchDevices('LBS')).not.toEqual([]);
    expect(switchDevices('PC')).not.toEqual([]);
  });
});

describe('銘板表の分岐盤の行', () => {
  const p = sampleProject();
  const rowsFor = (breaker: HvFeederSpec['breaker']) => {
    const f: HvFeederSpec = { id: 'f1', name: 'F1', breaker, ratedA: 200, pfA: 30, ct: false, ocr: false };
    const project = { ...p, hv: { ...p.hv, feeders: [f], transformers: [], capacitors: [] } };
    return nameplateRows(project)
      .filter((r) => r.note === 'F1')
      .map((r) => r.deviceName);
  };

  it('方式に合わせて行が出る', () => {
    expect(rowsFor('LBS')).toEqual(['LBS', 'PF']);
    expect(rowsFor('LBS+VCS')).toEqual(['LBS', 'PF', 'VCS']);
    expect(rowsFor('VCB')).toEqual(['VCB']);
    expect(rowsFor('VCS')).toEqual(['VCS']);
    expect(rowsFor('PC')).toEqual(['PC']);
  });

  it('銘板は機器名の小文字をキーにする', () => {
    const f: HvFeederSpec = {
      id: 'f1',
      name: 'F1',
      breaker: 'LBS+VCS',
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
});
