import type { Point, Prim, SymbolKind, TextAnchor } from '../symbols/types';
import type { Rot } from '../symbols/transform';
import type { Diagram, DiagramKind, Element, SheetSpec, TextItem, Wire, WireEnd } from '../model/types';
import { isPortEnd } from '../model/types';
import { getSymbol } from '../symbols';
import { portToWorld } from '../symbols/transform';
import { seqId } from '../model/ids';
import { routeWire, stretchEnd, type RouteEnd } from './router';

export interface ElOpts {
  rot?: Rot;
  labels?: string[];
  labelOffset?: Point;
  props?: Record<string, string | number | boolean>;
  id?: string;
}

/** 要素のポートをワールド座標で返す */
export function elementPort(el: Element, portId: string): RouteEnd {
  const def = getSymbol(el.kind);
  const port = def.ports.find((p) => p.id === portId);
  if (!port) throw new Error(`${el.kind} にポート ${portId} はありません`);
  const w = portToWorld(port, { x: el.x, y: el.y, rot: el.rot, scale: el.scale ?? 1 });
  return { p: { x: w.x, y: w.y }, dir: w.dir };
}

export function elementPorts(el: Element): { id: string; p: Point; dir: RouteEnd['dir'] }[] {
  const def = getSymbol(el.kind);
  return def.ports.map((port) => {
    const w = portToWorld(port, { x: el.x, y: el.y, rot: el.rot, scale: el.scale ?? 1 });
    return { id: port.id, p: { x: w.x, y: w.y }, dir: w.dir };
  });
}

export function resolveEnd(end: WireEnd, elements: Element[]): RouteEnd {
  if (isPortEnd(end)) {
    const el = elements.find((e) => e.id === end.elementId);
    if (!el) throw new Error(`配線の参照先要素がありません: ${end.elementId}`);
    return elementPort(el, end.portId);
  }
  return { p: { x: end.x, y: end.y } };
}

/** 配線の points を端点から再計算する（manual のときは端点のみ追従） */
export function rerouteWire(wire: Wire, elements: Element[]): Wire {
  const a = resolveEnd(wire.from, elements);
  const b = resolveEnd(wire.to, elements);
  if (wire.manual && wire.points.length >= 2) {
    let pts = stretchEnd(wire.points, 'from', a.p);
    pts = stretchEnd(pts, 'to', b.p);
    return { ...wire, points: pts };
  }
  return { ...wire, points: routeWire(a, b) };
}

export class DiagramBuilder {
  private n = 0;
  readonly elements: Element[] = [];
  readonly wires: Wire[] = [];
  readonly texts: TextItem[] = [];
  readonly shapes: Prim[] = [];
  readonly warnings: string[] = [];

  constructor(
    readonly id: string,
    readonly kind: DiagramKind,
    readonly title: string,
    readonly sheet: SheetSpec,
    readonly sourceId?: string,
  ) {}

  private nextId(prefix: string): string {
    this.n += 1;
    return seqId(this.id, this.n, prefix);
  }

  el(kind: SymbolKind, x: number, y: number, o: ElOpts = {}): Element {
    const def = getSymbol(kind);
    const el: Element = {
      id: o.id ?? this.nextId('e'),
      kind,
      x,
      y,
      rot: o.rot ?? 0,
      labels: o.labels ?? [...(def.defaultLabels ?? [])],
      ...(o.labelOffset ? { labelOffset: o.labelOffset } : {}),
      ...(o.props ? { props: o.props } : {}),
    };
    this.elements.push(el);
    return el;
  }

  port(el: Element, portId: string): RouteEnd {
    return elementPort(el, portId);
  }

  /** 2 要素のポート間を自動配線 */
  wire(a: Element, aPort: string, b: Element, bPort: string, style: Wire['style'] = 'normal'): Wire {
    const w: Wire = {
      id: this.nextId('w'),
      from: { elementId: a.id, portId: aPort },
      to: { elementId: b.id, portId: bPort },
      points: routeWire(this.port(a, aPort), this.port(b, bPort)),
      manual: false,
      style,
    };
    this.wires.push(w);
    return w;
  }

  /** 要素ポート → 固定点 */
  wireToPoint(a: Element, aPort: string, p: Point, style: Wire['style'] = 'normal'): Wire {
    const w: Wire = {
      id: this.nextId('w'),
      from: { elementId: a.id, portId: aPort },
      to: { x: p.x, y: p.y },
      points: routeWire(this.port(a, aPort), { p }),
      manual: false,
      style,
    };
    this.wires.push(w);
    return w;
  }

  /** 固定点 → 要素ポート */
  wireFromPoint(p: Point, b: Element, bPort: string, style: Wire['style'] = 'normal'): Wire {
    const w: Wire = {
      id: this.nextId('w'),
      from: { x: p.x, y: p.y },
      to: { elementId: b.id, portId: bPort },
      points: routeWire({ p }, this.port(b, bPort)),
      manual: false,
      style,
    };
    this.wires.push(w);
    return w;
  }

  /** 固定点 → 固定点（母線など、直線） */
  wirePoints(p1: Point, p2: Point, style: Wire['style'] = 'normal'): Wire {
    const w: Wire = {
      id: this.nextId('w'),
      from: { x: p1.x, y: p1.y },
      to: { x: p2.x, y: p2.y },
      points: [{ ...p1 }, { ...p2 }],
      manual: true,
      style,
    };
    this.wires.push(w);
    return w;
  }

  text(x: number, y: number, text: string, h: number, anchor: TextAnchor = 'start', rot?: number): TextItem {
    const t: TextItem = { id: this.nextId('t'), x, y, text, h, anchor, ...(rot ? { rot } : {}) };
    this.texts.push(t);
    return t;
  }

  /** 複数行テキスト（上から順に LINE_GAP 行送り） */
  textLines(x: number, y: number, lines: string[], h: number, anchor: TextAnchor = 'start', gap = 1.4): void {
    lines.forEach((line, i) => {
      if (line) this.text(x, y + i * h * gap, line, h, anchor);
    });
  }

  shape(...prims: Prim[]): void {
    this.shapes.push(...prims);
  }

  warn(msg: string): void {
    this.warnings.push(msg);
  }

  build(extra: Partial<Pick<Diagram, 'page' | 'pageCount'>> = {}): Diagram {
    return {
      id: this.id,
      kind: this.kind,
      title: this.title,
      sheet: this.sheet,
      ...(this.sourceId ? { sourceId: this.sourceId } : {}),
      ...extra,
      elements: this.elements,
      wires: this.wires,
      texts: this.texts,
      shapes: this.shapes,
      edited: false,
    };
  }
}
