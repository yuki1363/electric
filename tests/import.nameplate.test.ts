import { describe, expect, it } from 'vitest';
import { keyOf, normalize } from '../src/import/normalize';
import { classifyGroup, detectHeader, parseRating, parseRows, pickSheet } from '../src/import/nameplate';
import { buildImportPlan } from '../src/import/plan';
import type { SheetData } from '../src/import/xlsx';

const HEADER = ['機器名称', '型式', '定格容量', '製造者', '製造年月', '製造番号', '使用箇所', '備考'];

/** 実際の台帳と同じ形（表題行・繰り返しヘッダあり）のシートを組み立てる */
function sheet(rows: string[][]): SheetData {
  return { name: '銘板表', rows: [['機器銘板表'], HEADER, ...rows] };
}

describe('正規化', () => {
  it('全角英数と各種ハイフンを半角へ寄せる', () => {
    expect(normalize('ＨＡ１２ＡＸ－Ａ１')).toBe('HA12AX-A1');
    expect(normalize('HA12AX‐A1')).toBe('HA12AX-A1'); // U+2010
    expect(normalize('K2OC－AVN')).toBe('K2OC-AVN');
  });

  it('全角スペースを畳む', () => {
    expect(normalize('7.2kV　　600A')).toBe('7.2kV 600A');
    expect(normalize('  No.1　SC   ')).toBe('No.1 SC');
  });

  it('比較キーは空白と記号を落とす', () => {
    expect(keyOf('No.1　SC')).toBe(keyOf('no1 sc'));
    expect(keyOf('機 器 名 称')).toBe('機器名称');
  });
});

describe('定格の解析', () => {
  it('変圧器', () => {
    expect(parseRating('500kVA　6600/440')).toMatchObject({ kva: 500, primaryV: 6600, secondaryV: 440 });
    expect(parseRating('50kｖA')).toMatchObject({ kva: 50 });
  });

  it('遮断器', () => {
    expect(parseRating('7.2kV600A 12.5kA')).toMatchObject({ a: 600, ka: 12.5, primaryV: 7200 });
  });

  it('CT 比', () => {
    expect(parseRating('6900V　400/5')).toMatchObject({ ratio: '400/5A' });
    expect(parseRating('6900V　75/5')).toMatchObject({ ratio: '75/5A' });
  });

  it('コンデンサとリアクトル', () => {
    expect(parseRating('50kvar 6600V  4.37A')).toMatchObject({ kvar: 50 });
    expect(parseRating('3kvar L=6 %  229V')).toMatchObject({ kvar: 3, reactorPct: 6 });
  });

  it('読み取れなくても落ちない', () => {
    expect(parseRating('')).toEqual({});
    expect(parseRating('取引用計器')).toEqual({});
  });
});

describe('所属の分類', () => {
  it('盤名から振り分ける', () => {
    expect(classifyGroup('高圧受電盤').kind).toBe('main');
    expect(classifyGroup('高圧分岐盤No.1　F1').kind).toBe('feeder');
    expect(classifyGroup('コンデンサ盤No.1').kind).toBe('feeder');
    expect(classifyGroup('No.1　SC').kind).toBe('capacitor');
    expect(classifyGroup('低圧設備動力No.1').kind).toBe('lvPanel');
    expect(classifyGroup('事務棟　電灯').kind).toBe('lvPanel');
    expect(classifyGroup('柱上').kind).toBe('incoming');
    expect(classifyGroup('200sq　250m　CVT').kind).toBe('incoming');
  });

  it('電線サイズが付いたケーブル行は同じ分岐盤にまとめる', () => {
    const a = classifyGroup('高圧分岐盤No.1　F1');
    const b = classifyGroup('高圧分岐盤No.1　F1　38sq');
    expect(b.kind).toBe('feeder');
    expect(b.name).toBe(a.name);
  });

  it('使用箇所からも柱上を判定する', () => {
    expect(classifyGroup('', '第１柱').kind).toBe('incoming');
  });
});

describe('見出し行の検出と行の抽出', () => {
  const s = sheet([
    ['SOG', '', '', '', '', '', '第１柱', '柱上'],
    ['機器銘板表'], // ページ区切りの表題
    HEADER, // 繰り返しのヘッダ
    ['VCB', 'HA12AX-A1', '7.2kV600A 12.5kA', '富士電機', '2017.8', 'F4007', '2F電気室', '高圧受電盤'],
    [], // 空行
  ]);

  it('見出し行を見つけ、全列を対応づける', () => {
    const h = detectHeader(s.rows)!;
    expect(h.rowIndex).toBe(1);
    expect(h.score).toBe(8);
    expect(h.map.deviceName).toBe(0);
    expect(h.map.note).toBe(7);
  });

  it('繰り返しヘッダ・表題行・空行をデータから除く', () => {
    const h = detectHeader(s.rows)!;
    const rows = parseRows(s, h);
    expect(rows.map((r) => r.deviceName)).toEqual(['SOG', 'VCB']);
    expect(rows[1]!.model).toBe('HA12AX-A1');
    expect(rows[1]!.rating.ka).toBe(12.5);
  });

  it('見出しが違う台帳でも拾える', () => {
    const other: SheetData = {
      name: '台帳',
      rows: [['機器名', '形式', '容量', 'メーカー', '製造年', '製番', '設置場所', '所属'], ['DS', 'V3-6', '', '', '', '', '', '受電盤']],
    };
    const h = detectHeader(other.rows)!;
    expect(h.map.model).toBe(1);
    expect(h.map.maker).toBe(3);
    expect(parseRows(other, h)[0]!.deviceName).toBe('DS');
  });

  it('複数シートから銘板表らしいものを選ぶ', () => {
    const picked = pickSheet([{ name: 'メモ', rows: [['あ', 'い']] }, s])!;
    expect(picked.sheet.name).toBe('銘板表');
  });

  it('見出しが無ければ null', () => {
    expect(detectHeader([['あ', 'い']])).toBeNull();
    expect(pickSheet([{ name: 'x', rows: [['あ']] }])).toBeNull();
  });
});

describe('取り込み計画', () => {
  const s = sheet([
    ['SOG', '', '', '', '', '', '第１柱', '柱上'],
    ['高圧ケーブル', '', '6600V', '矢崎', '2019', '', '第１柱～2F', '200sq　250m　CVT'],
    ['DS', 'V3-6', '7.2kV600A', '富士電機', '', '963F', '2F電気室', '高圧受電盤'],
    ['VCB', 'HA12AX-A1', '7.2kV600A 12.5kA', '富士電機', '2017.8', 'F4007', '2F電気室', '高圧受電盤'],
    ['CT', 'EA-65B', '6900V　400/5', '松下電器', '1996', '82417', '2F電気室', '高圧受電盤'],
    ['OCR', 'K2OC－AVN', '', 'オムロン', '2019', '980380', '2F電気室', '高圧受電盤'],
    ['VT', 'EV-620F', '6900/110　200VA', '松下電器', '1996', '96823', '2F電気室', '高圧受電盤'],
    ['VT', 'EV-605R', '6900/110　50VA', '松下電器', '1996', '62636', '2F電気室', '高圧受電盤'],
    ['VCB', 'HA12AX-A1', '7.2kV600A 12.5kA', '富士電機', '2018.8', 'F3576', '2F電気室', '高圧分岐盤No.1　F1'],
    ['CT', 'EA-6L', '6900V　75/5', '松下電器', '1996', '06412', '2F電気室', '高圧分岐盤No.1　F1'],
    ['OCR', 'K2CAD03-F4', '', 'オムロン', '2018', '89017', '2F電気室', '高圧分岐盤No.1　F1'],
    ['高圧ケーブル', '', '6600V', '昭和電線', '1996', '', '2F電気室', '高圧分岐盤No.1　F1　38sq'],
    ['LBS', 'LBS-6A/200', '7.2kV200A', '富士電機', '2017.8', '1708', '2F電気室', 'No.1　SC'],
    ['VCS', 'HK-6/200', '7.2kV200A', '富士電機', '2017.8', 'V1708', '2F電気室', 'No.1　SC'],
    ['PF', 'JC-6/20', '7.2kV　G20', '富士電機', '2017', '174G', '2F電気室', 'No.1　SC'],
    ['SR', 'XTR-ASC7', '3kvar L=6 %  229V', '東芝', '1996', '96023821', '2F電気室', 'No.1　SC'],
    ['SC', 'BRTR-A6NR', '50kvar 6600V  4.37A', '東芝', '1996', '', '2F電気室', 'No.1　SC'],
    ['Tr', '', '500kVA　6600/440', '', '1996', '', '2F電気室', '低圧設備動力No.1'],
    ['LBS', 'LBS-6A/200', '7.2kV200A', '富士電機', '2017', '1709', '2F電気室', '低圧設備動力No.1'],
    ['PF', 'JC-6/30', '7.2kV　G30', '富士電機', '2017', '175G', '2F電気室', '低圧設備動力No.1'],
    ['Tr', '', '300kVA6600/210/105', '', '1996', '', '事務棟屋上', '事務棟　電灯'],
    ['SC引き外し', 'VCB-T1PB', '', '', '2019', '2040', '2F電気室', '高圧受電盤'],
  ]);
  const h = detectHeader(s.rows)!;
  const plan = buildImportPlan(parseRows(s, h));

  it('受電盤の機器を仕様へ反映する', () => {
    expect(plan.hvPatch.mainBreaker).toMatchObject({
      type: 'CB',
      vcb: { ratedA: 600, breakingKA: 12.5 },
      ocr: true,
      ctRatio: '400/5A',
    });
    expect(plan.hvSlots.vcb?.model).toBe('HA12AX-A1');
    expect(plan.hvSlots.ocr?.model).toBe('K2OC-AVN'); // 全角ハイフンが直っている
    expect(plan.hvPatch.pas).toMatchObject({ kind: 'PAS', sog: true });
    expect(plan.hvPatch.cable).toMatchObject({ type: 'CVT', sq: 200, lengthM: 250 });
  });

  it('分岐盤を作り、ケーブルも同じ盤にまとめる', () => {
    expect(plan.feeders.length).toBe(1);
    const f = plan.feeders[0]!;
    expect(f.name).toBe('高圧分岐盤No.1 F1');
    expect(f).toMatchObject({ breaker: 'VCB', ratedA: 600, ct: true, ctRatio: '75/5A', ocr: true });
    expect(f.cable).toMatchObject({ type: 'CVT', sq: 38 });
  });

  it('コンデンサは SC / SR / 開閉器をまとめて 1 台にする', () => {
    expect(plan.capacitors.length).toBe(1);
    // LBS + PF + VCS + SR + SC の構成は LBS+VCS として取り込む
    expect(plan.capacitors[0]).toMatchObject({ name: 'No.1 SC', kvar: 50, sr: true, switch: 'LBS+VCS', pfA: 20 });
  });

  it('変圧器の相と二次電圧を定格から読む', () => {
    expect(plan.transformers.length).toBe(2);
    expect(plan.transformers[0]).toMatchObject({ kva: 500, secondary: '440V', phase: '3φ' });
    // 二次に 105 が出てくるものは単相とみなす
    expect(plan.transformers[1]).toMatchObject({ kva: 300, secondary: '210/105V', phase: '1φ' });
  });

  it('低圧の盤を作り、変圧器の給電先に紐付ける', () => {
    expect(plan.panels.map((p) => p.name)).toEqual(['低圧設備動力No.1', '事務棟 電灯']);
    expect(plan.transformers[0]!.feeds).toBe(plan.panels[0]!.id);
    // 盤名から供給方式を推定する
    expect(plan.panels[1]!.supply).toBe('1φ3W100/200');
  });

  it('図面に描けない機器と 2 台目以降は銘板表に残す', () => {
    const names = plan.extras.map((e) => e.deviceName);
    expect(names).toContain('SC引き外し');
    expect(names).toContain('VT'); // 2 台目の VT
    expect(names).toContain('LBS'); // コンデンサ・変圧器の高圧側開閉器
    const vt2 = plan.extras.find((e) => e.model === 'EV-605R');
    expect(vt2).toBeDefined();
  });

  it('分岐盤と変圧器の対応が分からないことを知らせる', () => {
    expect(plan.notes.some((n) => n.includes('所属分岐盤'))).toBe(true);
  });

  it('分岐盤の VCS も開閉方式に反映する', () => {
    const s2 = sheet([
      ['LBS', 'LBS-6A/200', '7.2kV200A', '富士電機', '2017', '1801', '2F電気室', '高圧分岐盤No.9 F9'],
      ['PF', 'JC-6/30', '7.2kV　G30', '富士電機', '2017', '176G', '2F電気室', '高圧分岐盤No.9 F9'],
      ['VCS', 'HK-6/200', '7.2kV200A', '富士電機', '2017', 'V1801', '2F電気室', '高圧分岐盤No.9 F9'],
    ]);
    const f = buildImportPlan(parseRows(s2, detectHeader(s2.rows)!)).feeders[0]!;
    expect(f).toMatchObject({ breaker: 'LBS+VCS', ratedA: 200, pfA: 30 });
    expect(f.nameplates?.vcs?.model).toBe('HK-6/200');
  });

  it('VCS だけの盤は VCS になる', () => {
    const s2 = sheet([['VCS', 'HK-6/200', '7.2kV200A', '富士電機', '2017', 'V1', '2F電気室', '高圧分岐盤No.9 F9']]);
    const f = buildImportPlan(parseRows(s2, detectHeader(s2.rows)!)).feeders[0]!;
    expect(f.breaker).toBe('VCS');
  });

  it('1 行も無ければ何も作らない', () => {
    const empty = buildImportPlan([]);
    expect(empty.feeders).toEqual([]);
    expect(empty.transformers).toEqual([]);
    expect(empty.extras).toEqual([]);
  });
});
