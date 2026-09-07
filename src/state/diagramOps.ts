import type { Point } from '../symbols/types';
import type { Diagram, Element, TextItem, Wire } from '../model/types';
import { isPortEnd } from '../model/types';
import { rerouteWire } from '../layout/builder';

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
