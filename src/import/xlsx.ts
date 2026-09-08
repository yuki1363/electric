/**
 * 最小限の .xlsx リーダー。
 *
 * セルの表示文字列を取り出すことだけを目的にしている（数式は計算済みの値を読む）。
 * 解凍に fflate を使うが、取り込み時にしか要らないので動的 import する。
 */

export interface SheetData {
  name: string;
  /** 行 × 列。空セルは '' で埋めてある */
  rows: string[][];
}

/** XML のタグを総なめして属性と内容を取り出す簡易パーサ（この用途には十分） */
function* iterTags(xml: string, tag: string): Generator<{ attrs: string; inner: string }> {
  const re = new RegExp(`<${tag}(\\s[^>]*?)?(/)?>`, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const attrs = m[1] ?? '';
    if (m[2]) {
      yield { attrs, inner: '' };
      continue;
    }
    const close = `</${tag}>`;
    const end = xml.indexOf(close, re.lastIndex);
    if (end < 0) return;
    yield { attrs, inner: xml.slice(re.lastIndex, end) };
    re.lastIndex = end + close.length;
  }
}

function attr(attrs: string, name: string): string | undefined {
  const m = attrs.match(new RegExp(`${name}="([^"]*)"`));
  return m ? m[1] : undefined;
}

const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&apos;': "'",
};

function decodeXml(s: string): string {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&(amp|lt|gt|quot|apos);/g, (m) => ENTITIES[m] ?? m);
}

/**
 * <si> / <is> の中の <t> を連結する（リッチテキスト対応）。
 * ふりがな（<rPh>）は本文ではないので取り除く。
 */
function textOf(xml: string): string {
  const body = xml.replace(/<rPh[\s\S]*?<\/rPh>/g, '').replace(/<phoneticPr[^>]*\/?>/g, '');
  let out = '';
  for (const { inner } of iterTags(body, 't')) out += decodeXml(inner);
  return out;
}

/** A1 形式の列部分を 0 始まりの番号へ */
export function colIndex(ref: string): number {
  const letters = ref.replace(/\d+$/, '');
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

/** Excel のシリアル値を YYYY-MM-DD へ（1900 年うるう年バグを含む既定の基準日） */
export function serialToDate(v: number): string {
  const ms = Math.round((v - 25569) * 86400 * 1000);
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return String(v);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
}

/** 組み込みの日付書式 id */
const DATE_FMT_IDS = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 45, 46, 47]);

/** styles.xml から「この書式は日付か」を引ける表を作る */
function parseDateStyles(stylesXml: string | undefined): boolean[] {
  if (!stylesXml) return [];
  const customDate = new Set<number>();
  for (const { attrs } of iterTags(stylesXml, 'numFmt')) {
    const id = Number(attr(attrs, 'numFmtId'));
    const code = decodeXml(attr(attrs, 'formatCode') ?? '');
    // 文字列リテラルを除いた部分に y/m/d が含まれれば日付とみなす
    const bare = code.replace(/"[^"]*"/g, '').replace(/\[[^\]]*\]/g, '');
    if (/[yYdD]/.test(bare) || /m{3,}/.test(bare)) customDate.add(id);
  }
  const out: boolean[] = [];
  const cellXfs = stylesXml.slice(stylesXml.indexOf('<cellXfs'));
  for (const { attrs } of iterTags(cellXfs, 'xf')) {
    const id = Number(attr(attrs, 'numFmtId') ?? '0');
    out.push(DATE_FMT_IDS.has(id) || customDate.has(id));
  }
  return out;
}

/** 数値をセルの見た目に近い文字列へ（不要な小数を出さない） */
function numberToText(v: number): string {
  if (Number.isInteger(v)) return String(v);
  return String(Number(v.toFixed(10)));
}

/** .xlsx のバイト列から全シートを読む */
export async function readXlsx(data: ArrayBuffer | Uint8Array): Promise<SheetData[]> {
  const { unzipSync, strFromU8 } = await import('fflate');
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch {
    throw new Error('xlsx として展開できませんでした。ファイルが壊れているか、.xls（旧形式）の可能性があります');
  }
  const read = (name: string): string | undefined => {
    const f = files[name];
    return f ? strFromU8(f) : undefined;
  };

  const workbook = read('xl/workbook.xml');
  if (!workbook) throw new Error('xl/workbook.xml がありません。xlsx ファイルではないようです');

  // シート名と rId の対応
  const sheets: { name: string; rid: string }[] = [];
  for (const { attrs } of iterTags(workbook, 'sheet')) {
    const name = decodeXml(attr(attrs, 'name') ?? '');
    const rid = attr(attrs, 'r:id') ?? '';
    if (name) sheets.push({ name, rid });
  }

  // rId → シートのパス
  const rels = read('xl/_rels/workbook.xml.rels') ?? '';
  const relTarget = new Map<string, string>();
  for (const { attrs } of iterTags(rels, 'Relationship')) {
    const id = attr(attrs, 'Id');
    const target = attr(attrs, 'Target');
    if (id && target) relTarget.set(id, target.replace(/^\/?xl\//, '').replace(/^\.\//, ''));
  }

  // 共有文字列
  const sharedXml = read('xl/sharedStrings.xml');
  const shared: string[] = [];
  if (sharedXml) for (const { inner } of iterTags(sharedXml, 'si')) shared.push(textOf(inner));

  const dateStyles = parseDateStyles(read('xl/styles.xml'));

  const out: SheetData[] = [];
  sheets.forEach((sh, i) => {
    const path = relTarget.get(sh.rid) ?? `worksheets/sheet${i + 1}.xml`;
    const xml = read(`xl/${path}`) ?? read(`xl/worksheets/sheet${i + 1}.xml`);
    if (!xml) return;

    const rows: string[][] = [];
    for (const { inner: rowXml } of iterTags(xml, 'row')) {
      const cells: string[] = [];
      let auto = 0;
      for (const { attrs, inner } of iterTags(rowXml, 'c')) {
        const ref = attr(attrs, 'r');
        const ci = ref ? colIndex(ref) : auto;
        auto = ci + 1;
        const type = attr(attrs, 't');
        let text = '';
        if (type === 'inlineStr') {
          text = textOf(inner);
        } else {
          const vm = inner.match(/<v[^>]*>([\s\S]*?)<\/v>/);
          const raw = vm ? decodeXml(vm[1]!) : '';
          if (!raw) text = '';
          else if (type === 's') text = shared[Number(raw)] ?? '';
          else if (type === 'str' || type === 'e') text = raw;
          else if (type === 'b') text = raw === '1' ? 'TRUE' : 'FALSE';
          else {
            const num = Number(raw);
            const styleIdx = Number(attr(attrs, 's') ?? '-1');
            if (Number.isFinite(num) && styleIdx >= 0 && dateStyles[styleIdx] && num > 0) {
              text = serialToDate(num);
            } else {
              text = Number.isFinite(num) ? numberToText(num) : raw;
            }
          }
        }
        while (cells.length < ci) cells.push('');
        cells[ci] = text;
      }
      rows.push(cells);
    }
    out.push({ name: sh.name, rows });
  });

  if (out.length === 0) throw new Error('読み取れるシートがありませんでした');
  return out;
}

/** CSV / TSV を同じ形に読む（区切りは自動判定） */
export function readCsv(text: string): SheetData[] {
  const body = text.replace(/^﻿/, '');
  const delim = (body.split('\n')[0] ?? '').includes('\t') ? '\t' : ',';
  const rows: string[][] = [];
  let cell = '';
  let row: string[] = [];
  let quoted = false;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i]!;
    if (quoted) {
      if (ch === '"') {
        if (body[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === delim) {
      row.push(cell);
      cell = '';
    } else if (ch === '\n') {
      row.push(cell.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell || row.length) {
    row.push(cell.replace(/\r$/, ''));
    rows.push(row);
  }
  return [{ name: 'CSV', rows }];
}
