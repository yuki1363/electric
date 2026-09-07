import { describe, expect, it } from 'vitest';
import { escapeXml, primToSvg, svgDocument } from '../src/render/svg';

describe('SVG レンダラ', () => {
  it('line', () => {
    expect(primToSvg({ t: 'line', x1: 0, y1: 1, x2: 2, y2: 3 })).toBe(
      '<line x1="0" y1="1" x2="2" y2="3" stroke-width="0.35"/>',
    );
  });

  it('circle（塗り）', () => {
    const s = primToSvg({ t: 'circle', cx: 1, cy: 2, r: 0.8, fill: true });
    expect(s).toContain('<circle');
    expect(s).toContain('fill="currentColor"');
  });

  it('arc: 半円は largeArc=0, sweep=1', () => {
    const s = primToSvg({ t: 'arc', cx: 0, cy: 0, r: 1, start: -90, end: 90 });
    expect(s).toContain('M 0 -1 A 1 1 0 0 1 0 1');
  });

  it('arc: 270° は largeArc=1', () => {
    const s = primToSvg({ t: 'arc', cx: 0, cy: 0, r: 1, start: 0, end: 270 });
    expect(s).toContain(' 0 1 1 ');
  });

  it('polyline / polygon', () => {
    expect(primToSvg({ t: 'polyline', pts: [{ x: 0, y: 0 }, { x: 1, y: 1 }] })).toContain('<polyline points="0,0 1,1"');
    expect(primToSvg({ t: 'polyline', pts: [{ x: 0, y: 0 }, { x: 1, y: 1 }], closed: true })).toContain('<polygon');
  });

  it('text は XML エスケープされ、中央揃えを反映', () => {
    const s = primToSvg({ t: 'text', x: 1, y: 2, text: 'A<B&"C"', h: 3.5, anchor: 'middle', valign: 'middle' });
    expect(s).toContain('A&lt;B&amp;&quot;C&quot;');
    expect(s).toContain('text-anchor="middle"');
    expect(s).toContain('dominant-baseline="central"');
  });

  it('text の回転', () => {
    const s = primToSvg({ t: 'text', x: 1, y: 2, text: 'x', h: 3, rot: 90 });
    expect(s).toContain('transform="rotate(90 1 2)"');
  });

  it('文書に xmlns / viewBox / mm 寸法が含まれる', () => {
    const d = svgDocument('<g/>', { width: 420, height: 297 });
    expect(d).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(d).toContain('width="420mm"');
    expect(d).toContain('viewBox="0 0 420 297"');
  });

  it('escapeXml', () => {
    expect(escapeXml("<&>'\"")).toBe('&lt;&amp;&gt;&apos;&quot;');
  });
});
