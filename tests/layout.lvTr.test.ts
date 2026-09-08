import { describe, expect, it } from 'vitest';
import { generateLvSld } from '../src/layout/lvSld';
import { generateHvSld } from '../src/layout/hvSld';
import { regenerateAll } from '../src/layout';
import { sampleProject } from '../src/model/defaults';
import { newId } from '../src/model/ids';
import type { LvPanelSpec, SwitchDevice, TransformerSpec } from '../src/model/types';
import { defaultPanel } from '../src/model/defaults';

/** L-1 から取る 440V → 210V の変圧器と、その給電先の盤 */
function withLvTransformer() {
  const p = sampleProject();
  const dest: LvPanelSpec = { ...defaultPanel('panel_x', 'X-1'), circuits: [] };
  const lvTr: TransformerSpec = {
    id: newId('tr'),
    name: 'Tr-低圧',
    phase: '3φ',
    kva: 30,
    primary: '440V',
    secondary: '210V',
    devices: [] as SwitchDevice[],
    pfA: 30,
    sourcePanelId: 'panel_L1',
    feeds: dest.id,
  };
  return {
    ...p,
    panels: [...p.panels, dest],
    hv: { ...p.hv, transformers: [...p.hv.transformers, lvTr] },
    lvTr,
  };
}

describe('低圧 → 低圧の変圧器', () => {
  const p = withLvTransformer();

  it('高圧単線結線図には描かない', () => {
    const d = generateHvSld(p.hv, p.meta, p.panels)[0]!.diagram;
    expect(d.elements.some((e) => e.labels.includes('Tr-低圧'))).toBe(false);
    // 高圧側の変圧器はそのまま描かれる
    expect(d.elements.some((e) => e.labels.includes('Tr-1'))).toBe(true);
  });

  it('電源にした分電盤の単線結線図へ分岐として描く', () => {
    const l1 = p.panels.find((x) => x.id === 'panel_L1')!;
    const d = generateLvSld(l1, p.meta, p.hv.transformers, p.panels)[0]!.diagram;
    const tr = d.elements.find((e) => e.kind === 'TR_3PH');
    expect(tr).toBeDefined();
    // 母線から分岐して、二次側は給電先へ向かう
    const busY = d.wires.find((w) => w.style === 'bus')!.points[0]!.y;
    expect(tr!.y).toBeGreaterThan(busY);
    expect(d.elements.some((e) => e.kind === 'JUNCTION' && e.x === tr!.x && e.y === busY)).toBe(true);
    const texts = d.texts.map((t) => t.text);
    expect(texts).toContain('Tr-低圧');
    expect(texts).toContain('440V/210V'); // 一次電圧が反映される
    expect(texts).toContain('X-1 へ');
  });

  it('関係ない分電盤には描かない', () => {
    const p1 = p.panels.find((x) => x.id === 'panel_P1')!;
    const d = generateLvSld(p1, p.meta, p.hv.transformers, p.panels)[0]!.diagram;
    expect(d.texts.some((t) => t.text === 'Tr-低圧')).toBe(false);
  });

  it('回路が無くても、この盤から取る変圧器があれば図面を作る', () => {
    const q = withLvTransformer();
    // L-1 の回路を空にしても図面は作られる
    const panels = q.panels.map((x) => (x.id === 'panel_L1' ? { ...x, circuits: [] } : x));
    const r = regenerateAll({ ...q, panels });
    expect(r.diagrams.some((d) => d.id.startsWith('lv-sld-panel_L1'))).toBe(true);
  });

  it('開閉器を選べば変圧器の上に直列で描く', () => {
    const q = withLvTransformer();
    // 開閉装置を選べばそのまま描く（低圧では外して「開閉器なし」にできる）
    const withPf = q.hv.transformers.map((t) =>
      t.name === 'Tr-低圧' ? { ...t, devices: ['PF'] as SwitchDevice[] } : t,
    );
    const l1 = q.panels.find((x) => x.id === 'panel_L1')!;
    const d = generateLvSld(l1, q.meta, withPf, q.panels)[0]!.diagram;
    const pf = d.elements.find((e) => e.kind === 'PF')!;
    const tr = d.elements.find((e) => e.kind === 'TR_3PH')!;
    expect(pf.x).toBe(tr.x);
    expect(pf.y).toBeLessThan(tr.y);
  });
});
