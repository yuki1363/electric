import { describe, expect, it } from 'vitest';
import { encodeDxf } from '../src/export/dxfEncode';

describe('DXF エンコード', () => {
  it('Shift_JIS で日本語がエンコードされる', async () => {
    const bytes = await encodeDxf('変圧器', 'sjis');
    expect(bytes.length).toBe(6);
    expect(Array.from(bytes.slice(0, 2))).toEqual([0x95, 0xcf]); // 変
    expect(new TextDecoder('shift_jis').decode(bytes)).toBe('変圧器');
  });

  it('ASCII はそのまま', async () => {
    expect(Array.from(await encodeDxf('AC1009', 'sjis'))).toEqual(Array.from(new TextEncoder().encode('AC1009')));
  });

  it('UTF-8', async () => {
    expect(new TextDecoder().decode(await encodeDxf('φ 変圧器', 'utf8'))).toBe('φ 変圧器');
  });

  it('φ（ギリシャ文字）も Shift_JIS に含まれる', async () => {
    expect(new TextDecoder('shift_jis').decode(await encodeDxf('1φ3W', 'sjis'))).toBe('1φ3W');
  });
});
