import Encoding from 'encoding-japanese';
import type { DxfCodepage } from './dxf';

/** DXF 文字列をバイト列へ。既定は Shift_JIS（JW-CAD / AutoCAD 日本語版向け） */
export function encodeDxf(text: string, codepage: DxfCodepage): Uint8Array {
  if (codepage === 'utf8') return new TextEncoder().encode(text);
  const codes = Encoding.convert(Encoding.stringToCode(text), { to: 'SJIS', from: 'UNICODE' });
  return Uint8Array.from(codes);
}
