import type { Point } from '../symbols/types';
import type { Diagram, Element, TextItem, Wire } from '../model/types';
import { isPortEnd } from '../model/types';
import { elementBBox, rerouteWire } from '../layout/builder';
import type { BBox } from '../geom/bbox';
import { getSymbol } from '../symbols';
import { simplifyPolyline } from '../geom/point';
import { STUB } from '../layout/constants';
import { newId, seqId } from '../model/ids';

/** 図面内の純粋な編集操作（すべて新しい Diagram を返す） */

function touched(d: Diagram): Diagram {
  return { ...d, edited: true };
}

/**
 * 手で足したものに印を付ける。
 * 自動生成（DiagramBuilder）は付けないので、図面を作り直すときに
 * 「引き継ぐもの」と「引き直すもの」がこれだけで確実に分かれる。
 */
const manual = <T extends { origin?: 'manual' }>(x: T): T => ({ ...x, origin: 'manual' });

/**
 * 縮小のかかった図面に足すものは、まわりの機器と同じ大きさにそろえる。
 * これをしないと 1:1.15 の図面に等倍の図記号が乗って 1 台だけ大きくなる。
 */
const sized = (d: Diagram, el: Element): Element =>
  el.scale === undefined && d.scale && d.scale !== 1 ? { ...el, scale: d.scale } : el;

/** 選択項目（要素・テキスト・配線）を移動する。接続配線は再ルーティング */
export function moveItems(d: Diagram, ids: ReadonlySet<string>, dx: number, dy: number): Diagram {
  if (dx === 0 && dy === 0) return d;
  const elements = d.elements.map((e) => (ids.has(e.id) ? { ...e, x: e.x + dx, y: e.y + dy } : e));
  const texts = d.texts.map((t) => (ids.has(t.id) ? { ...t, x: t.x + dx, y: t.y + dy } : t));
  const wires = d.wires.map((w) => {
    const fromMoved = isPortEnd(w.from) ? ids.has(w.from.elementId) : false;
    const toMoved = isPortEnd(w.to) ? ids.has(w.to.elementId) : false;
    if (ids.has(w.id) || (fromMoved && toMoved)) {
      // 配線自体、または両端要素が移動 → 全体を平行移動
      const shift = (e: Wire['from']) => (isPortEnd(e) ? e : { x: e.x + dx, y: e.y + dy });
      return { ...w, from: shift(w.from), to: shift(w.to), points: w.points.map((p) => ({ x: p.x + dx, y: p.y + dy })) };
    }
    if (fromMoved || toMoved) return rerouteWire(w, elements);
    return w;
  });
  return touched({ ...d, elements, texts, wires });
}

export function moveLabel(d: Diagram, id: string, offset: Point): Diagram {
  return touched({
    ...d,
    elements: d.elements.map((e) => (e.id === id ? { ...e, labelOffset: offset } : e)),
  });
}

export function updateElement(d: Diagram, id: string, patch: Partial<Element>): Diagram {
  const elements = d.elements.map((e) => (e.id === id ? { ...e, ...patch, id: e.id } : e));
  const moved = 'x' in patch || 'y' in patch || 'rot' in patch;
  const wires = moved
    ? d.wires.map((w) => {
        const hit = (isPortEnd(w.from) && w.from.elementId === id) || (isPortEnd(w.to) && w.to.elementId === id);
        return hit ? rerouteWire(w, elements) : w;
      })
    : d.wires;
  return touched({ ...d, elements, wires });
}

/** 配線の中で p に最も近い線分の向きと、その線分上に落とした点 */
function segmentAt(w: Wire, p: Point): { dir: 'v' | 'h'; at: Point } {
  let best: { d: number; dir: 'v' | 'h'; at: Point } = { d: Infinity, dir: 'v', at: p };
  for (let i = 1; i < w.points.length; i++) {
    const a = w.points[i - 1]!;
    const b = w.points[i]!;
    const vertical = Math.abs(a.x - b.x) < 1e-9;
    const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, Math.min(lo, hi)), Math.max(lo, hi));
    // 直交線分なので、線上の最寄り点は片方の軸を線に合わせ、もう片方を区間に収めるだけ
    const at = vertical ? { x: a.x, y: clamp(p.y, a.y, b.y) } : { x: clamp(p.x, a.x, b.x), y: a.y };
    const d = Math.hypot(p.x - at.x, p.y - at.y);
    if (d < best.d) best = { d, dir: vertical ? 'v' : 'h', at };
  }
  return best;
}

/** 配線の中で p にいちばん近い線分の添字（0 始まり）と向き */
export function nearestSegment(w: Wire, p: Point): { index: number; dir: 'v' | 'h' } | null {
  if (w.points.length < 2) return null;
  let best = { index: 0, dir: 'v' as 'v' | 'h', d: Infinity };
  for (let i = 1; i < w.points.length; i++) {
    const a = w.points[i - 1]!;
    const b = w.points[i]!;
    const vertical = Math.abs(a.x - b.x) < 1e-9;
    const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, Math.min(lo, hi)), Math.max(lo, hi));
    const at = vertical ? { x: a.x, y: clamp(p.y, a.y, b.y) } : { x: clamp(p.x, a.x, b.x), y: a.y };
    const d = Math.hypot(p.x - at.x, p.y - at.y);
    if (d < best.d) best = { index: i - 1, dir: vertical ? 'v' : 'h', d };
  }
  return { index: best.index, dir: best.dir };
}

/**
 * 配線の index 番目の線分を、その線分と直角の向きに delta だけ動かす。
 * 端の線分はポートに付いているので、先頭（末尾）の点を複製してから動かす。
 * こうすると端子の位置は変わらず、根元に折れが 1 つ増えるだけになる。
 */
export function moveWireSegment(d: Diagram, wireId: string, index: number, delta: number, base?: Point[]): Diagram {
  const wires = d.wires.map((w) => {
    if (w.id !== wireId) return w;
    const src = base ?? w.points;
    if (index < 0 || index + 1 >= src.length) return w;
    const pts = src.map((p) => ({ ...p }));
    const vertical = Math.abs(pts[index]!.x - pts[index + 1]!.x) < 1e-9;
    let i = index;
    if (i === 0) {
      pts.unshift({ ...pts[0]! });
      i += 1;
    }
    if (i + 1 === pts.length - 1) pts.push({ ...pts[pts.length - 1]! });
    if (vertical) {
      pts[i]!.x += delta;
      pts[i + 1]!.x += delta;
    } else {
      pts[i]!.y += delta;
      pts[i + 1]!.y += delta;
    }
    return { ...w, manual: true, points: simplifyPolyline(pts) };
  });
  return touched({ ...d, wires });
}

/**
 * 配線 wireId を要素 el で分割し、上流 → el → 下流 の 2 本にする。
 * 線が縦なら N/S、横なら W/E をつなぐ（その向きのポートが無ければ何もしない）。
 */
export function insertIntoWire(d: Diagram, wireId: string, el: Element): Diagram {
  const w = d.wires.find((x) => x.id === wireId);
  if (!w || w.points.length < 2) return d;
  const { dir, at } = segmentAt(w, { x: el.x, y: el.y });
  const [inPort, outPort] = dir === 'v' ? ['N', 'S'] : ['W', 'E'];
  const ports = getSymbol(el.kind).ports;
  if (!ports.some((p) => p.id === inPort) || !ports.some((p) => p.id === outPort)) return d;

  // 線の上にぴったり載せる。格子に丸めると自動縮尺のかかった図面で線がずれる
  const placed: Element = manual(sized(d, dir === 'v' ? { ...el, x: at.x } : { ...el, y: at.y }));

  // 入る隙間が足りなければ、同じ列（行）の下流側をずらして場所を空ける
  const bbox = getSymbol(placed.kind).bbox;
  const need = (dir === 'v' ? bbox.h : bbox.w) + STUB * 2;
  const ends = [w.from, w.to].map((e) => (isPortEnd(e) ? d.elements.find((x) => x.id === e.elementId) : undefined));
  const along = (e: Element | undefined) => (dir === 'v' ? e?.y : e?.x);
  const vals = ends.map(along).filter((v): v is number => v !== undefined);
  const gap = vals.length === 2 ? Math.abs(vals[0]! - vals[1]!) : need;
  const shift = Math.max(0, need - gap);
  const cut = dir === 'v' ? placed.y : placed.x;
  const across = (e: Element) => (dir === 'v' ? e.x : e.y);
  const moved =
    shift > 0
      ? d.elements.map((e) =>
          Math.abs(across(e) - (dir === 'v' ? placed.x : placed.y)) < 0.5 && along(e)! > cut
            ? dir === 'v'
              ? { ...e, y: e.y + shift }
              : { ...e, x: e.x + shift }
            : e,
        )
      : d.elements;

  const elements = [...moved, placed];
  const base = d.wires.filter((x) => x.id !== wireId).map((x) => rerouteWire(x, elements));
  const mk = (n: number, from: Wire['from'], to: Wire['to']): Wire =>
    manual(
      rerouteWire(
        { id: seqId(d.id, d.wires.length + n, 'w'), from, to, points: [], manual: false, style: w.style },
        elements,
      ),
    );
  return touched({
    ...d,
    elements,
    wires: [
      ...base,
      mk(1, w.from, { elementId: placed.id, portId: inPort }),
      mk(2, { elementId: placed.id, portId: outPort }, w.to),
    ],
  });
}

export function addElement(d: Diagram, el: Element): Diagram {
  return touched({ ...d, elements: [...d.elements, manual(sized(d, el))] });
}

export function addWire(d: Diagram, w: Wire): Diagram {
  return touched({ ...d, wires: [...d.wires, manual(rerouteWire(w, d.elements))] });
}

export function updateWire(d: Diagram, id: string, patch: Partial<Wire>): Diagram {
  const wires = d.wires.map((w) => {
    if (w.id !== id) return w;
    const next = { ...w, ...patch, id: w.id };
    return patch.manual === false ? rerouteWire({ ...next, manual: false }, d.elements) : next;
  });
  return touched({ ...d, wires });
}

export function addText(d: Diagram, t: TextItem): Diagram {
  const h = d.scale && d.scale !== 1 ? t.h * d.scale : t.h;
  return touched({ ...d, texts: [...d.texts, manual({ ...t, h })] });
}

export function updateText(d: Diagram, id: string, patch: Partial<TextItem>): Diagram {
  return touched({ ...d, texts: d.texts.map((t) => (t.id === id ? { ...t, ...patch, id: t.id } : t)) });
}

/** 項目を削除。削除要素に接続する配線も削除 */
export function deleteItems(d: Diagram, ids: ReadonlySet<string>): Diagram {
  const elements = d.elements.filter((e) => !ids.has(e.id));
  const texts = d.texts.filter((t) => !ids.has(t.id));
  const wires = d.wires.filter((w) => {
    if (ids.has(w.id)) return false;
    if (isPortEnd(w.from) && ids.has(w.from.elementId)) return false;
    if (isPortEnd(w.to) && ids.has(w.to.elementId)) return false;
    return true;
  });
  return touched({ ...d, elements, texts, wires });
}

/** 選択項目の整列 */
/** 整列のしかた。left/right/top/bottom は外形の端、center は中心線をそろえる */
export type AlignMode = 'left' | 'centerX' | 'right' | 'top' | 'centerY' | 'bottom';

/**
 * 選択した図記号をそろえる。
 * 縦に並べたい（左右をそろえたい）ときは left / centerX / right、
 * 横に並べたい（上下をそろえたい）ときは top / centerY / bottom。
 */
export function alignItems(d: Diagram, ids: ReadonlySet<string>, mode: AlignMode): Diagram {
  const els = d.elements.filter((e) => ids.has(e.id));
  if (els.length < 2) return d;
  const boxes = els.map((e) => ({ e, b: elementBBox(e) }));
  const min = (f: (b: BBox) => number) => Math.min(...boxes.map(({ b }) => f(b)));
  const max = (f: (b: BBox) => number) => Math.max(...boxes.map(({ b }) => f(b)));

  const horizontal = mode === 'left' || mode === 'centerX' || mode === 'right';
  const target =
    mode === 'left'
      ? min((b) => b.minX)
      : mode === 'right'
        ? max((b) => b.maxX)
        : mode === 'centerX'
          ? (min((b) => b.minX) + max((b) => b.maxX)) / 2
          : mode === 'top'
            ? min((b) => b.minY)
            : mode === 'bottom'
              ? max((b) => b.maxY)
              : (min((b) => b.minY) + max((b) => b.maxY)) / 2;

  let out = d;
  for (const { e, b } of boxes) {
    // 端そろえは外形の端、中心そろえは記号の中心を基準にする
    const from =
      mode === 'left' ? b.minX : mode === 'right' ? b.maxX : mode === 'centerX' ? e.x : mode === 'top' ? b.minY : mode === 'bottom' ? b.maxY : e.y;
    const delta = target - from;
    if (delta !== 0) out = moveItems(out, new Set([e.id]), horizontal ? delta : 0, horizontal ? 0 : delta);
  }
  return out;
}

/** 選択した図記号を、両端はそのままに中心の間隔が等しくなるよう並べ直す */
export function distributeItems(d: Diagram, ids: ReadonlySet<string>, axis: 'x' | 'y'): Diagram {
  const els = d.elements.filter((e) => ids.has(e.id));
  if (els.length < 3) return d;
  const sorted = [...els].sort((a, b) => (axis === 'x' ? a.x - b.x : a.y - b.y));
  const first = sorted[0]!;
  const lastEl = sorted[sorted.length - 1]!;
  const a0 = axis === 'x' ? first.x : first.y;
  const a1 = axis === 'x' ? lastEl.x : lastEl.y;
  const step = (a1 - a0) / (sorted.length - 1);
  let out = d;
  sorted.forEach((e, i) => {
    if (i === 0 || i === sorted.length - 1) return;
    const delta = a0 + step * i - (axis === 'x' ? e.x : e.y);
    if (delta !== 0) out = moveItems(out, new Set([e.id]), axis === 'x' ? delta : 0, axis === 'x' ? 0 : delta);
  });
  return out;
}

// ---------------------------------------------------------------- 複製・コピー＆ペースト

/** 図面をまたいで貼り付けるための切り出し。座標は選択範囲の左上を原点にそろえてある */
export interface Clipboard {
  elements: Element[];
  wires: Wire[];
  texts: TextItem[];
  /** 切り出し元の縮尺。貼り付け先と違えば大きさをそろえる */
  scale: number;
  /** 切り出し元での左上の位置（複製でそのすぐ隣に置くため） */
  origin: { x: number; y: number };
}

/** 選択項目を切り出す。両端とも選択内にある配線だけを持っていく */
export function copyItems(d: Diagram, ids: ReadonlySet<string>): Clipboard | null {
  const elements = d.elements.filter((e) => ids.has(e.id));
  const texts = d.texts.filter((t) => ids.has(t.id));
  const elIds = new Set(elements.map((e) => e.id));
  // 端が選択外の機器につながっている配線は持っていかない
  const inside = (e: Wire['from']) => (isPortEnd(e) ? elIds.has(e.elementId) : true);
  const wires = d.wires.filter((w) => inside(w.from) && inside(w.to));
  if (elements.length + texts.length + wires.length === 0) return null;

  const xs = [...elements.map((e) => e.x), ...texts.map((t) => t.x), ...wires.flatMap((w) => w.points.map((p) => p.x))];
  const ys = [...elements.map((e) => e.y), ...texts.map((t) => t.y), ...wires.flatMap((w) => w.points.map((p) => p.y))];
  const ox = Math.min(...xs);
  const oy = Math.min(...ys);
  const shift = <T extends { x: number; y: number }>(p: T): T => ({ ...p, x: p.x - ox, y: p.y - oy });
  return {
    elements: elements.map(shift),
    texts: texts.map(shift),
    wires: wires.map((w) => ({
      ...w,
      from: isPortEnd(w.from) ? w.from : shift(w.from),
      to: isPortEnd(w.to) ? w.to : shift(w.to),
      points: w.points.map(shift),
    })),
    scale: d.scale ?? 1,
    origin: { x: ox, y: oy },
  };
}

/** 貼り付け・複製の共通処理。id を振り直し、配線の参照も新しい id に張り替える */
function insertCopy(
  d: Diagram,
  clip: Clipboard,
  at: { x: number; y: number },
  k: number,
): { diagram: Diagram; ids: string[] } {
  const map = new Map<string, string>();
  const fresh = (id: string) => {
    const next = newId(id.split('_')[0] || 'e');
    map.set(id, next);
    return next;
  };
  const place = <T extends { x: number; y: number }>(p: T): T => ({ ...p, x: at.x + p.x * k, y: at.y + p.y * k });

  const elements = clip.elements.map((e) =>
    manual({ ...place(e), id: fresh(e.id), scale: (e.scale ?? 1) * k }),
  );
  const texts = clip.texts.map((t) => manual({ ...place(t), id: fresh(t.id), h: t.h * k }));
  const end = (e: Wire['from']): Wire['from'] =>
    isPortEnd(e) ? { ...e, elementId: map.get(e.elementId) ?? e.elementId } : place(e);
  const wires = clip.wires.map((w) =>
    manual({ ...w, id: fresh(w.id), from: end(w.from), to: end(w.to), points: w.points.map(place) }),
  );

  const nextElements = [...d.elements, ...elements];
  return {
    diagram: touched({
      ...d,
      elements: nextElements,
      texts: [...d.texts, ...texts],
      wires: [...d.wires, ...wires.map((w) => rerouteWire(w, nextElements))],
    }),
    ids: [...elements.map((e) => e.id), ...wires.map((w) => w.id), ...texts.map((t) => t.id)],
  };
}

/** クリップボードの中身を貼り付ける（at は貼り付け範囲の左上） */
export function pasteItems(d: Diagram, clip: Clipboard, at: { x: number; y: number }): { diagram: Diagram; ids: string[] } {
  return insertCopy(d, clip, at, (d.scale ?? 1) / (clip.scale || 1));
}

/** 選択項目をその場で複製して少しずらす */
export function duplicateItems(
  d: Diagram,
  ids: ReadonlySet<string>,
  dx: number,
  dy: number,
): { diagram: Diagram; ids: string[] } {
  const clip = copyItems(d, ids);
  if (!clip) return { diagram: d, ids: [] };
  // copyItems が左上を原点にそろえているので、元の左上 + ずらし量が貼り付け位置
  return insertCopy(d, clip, { x: clip.origin.x + dx, y: clip.origin.y + dy }, 1);
}
