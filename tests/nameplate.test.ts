import { describe, expect, it } from 'vitest';
import { nameplateRows } from '../src/model/nameplateRows';
import { regenerateAll } from '../src/layout';
import { sampleProject } from '../src/model/defaults';
import type { Element, Project } from '../src/model/types';

function seeded(): Project {
  const p = sampleProject();
  return { ...p, diagrams: regenerateAll(p).diagrams };
}

/** 図面の先頭に銘板つきの機器を 1 台足す */
function withHandDevice(p: Project, el: Partial<Element>): Project {
  const d = p.diagrams[0]!;
  const base: Element = { id: 'h1', kind: 'OCR', x: 50, y: 50, rot: 0, labels: ['予備 OCR'], origin: 'manual' };
  return {
    ...p,
    diagrams: p.diagrams.map((x) => (x.id === d.id ? { ...x, elements: [...x.elements, { ...base, ...el }] } : x)),
  };
}

describe('機器銘板表', () => {
  it('図面で足した機器の銘板が表の行になる', () => {
    const p = withHandDevice(seeded(), { nameplate: { maker: '三菱電機', model: 'CO-9' } });
    const rows = nameplateRows(p);
    const r = rows.find((x) => x.maker === '三菱電機')!;
    expect(r).toBeTruthy();
    expect(r.model).toBe('CO-9');
    // 機器名称は未入力なら図記号の名前
    expect(r.deviceName).toBe('過電流継電器 (OCR)');
    // 定格が空ならラベルの 1 行目で埋める
    expect(r.ratingText).toBe('予備 OCR');
    // 備考は図面名
    expect(r.note).toBe(p.diagrams[0]!.title);
  });

  it('機器名称を入れればそれを使う', () => {
    const p = withHandDevice(seeded(), { nameplateName: '予備継電器', nameplate: { maker: 'A社' } });
    expect(nameplateRows(p).find((x) => x.maker === 'A社')!.deviceName).toBe('予備継電器');
  });

  it('銘板の無い機器は表に出ない', () => {
    const before = nameplateRows(seeded()).length;
    const after = nameplateRows(withHandDevice(seeded(), {})).length;
    expect(after).toBe(before);
  });

  it('自動生成の機器は二重に出ない', () => {
    const p = seeded();
    const rows = nameplateRows(p);
    // VCB は仕様側から 1 行だけ
    expect(rows.filter((r) => r.deviceName === 'VCB').length).toBe(1);
  });

  it('自動作図の機器に銘板が付いていても表には出さない（仕様側と二重になるため）', () => {
    const p0 = seeded();
    const before = nameplateRows(p0).length;
    const p: Project = {
      ...p0,
      diagrams: p0.diagrams.map((d, i) =>
        i === 0
          ? { ...d, elements: d.elements.map((e) => (e.kind === 'VCB' ? { ...e, nameplate: { maker: 'X社' } } : e)) }
          : d,
      ),
    };
    const rows = nameplateRows(p);
    expect(rows.length).toBe(before);
    expect(rows.some((r) => r.maker === 'X社')).toBe(false);
  });

  it('数量は既定 1、2 以上なら表と合計に効く', () => {
    const p0 = seeded();
    const base = nameplateRows(p0);
    expect(base.every((r) => r.qty === 1)).toBe(true);
    const p = withHandDevice(p0, { nameplate: { maker: 'B社', qty: 2 } });
    const rows = nameplateRows(p);
    expect(rows.find((r) => r.maker === 'B社')!.qty).toBe(2);
    expect(rows.reduce((n, r) => n + r.qty, 0)).toBe(base.length + 2);
  });

  it('銘板表の図面に数量列が出る', () => {
    const p = withHandDevice(seeded(), { nameplate: { maker: 'C社', qty: 3 } });
    const d = regenerateAll(p).diagrams.find((x) => x.kind === 'nameplate')!;
    expect(d.texts.some((t) => t.text === '数量')).toBe(true);
    expect(d.texts.some((t) => t.text === '3')).toBe(true);
  });
});
