/**
 * DXF R12 (AC1009) ASCII ライタ。
 * 用紙座標（mm, y 下向き）を DXF 座標（y 上向き、原点 = 用紙左下）へ変換して出力する。
 */
import type { Prim } from '../symbols/types';
import type { Diagram } from '../model/types';
import type { TitleInfo } from '../layout/sheet';
import { PAPER } from '../layout/constants';
import { round } from '../geom/point';
import { flattenDiagram } from '../render/flatten';
import { LAYER_DXF_COLOR, LAYER_ORDER, type Layer } from '../render/style';

export type DxfCodepage = 'sjis' | 'utf8';

export interface DxfOpts {
  title?: TitleInfo;
  codepage?: DxfCodepage;
}

type Pair = [number, string | number];

/** 整数型グループコード（DXF 仕様: 60–79, 90–99, 170–179, 270–289, 370–389, 400–409, 1060–1071） */
const isIntCode = (c: number): boolean =>
  (c >= 60 && c <= 79) ||
  (c >= 90 && c <= 99) ||
  (c >= 170 && c <= 179) ||
  (c >= 270 && c <= 289) ||
  (c >= 370 && c <= 389) ||
  (c >= 400 && c <= 409) ||
  (c >= 1060 && c <= 1071);

const fmt = (code: number, v: number): string => {
  if (isIntCode(code)) return String(Math.round(v));
  const r = round(v, 4);
  return Number.isInteger(r) ? `${r}.0` : String(r);
};

const norm360 = (a: number): number => {
  let r = a % 360;
  if (r < 0) r += 360;
  return round(r, 4);
};

function sanitize(s: string): string {
  return s.replace(/[\r\n]+/g, ' ');
}

class Writer {
  readonly pairs: Pair[] = [];
  add(code: number, value: string | number): this {
    this.pairs.push([code, typeof value === 'number' ? fmt(code, value) : sanitize(value)]);
    return this;
  }
  toString(): string {
    return this.pairs.map(([c, v]) => `${String(c).padStart(3, ' ')}\r\n${v}\r\n`).join('');
  }
}

export function writeDxf(diagram: Diagram, opts: DxfOpts = {}): string {
  const paper = PAPER[diagram.sheet.size];
  const H = paper.h;
  const w = new Writer();
  const codepage = opts.codepage ?? 'sjis';
  const prims = flattenDiagram(diagram, opts.title ? { frame: opts.title } : {});

  // ---- HEADER
  w.add(0, 'SECTION').add(2, 'HEADER');
  w.add(9, '$ACADVER').add(1, 'AC1009');
  if (codepage === 'sjis') w.add(9, '$DWGCODEPAGE').add(3, 'ANSI_932');
  w.add(9, '$INSUNITS').add(70, 4); // mm
  w.add(9, '$EXTMIN').add(10, 0).add(20, 0).add(30, 0);
  w.add(9, '$EXTMAX').add(10, paper.w).add(20, paper.h).add(30, 0);
  w.add(9, '$LIMMIN').add(10, 0).add(20, 0);
  w.add(9, '$LIMMAX').add(10, paper.w).add(20, paper.h);
  w.add(9, '$LTSCALE').add(40, 1);
  w.add(0, 'ENDSEC');

  // ---- TABLES
  w.add(0, 'SECTION').add(2, 'TABLES');
  w.add(0, 'TABLE').add(2, 'LTYPE').add(70, 1);
  w.add(0, 'LTYPE').add(2, 'CONTINUOUS').add(70, 64).add(3, 'Solid line').add(72, 65).add(73, 0).add(40, 0);
  w.add(0, 'ENDTAB');
  w.add(0, 'TABLE').add(2, 'LAYER').add(70, LAYER_ORDER.length);
  for (const layer of LAYER_ORDER) {
    w.add(0, 'LAYER').add(2, layer).add(70, 64).add(62, LAYER_DXF_COLOR[layer]).add(6, 'CONTINUOUS');
  }
  w.add(0, 'ENDTAB');
  w.add(0, 'TABLE').add(2, 'STYLE').add(70, 1);
  w.add(0, 'STYLE').add(2, 'STANDARD').add(70, 0).add(40, 0).add(41, 1).add(50, 0).add(71, 0).add(42, 2.5).add(3, 'txt').add(4, 'bigfont.shx');
  w.add(0, 'ENDTAB');
  w.add(0, 'ENDSEC');

  // ---- BLOCKS（空）
  w.add(0, 'SECTION').add(2, 'BLOCKS').add(0, 'ENDSEC');

  // ---- ENTITIES
  w.add(0, 'SECTION').add(2, 'ENTITIES');
  for (const wp of prims) writePrim(w, wp.prim, wp.layer, H);
  w.add(0, 'ENDSEC');
  w.add(0, 'EOF');
  return w.toString();
}

function writePrim(w: Writer, p: Prim, layer: Layer, H: number): void {
  const Y = (y: number) => H - y;
  switch (p.t) {
    case 'line':
      w.add(0, 'LINE').add(8, layer).add(10, p.x1).add(20, Y(p.y1)).add(30, 0).add(11, p.x2).add(21, Y(p.y2)).add(31, 0);
      return;
    case 'circle':
      w.add(0, 'CIRCLE').add(8, layer).add(10, p.cx).add(20, Y(p.cy)).add(30, 0).add(40, p.r);
      if (p.fill) {
        // 塗り円は内側に同心円を重ねて表現（R12 にハッチ無し）
        w.add(0, 'CIRCLE').add(8, layer).add(10, p.cx).add(20, Y(p.cy)).add(30, 0).add(40, p.r / 2);
      }
      return;
    case 'arc': {
      // y 反転で角度は符号反転、掃引方向も反転する
      const start = norm360(-p.end);
      const end = norm360(-p.start);
      w.add(0, 'ARC').add(8, layer).add(10, p.cx).add(20, Y(p.cy)).add(30, 0).add(40, p.r).add(50, start).add(51, end);
      return;
    }
    case 'polyline': {
      if (p.pts.length < 2) return;
      w.add(0, 'POLYLINE').add(8, layer).add(66, 1).add(70, p.closed ? 1 : 0).add(10, 0).add(20, 0).add(30, 0);
      for (const q of p.pts) w.add(0, 'VERTEX').add(8, layer).add(10, q.x).add(20, Y(q.y)).add(30, 0);
      w.add(0, 'SEQEND').add(8, layer);
      if (p.fill && p.pts.length >= 3 && p.pts.length <= 4) {
        const [a, b, c, d] = [p.pts[0]!, p.pts[1]!, p.pts[2]!, p.pts[3] ?? p.pts[2]!];
        // SOLID の頂点順は 1,2,4,3（蝶ネクタイ回避）
        w.add(0, 'SOLID').add(8, layer)
          .add(10, a.x).add(20, Y(a.y)).add(30, 0)
          .add(11, b.x).add(21, Y(b.y)).add(31, 0)
          .add(12, d.x).add(22, Y(d.y)).add(32, 0)
          .add(13, c.x).add(23, Y(c.y)).add(33, 0);
      }
      return;
    }
    case 'text': {
      const halign = p.anchor === 'middle' ? 1 : p.anchor === 'end' ? 2 : 0;
      const valign = p.valign === 'middle' ? 2 : p.valign === 'top' ? 3 : 0;
      const rot = norm360(-(p.rot ?? 0));
      w.add(0, 'TEXT').add(8, layer).add(10, p.x).add(20, Y(p.y)).add(30, 0).add(40, p.h).add(1, p.text).add(50, rot).add(7, 'STANDARD');
      if (halign || valign) {
        w.add(72, halign).add(73, valign).add(11, p.x).add(21, Y(p.y)).add(31, 0);
      }
      return;
    }
  }
}
