import { describe, expect, it } from 'vitest';
import { strToU8, zipSync } from 'fflate';
import { colIndex, readCsv, readXlsx, serialToDate } from '../src/import/xlsx';

/**
 * テスト用の最小 xlsx を組み立てる。
 * （いただいた実ファイルは実在設備の製造番号を含むためリポジトリには置かない）
 */
function makeXlsx(opts: {
  sheets: { name: string; xml: string }[];
  shared?: string[];
  styles?: string;
}): Uint8Array {
  const sheetEntries = opts.sheets
    .map((s, i) => `<sheet name="${s.name}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
    .join('');
  const rels = opts.sheets
    .map((_, i) => `<Relationship Id="rId${i + 1}" Target="worksheets/sheet${i + 1}.xml"/>`)
    .join('');
  const shared = opts.shared ?? [];
  const files: Record<string, Uint8Array> = {
    'xl/workbook.xml': strToU8(`<workbook><sheets>${sheetEntries}</sheets></workbook>`),
    'xl/_rels/workbook.xml.rels': strToU8(`<Relationships>${rels}</Relationships>`),
    'xl/sharedStrings.xml': strToU8(`<sst>${shared.join('')}</sst>`),
    'xl/styles.xml': strToU8(opts.styles ?? '<styleSheet><cellXfs><xf numFmtId="0"/></cellXfs></styleSheet>'),
  };
  opts.sheets.forEach((s, i) => {
    files[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(`<worksheet><sheetData>${s.xml}</sheetData></worksheet>`);
  });
  return zipSync(files);
}

const row = (n: number, cells: string) => `<row r="${n}">${cells}</row>`;
const sCell = (ref: string, idx: number) => `<c r="${ref}" t="s"><v>${idx}</v></c>`;
const nCell = (ref: string, v: number, style?: number) =>
  `<c r="${ref}"${style !== undefined ? ` s="${style}"` : ''}><v>${v}</v></c>`;

describe('xlsx リーダー', () => {
  it('共有文字列と数値を読む', async () => {
    const data = makeXlsx({
      shared: ['<si><t>機器名称</t></si>', '<si><t>VCB</t></si>'],
      sheets: [{ name: '銘板表', xml: row(1, sCell('A1', 0) + sCell('B1', 1) + nCell('C1', 600)) }],
    });
    const sheets = await readXlsx(data);
    expect(sheets.length).toBe(1);
    expect(sheets[0]!.name).toBe('銘板表');
    expect(sheets[0]!.rows[0]).toEqual(['機器名称', 'VCB', '600']);
  });

  it('ふりがな（rPh）は本文に含めない', async () => {
    const data = makeXlsx({
      shared: ['<si><t>機器名称</t><rPh sb="0" eb="4"><t>キキメイショウ</t></rPh><phoneticPr fontId="1"/></si>'],
      sheets: [{ name: 'S', xml: row(1, sCell('A1', 0)) }],
    });
    const sheets = await readXlsx(data);
    expect(sheets[0]!.rows[0]![0]).toBe('機器名称');
  });

  it('リッチテキストは連結する', async () => {
    const data = makeXlsx({
      shared: ['<si><r><t>高圧</t></r><r><t>ケーブル</t></r></si>'],
      sheets: [{ name: 'S', xml: row(1, sCell('A1', 0)) }],
    });
    const sheets = await readXlsx(data);
    expect(sheets[0]!.rows[0]![0]).toBe('高圧ケーブル');
  });

  it('飛んだ列は空文字で埋める', async () => {
    const data = makeXlsx({
      shared: ['<si><t>X</t></si>'],
      sheets: [{ name: 'S', xml: row(1, sCell('A1', 0) + sCell('D1', 0)) }],
    });
    expect(await readXlsx(data).then((s) => s[0]!.rows[0])).toEqual(['X', '', '', 'X']);
  });

  it('インライン文字列', async () => {
    const data = makeXlsx({
      sheets: [{ name: 'S', xml: row(1, '<c r="A1" t="inlineStr"><is><t>直書き</t></is></c>') }],
    });
    expect((await readXlsx(data))[0]!.rows[0]![0]).toBe('直書き');
  });

  it('日付書式のセルは日付にする', async () => {
    const styles =
      '<styleSheet><numFmts><numFmt numFmtId="176" formatCode="yyyy&quot;年&quot;m&quot;月&quot;"/></numFmts>' +
      '<cellXfs><xf numFmtId="0"/><xf numFmtId="14"/><xf numFmtId="176"/></cellXfs></styleSheet>';
    const data = makeXlsx({
      styles,
      sheets: [{ name: 'S', xml: row(1, nCell('A1', 45000, 0) + nCell('B1', 45000, 1) + nCell('C1', 45000, 2)) }],
    });
    const r = (await readXlsx(data))[0]!.rows[0]!;
    expect(r[0]).toBe('45000');
    expect(r[1]).toBe('2023-03-15');
    expect(r[2]).toBe('2023-03-15');
  });

  it('XML の実体参照を戻す', async () => {
    const data = makeXlsx({
      shared: ['<si><t>A&amp;B &lt;C&gt;</t></si>'],
      sheets: [{ name: 'S', xml: row(1, sCell('A1', 0)) }],
    });
    expect((await readXlsx(data))[0]!.rows[0]![0]).toBe('A&B <C>');
  });

  it('複数シートを rId の対応で読む', async () => {
    const data = makeXlsx({
      shared: ['<si><t>一枚目</t></si>', '<si><t>二枚目</t></si>'],
      sheets: [
        { name: '目次', xml: row(1, sCell('A1', 0)) },
        { name: '銘板表', xml: row(1, sCell('A1', 1)) },
      ],
    });
    const sheets = await readXlsx(data);
    expect(sheets.map((s) => s.name)).toEqual(['目次', '銘板表']);
    expect(sheets[1]!.rows[0]![0]).toBe('二枚目');
  });

  it('xlsx でないものは分かるエラーにする', async () => {
    await expect(readXlsx(strToU8('これは xlsx ではありません'))).rejects.toThrow(/展開できません/);
    await expect(readXlsx(zipSync({ 'a.txt': strToU8('x') }))).rejects.toThrow(/xlsx ファイルではない/);
  });

  it('列参照 → 列番号', () => {
    expect(colIndex('A1')).toBe(0);
    expect(colIndex('Z9')).toBe(25);
    expect(colIndex('AA1')).toBe(26);
    expect(colIndex('AB12')).toBe(27);
  });

  it('シリアル値 → 日付', () => {
    expect(serialToDate(45000)).toBe('2023-03-15');
  });
});

describe('CSV リーダー', () => {
  it('引用符と改行を含む CSV', () => {
    const rows = readCsv('a,b\n"x,1","2\n3"\n')[0]!.rows;
    expect(rows[0]).toEqual(['a', 'b']);
    expect(rows[1]).toEqual(['x,1', '2\n3']);
  });

  it('タブ区切りも読む', () => {
    expect(readCsv('a\tb\n1\t2')[0]!.rows[1]).toEqual(['1', '2']);
  });

  it('二重引用符のエスケープ', () => {
    expect(readCsv('"a""b"')[0]!.rows[0]).toEqual(['a"b']);
  });
});
