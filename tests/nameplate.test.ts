import { describe, expect, it } from 'vitest';
import { nameplateRows } from '../src/model/nameplateRows';
import { regenerateAll } from '../src/layout';
import { sampleProject } from '../src/model/defaults';
import type { Diagram, Element, Project } from '../src/model/types';

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
    expect(r.deviceName).toBe('過電流継電器 (OCR・51)');
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
    // 行数によっては表が複数ページに分かれるので、銘板表の全ページから探す
    const ds = regenerateAll(p).diagrams.filter((x) => x.kind === 'nameplate');
    expect(ds.some((d) => d.texts.some((t) => t.text === '数量'))).toBe(true);
    expect(ds.some((d) => d.texts.some((t) => t.text === '3'))).toBe(true);
  });
});

describe('図面から銘板を作る（自動作図オフ）', () => {
  /** 白紙の図面に機器を 2 台置いただけのプロジェクト */
  function drawnOnly(): Project {
    const p = sampleProject();
    const d: Diagram = {
      id: 'dg1',
      kind: 'free',
      title: '受電盤',
      sheet: p.meta.sheet,
      elements: [
        {
          id: 'e1',
          kind: 'VCB',
          x: 60,
          y: 60,
          rot: 0,
          labels: ['VCB 600A'],
          origin: 'manual',
          nameplate: { maker: '富士電機', model: 'HA12AX' },
        },
        { id: 'e2', kind: 'CT', x: 60, y: 90, rot: 0, labels: ['CT 400/5'], nameplate: { maker: '松下電器', qty: 2 } },
        { id: 'e3', kind: 'DS', x: 60, y: 30, rot: 0, labels: ['DS'] },
      ],
      wires: [],
      texts: [],
      shapes: [],
      edited: true,
    };
    return { ...p, meta: { ...p.meta, autoGenerate: false }, diagrams: [d] };
  }

  it('自動作図オフなら仕様の行は出さず、図面の機器だけを出す', () => {
    const rows = nameplateRows(drawnOnly());
    expect(rows.map((r) => r.maker)).toEqual(['富士電機', '松下電器']);
    // 仕様側（PAS・高圧ケーブルなど）は 1 行も出ない
    expect(rows.some((r) => r.deviceName === 'PAS')).toBe(false);
  });

  it('銘板が空の機器は出ない', () => {
    expect(nameplateRows(drawnOnly()).some((r) => r.deviceName.includes('断路器'))).toBe(false);
  });

  it('origin が manual でなくても、仕様に紐づかない図面なら出す', () => {
    const rows = nameplateRows(drawnOnly());
    const ct = rows.find((r) => r.maker === '松下電器')!;
    expect(ct.deviceName).toBe('変流器 (CT)');
    expect(ct.qty).toBe(2);
  });

  it('自動作図オフでも機器銘板表の図面は作り直せる', () => {
    const p = drawnOnly();
    const r = regenerateAll(p);
    // 自動作図オフの経路は reducer 側。ここでは表そのものが作れることを確認する
    expect(r.diagrams.some((d) => d.kind === 'nameplate')).toBe(true);
  });
});
