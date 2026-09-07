import type { DxfCodepage } from './dxf';

/**
 * DXF 文字列をバイト列へ。既定は Shift_JIS（JW-CAD / AutoCAD 日本語版向け）。
 * 変換ライブラリは DXF 出力時のみ必要なため動的に読み込む。
 */
export async function encodeDxf(text: string, codepage: DxfCodepage): Promise<Uint8Array> {
  if (codepage === 'utf8') return new TextEncoder().encode(text);
  const { default: Encoding } = await import('encoding-japanese');
  const codes = Encoding.convert(Encoding.stringToCode(text), { to: 'SJIS', from: 'UNICODE' });
  return Uint8Array.from(codes);
}
