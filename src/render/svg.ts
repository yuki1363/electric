import type { Prim, StrokeClass } from '../symbols/types';
import { round } from '../geom/point';
import { DEFAULT_STROKE, FONT_FAMILY, STROKE_WIDTH } from './style';

export function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

const n = (v: number) => String(round(v, 3));

function strokeAttr(stroke: StrokeClass | undefined, base: StrokeClass): string {
  const w = STROKE_WIDTH[stroke ?? base];
  return `stroke-width="${n(w)}"`;
}

export interface SvgOpts {
  /** レイヤ既定線幅 */
  baseStroke?: StrokeClass;
  color?: string;
}

/** 1 プリミティブを SVG 要素文字列へ */
export function primToSvg(p: Prim, opts: SvgOpts = {}): string {
  const base = opts.baseStroke ?? DEFAULT_STROKE;
  const color = opts.color ?? 'currentColor';
  switch (p.t) {
    case 'line':
      return `<line x1="${n(p.x1)}" y1="${n(p.y1)}" x2="${n(p.x2)}" y2="${n(p.y2)}" ${strokeAttr(p.stroke, base)}/>`;
    case 'circle':
      return `<circle cx="${n(p.cx)}" cy="${n(p.cy)}" r="${n(p.r)}" ${strokeAttr(p.stroke, base)}${
        p.fill ? ` fill="${color}"` : ''
      }/>`;
    case 'arc': {
      const s = (p.start * Math.PI) / 180;
      const e = (p.end * Math.PI) / 180;
      const sx = p.cx + p.r * Math.cos(s);
      const sy = p.cy + p.r * Math.sin(s);
      const ex = p.cx + p.r * Math.cos(e);
      const ey = p.cy + p.r * Math.sin(e);
      const sweep = (((p.end - p.start) % 360) + 360) % 360;
      const large = sweep > 180 ? 1 : 0;
      return `<path d="M ${n(sx)} ${n(sy)} A ${n(p.r)} ${n(p.r)} 0 ${large} 1 ${n(ex)} ${n(ey)}" ${strokeAttr(
        p.stroke,
        base,
      )}/>`;
    }
    case 'polyline': {
      const pts = p.pts.map((q) => `${n(q.x)},${n(q.y)}`).join(' ');
      const tag = p.closed ? 'polygon' : 'polyline';
      return `<${tag} points="${pts}" ${strokeAttr(p.stroke, base)}${p.fill ? ` fill="${color}"` : ''}/>`;
    }
    case 'text': {
      const anchor = p.anchor ?? 'start';
      const valign = p.valign ?? 'baseline';
      const baseline = valign === 'middle' ? 'central' : valign === 'top' ? 'hanging' : 'alphabetic';
      const rot = p.rot ? ` transform="rotate(${n(p.rot)} ${n(p.x)} ${n(p.y)})"` : '';
      return `<text x="${n(p.x)}" y="${n(p.y)}" font-size="${n(p.h)}" text-anchor="${anchor}" dominant-baseline="${baseline}" stroke="none" fill="${color}"${rot}>${escapeXml(
        p.text,
      )}</text>`;
    }
  }
}

export function primsToSvg(prims: Prim[], opts: SvgOpts = {}): string {
  return prims.map((p) => primToSvg(p, opts)).join('');
}

/** 共通属性を持つグループでラップ */
export function svgGroup(inner: string, attrs = ''): string {
  return `<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"${attrs ? ' ' + attrs : ''}>${inner}</g>`;
}

export interface SvgDocOpts {
  width: number;
  height: number;
  /** 画面表示用の追加属性 */
  extraAttrs?: string;
}

/** 単体 SVG 文書（mm 実寸） */
export function svgDocument(inner: string, o: SvgDocOpts): string {
  const w = n(o.width);
  const h = n(o.height);
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}mm" height="${h}mm" viewBox="0 0 ${w} ${h}" ` +
    `font-family="${escapeXml(FONT_FAMILY)}" color="#000"${o.extraAttrs ? ' ' + o.extraAttrs : ''}>` +
    `<rect x="0" y="0" width="${w}" height="${h}" fill="#fff" stroke="none"/>` +
    inner +
    `</svg>`
  );
}
