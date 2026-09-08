import type { LvPanelSpec, SupplyKind, TransformerSpec } from './types';

export const SUPPLY_LABEL: Record<SupplyKind, string> = {
  '1φ2W100': '単相2線式 100V',
  '1φ2W200': '単相2線式 200V',
  '1φ3W100/200': '単相3線式 100/200V',
  '3φ3W210': '三相3線式 210V',
};

export const SUPPLY_SHORT: Record<SupplyKind, string> = {
  '1φ2W100': '1φ2W 100V',
  '1φ2W200': '1φ2W 200V',
  '1φ3W100/200': '1φ3W 100/200V',
  '3φ3W210': '3φ3W 210V',
};

export function mainBreakerLabel(p: LvPanelSpec): string {
  const m = p.main;
  const s = `${m.kind} ${m.af}AF/${m.at}AT ${m.poles}`;
  return m.kind === 'ELB' && m.sensitivityMa ? `${s} ${m.sensitivityMa}mA` : s;
}

export function sourceLabel(p: LvPanelSpec, transformers: TransformerSpec[]): string {
  const tr = transformers.find((t) => t.id === p.sourceTransformerId);
  return tr ? `変圧器 ${tr.name}（${tr.phase} ${tr.kva}kVA）より` : '';
}

export const KIND_TITLE = {
  'hv-sld': '高圧受電設備 単線結線図',
  'lv-sld': '分電盤 単線結線図',
  'lv-face': '盤面配置図',
  'lv-schedule': '回路表',
  nameplate: '機器銘板表',
} as const;
