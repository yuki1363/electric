import type { Point } from '../symbols/types';
import type { Diagram, Element, TextItem, Wire } from '../model/types';
import { isPortEnd } from '../model/types';
import { rerouteWire } from '../layout/builder';
import { getSymbol } from '../symbols';
import { STUB } from '../layout/constants';
import { seqId } from '../model/ids';

/** 図面内の純粋な編集操作（すべて新しい Diagram を返す） */

function touched(d: Diagram): Diagram {
  return { ...d, edited: true };
}

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
  const placed: Element = dir === 'v' ? { ...el, x: at.x } : { ...el, y: at.y };

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
    rerouteWire(
      { id: seqId(d.id, d.wires.length + n, 'w'), from, to, points: [], manual: false, style: w.style },
      elements,
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
  return touched({ ...d, elements: [...d.elements, el] });
}

export function addWire(d: Diagram, w: Wire): Diagram {
  return touched({ ...d, wires: [...d.wires, rerouteWire(w, d.elements)] });
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
  return touched({ ...d, texts: [...d.texts, t] });
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
export function alignItems(d: Diagram, ids: ReadonlySet<string>, mode: 'left' | 'top' | 'centerX' | 'centerY'): Diagram {
  const els = d.elements.filter((e) => ids.has(e.id));
  if (els.length < 2) return d;
  const xs = els.map((e) => e.x);
  const ys = els.map((e) => e.y);
  const target = mode === 'left' || mode === 'centerX' ? Math.min(...xs) : Math.min(...ys);
  let out = d;
  for (const e of els) {
    const dx = mode === 'left' || mode === 'centerX' ? target - e.x : 0;
    const dy = mode === 'top' || mode === 'centerY' ? target - e.y : 0;
    if (dx || dy) out = moveItems(out, new Set([e.id]), dx, dy);
  }
  return out;
}
