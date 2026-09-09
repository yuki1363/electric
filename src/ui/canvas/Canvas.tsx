import { useCallback, useEffect, useRef, useState } from 'react';
import type { Point, SymbolKind } from '../../symbols/types';
import type { Diagram, Element } from '../../model/types';
import type { TitleInfo } from '../../layout/sheet';
import { GRID, PAPER } from '../../layout/constants';
import { isPortEnd } from '../../model/types';
import { flattenDiagram, elementLabelLines } from '../../render/flatten';
import { diagramSvgInner } from '../../render/diagramSvg';
import { COLOR_GRID, COLOR_PORT, COLOR_SELECTED } from '../../render/style';
import { elementPorts } from '../../layout/builder';
import { snapValue } from '../../geom/point';
import { newId } from '../../model/ids';
import { useDispatch } from '../../state/context';
import { elementBBox, itemsInRect, labelLineBBox, nearestWireAt, textBBox } from './hit';
import { copyItems, nearestSegment, type Clipboard } from '../../state/diagramOps';
import { getSymbol } from '../../symbols';
import type { Tool } from './types';

export interface CanvasProps {
  diagram: Diagram;
  title?: TitleInfo;
  selection: string[];
  onSelectionChange: (ids: string[]) => void;
  tool: Tool;
  onToolChange: (t: Tool) => void;
  /** 配置待ちの図記号（tool === 'place' のとき使う） */
  pending?: SymbolKind | null;
  onPendingChange?: (k: SymbolKind | null) => void;
  onViewChange?: (center: Point) => void;
  showGrid?: boolean;
  /** 移動の刻み mm。0 でスナップなし（Alt を押している間も 0 になる） */
  snapStep?: number;
  onSnapStepChange?: (v: number) => void;
  onShowGridChange?: (v: boolean) => void;
  clipboard?: Clipboard | null;
  onClipboardChange?: (c: Clipboard | null) => void;
  readOnly?: boolean;
}

interface View {
  zoom: number;
  pan: { x: number; y: number };
}

type DragState =
  | { kind: 'pan'; sx: number; sy: number; pan: { x: number; y: number } }
  | { kind: 'move'; ids: string[]; start: Point; moved: boolean }
  | { kind: 'label'; id: string; start: Point; base: Point; moved: boolean }
  | { kind: 'wireSeg'; id: string; index: number; dir: 'v' | 'h'; start: Point; base: Point[]; moved: boolean }
  | { kind: 'marquee'; start: Point; cur: Point; additive: boolean };

interface PortPick {
  elementId: string;
  portId: string;
  p: Point;
}

/** ドラッグ中に相手の中心線へ吸い付く距離 mm */
const SNAP_TOL = 3;

/** 刻みに丸める。0 以下ならそのまま（Alt 押下中・スナップ無しのとき） */
const snapTo = (v: number, step: number): number => (step > 0 ? snapValue(v, step) : v);

/** 図面編集キャンバス */
export function Canvas({
  diagram,
  title,
  selection,
  onSelectionChange,
  tool,
  onToolChange,
  pending = null,
  onPendingChange,
  onViewChange,
  showGrid = true,
  snapStep = 1,
  onSnapStepChange,
  onShowGridChange,
  clipboard = null,
  onClipboardChange,
  readOnly = false,
}: CanvasProps) {
  const dispatch = useDispatch();
  const paper = PAPER[diagram.sheet.size];
  const hostRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>({ zoom: 2, pan: { x: 0, y: 0 } });
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const [spaceDown, setSpaceDown] = useState(false);
  const [wireFrom, setWireFrom] = useState<PortPick | null>(null);
  const [hoverPos, setHoverPos] = useState<Point | null>(null);
  /** 直近のカーソル位置（貼り付け位置に使う） */
  const hoverRef = useRef<Point | null>(null);
  const selSet = new Set(selection);

  const setDragBoth = (d: DragState | null) => {
    dragRef.current = d;
    setDrag(d);
  };

  const fit = useCallback(() => {
    const host = hostRef.current;
    if (!host) return;
    const w = host.clientWidth;
    const h = host.clientHeight;
    const zoom = Math.min(w / (paper.w + 20), h / (paper.h + 20));
    setSize({ w, h });
    setView({ zoom, pan: { x: -(w / zoom - paper.w) / 2, y: -(h / zoom - paper.h) / 2 } });
  }, [paper.w, paper.h]);

  useEffect(() => {
    fit();
    const ro = new ResizeObserver(() => {
      const host = hostRef.current;
      if (host) setSize({ w: host.clientWidth, h: host.clientHeight });
    });
    if (hostRef.current) ro.observe(hostRef.current);
    return () => ro.disconnect();
  }, [fit]);

  useEffect(() => {
    onViewChange?.({ x: view.pan.x + size.w / view.zoom / 2, y: view.pan.y + size.h / view.zoom / 2 });
  }, [view, size, onViewChange]);

  // キー操作
  useEffect(() => {
    const isTyping = (t: EventTarget | null) =>
      t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement;
    const down = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      if (e.code === 'Space') {
        setSpaceDown(true);
        e.preventDefault();
        return;
      }
      if (readOnly) return;
      if (e.key === 'Escape') {
        setWireFrom(null);
        onPendingChange?.(null);
        if (tool !== 'select') onToolChange('select');
        else onSelectionChange([]);
        return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selection.length > 0) {
        e.preventDefault();
        dispatch({ type: 'DELETE_ITEMS', diagramId: diagram.id, ids: selection });
        onSelectionChange([]);
        return;
      }
      if (e.ctrlKey || e.metaKey) {
        const key = e.key.toLowerCase();
        if (key === 'c' && selection.length > 0) {
          e.preventDefault();
          onClipboardChange?.(copyItems(diagram, new Set(selection)));
          return;
        }
        if (key === 'x' && selection.length > 0) {
          e.preventDefault();
          onClipboardChange?.(copyItems(diagram, new Set(selection)));
          dispatch({ type: 'DELETE_ITEMS', diagramId: diagram.id, ids: selection });
          onSelectionChange([]);
          return;
        }
        if (key === 'v' && clipboard) {
          e.preventDefault();
          const at = hoverRef.current ?? { x: 30, y: 30 };
          dispatch({ type: 'PASTE_ITEMS', diagramId: diagram.id, clip: clipboard, at });
          return;
        }
        if (key === 'd' && selection.length > 0) {
          e.preventDefault();
          const d = Math.max(snapStep, 2) * 3;
          dispatch({ type: 'DUPLICATE_ITEMS', diagramId: diagram.id, ids: selection, dx: d, dy: d });
          return;
        }
        return;
      }
      // 矢印キーの微動。Shift で 5 倍
      const step = (snapStep > 0 ? snapStep : 1) * (e.shiftKey ? 5 : 1);
      const nudge: Record<string, [number, number]> = {
        ArrowLeft: [-step, 0],
        ArrowRight: [step, 0],
        ArrowUp: [0, -step],
        ArrowDown: [0, step],
      };
      const n = nudge[e.key];
      if (n && selection.length > 0) {
        e.preventDefault();
        dispatch({ type: 'MOVE_PREVIEW', diagramId: diagram.id, ids: selection, dx: n[0], dy: n[1] });
        dispatch({ type: 'COMMIT_PREVIEW' });
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpaceDown(false);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [selection, diagram, dispatch, onSelectionChange, tool, onToolChange, readOnly, snapStep, clipboard, onClipboardChange]);

  const toWorld = (e: { clientX: number; clientY: number }): Point => {
    const host = hostRef.current!;
    const rect = host.getBoundingClientRect();
    return { x: (e.clientX - rect.left) / view.zoom + view.pan.x, y: (e.clientY - rect.top) / view.zoom + view.pan.y };
  };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const host = hostRef.current;
    if (!host) return;
    const rect = host.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const factor = Math.exp(-e.deltaY * 0.0015);
    setView((v) => {
      const zoom = Math.min(40, Math.max(0.2, v.zoom * factor));
      const wx = mx / v.zoom + v.pan.x;
      const wy = my / v.zoom + v.pan.y;
      return { zoom, pan: { x: wx - mx / zoom, y: wy - my / zoom } };
    });
  };

  const hitAt = (target: EventTarget | null): { id: string; kind: 'item' | 'label' | 'port'; portId?: string } | null => {
    let el = target as HTMLElement | null;
    while (el && el !== hostRef.current) {
      const ds = (el as HTMLElement).dataset;
      if (ds && ds.hit) {
        return { id: ds.hit, kind: ds.kind as 'item' | 'label' | 'port', ...(ds.port ? { portId: ds.port } : {}) };
      }
      el = el.parentElement;
    }
    return null;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    const host = e.currentTarget as HTMLElement;
    if (e.button === 1 || (e.button === 0 && spaceDown)) {
      setDragBoth({ kind: 'pan', sx: e.clientX, sy: e.clientY, pan: view.pan });
      host.setPointerCapture(e.pointerId);
      e.preventDefault();
      return;
    }
    if (e.button !== 0 || readOnly) return;
    const w = toWorld(e);
    const hit = hitAt(e.target);

    if (tool === 'wire') {
      if (hit?.kind === 'port' && hit.portId) {
        const el = diagram.elements.find((x) => x.id === hit.id);
        if (!el) return;
        const port = elementPorts(el).find((p) => p.id === hit.portId)!;
        if (!wireFrom) {
          setWireFrom({ elementId: el.id, portId: port.id, p: port.p });
        } else if (!(wireFrom.elementId === el.id && wireFrom.portId === port.id)) {
          const id = newId('w');
          dispatch({
            type: 'ADD_WIRE',
            diagramId: diagram.id,
            wire: {
              id,
              from: { elementId: wireFrom.elementId, portId: wireFrom.portId },
              to: { elementId: el.id, portId: port.id },
              points: [],
              manual: false,
              style: 'normal',
            },
          });
          setWireFrom(null);
          onSelectionChange([id]);
        }
      }
      return;
    }

    if (tool === 'place') {
      if (!pending) return;
      const def = getSymbol(pending);
      const step = e.altKey ? 0 : snapStep;
      const at = { x: snapTo(w.x, step), y: snapTo(w.y, step) };
      const el = { id: newId('e'), kind: pending, x: at.x, y: at.y, rot: 0 as const, labels: [...(def.defaultLabels ?? [])] };
      // 配線の上に置いたら、その線を 2 本に分けて途中に入れる
      const wireId = nearestWireAt(diagram, w, 2.5);
      dispatch(
        wireId
          ? { type: 'INSERT_INTO_WIRE', diagramId: diagram.id, wireId, element: el }
          : { type: 'ADD_ELEMENT', diagramId: diagram.id, element: el },
      );
      onSelectionChange([el.id]);
      onPendingChange?.(null);
      onToolChange('select');
      return;
    }

    if (tool === 'text') {
      const id = newId('t');
      dispatch({
        type: 'ADD_TEXT',
        diagramId: diagram.id,
        text: { id, x: snapTo(w.x, e.altKey ? 0 : snapStep), y: snapTo(w.y, e.altKey ? 0 : snapStep), text: 'テキスト', h: 3.5, anchor: 'start' },
      });
      onSelectionChange([id]);
      onToolChange('select');
      return;
    }

    // 選択ツール
    if (hit?.kind === 'label') {
      const el = diagram.elements.find((x) => x.id === hit.id);
      if (!el) return;
      if (!selSet.has(el.id)) onSelectionChange([el.id]);
      setDragBoth({ kind: 'label', id: el.id, start: w, base: el.labelOffset ?? { x: 0, y: 0 }, moved: false });
      host.setPointerCapture(e.pointerId);
      return;
    }
    // 配線を掴んだら、その線分を直角方向に動かす（曲がりの位置を手で調整する）
    const wire = hit && hit.kind === 'item' ? diagram.wires.find((x) => x.id === hit.id) : undefined;
    if (wire && !e.shiftKey && selection.length <= 1) {
      const seg = nearestSegment(wire, w);
      if (seg) {
        onSelectionChange([wire.id]);
        setDragBoth({ kind: 'wireSeg', id: wire.id, index: seg.index, dir: seg.dir, start: w, base: wire.points, moved: false });
        host.setPointerCapture(e.pointerId);
        return;
      }
    }
    if (hit && (hit.kind === 'item' || hit.kind === 'port')) {
      let ids: string[];
      if (e.shiftKey) {
        ids = selSet.has(hit.id) ? selection.filter((x) => x !== hit.id) : [...selection, hit.id];
        onSelectionChange(ids);
        return;
      }
      ids = selSet.has(hit.id) ? selection : [hit.id];
      if (ids !== selection) onSelectionChange(ids);
      setDragBoth({ kind: 'move', ids, start: w, moved: false });
      host.setPointerCapture(e.pointerId);
      return;
    }
    // 空白: 矩形選択
    setDragBoth({ kind: 'marquee', start: w, cur: w, additive: e.shiftKey });
    host.setPointerCapture(e.pointerId);
  };

  /**
   * ドラッグ中の吸着。1 個だけ動かしているとき、配線でつながっている相手と
   * x（または y）が近ければその値に合わせる。routeWire は同一 x/y なら直線を引くので、
   * これだけで線の折れ曲がりが消える。
   */
  const snapToPeers = (ids: string[], dx: number, dy: number): { dx: number; dy: number } => {
    if (ids.length !== 1) return { dx, dy };
    const el = diagram.elements.find((e) => e.id === ids[0]);
    if (!el) return { dx, dy };
    const peers = new Set<string>();
    for (const w of diagram.wires) {
      const f = isPortEnd(w.from) ? w.from.elementId : null;
      const t = isPortEnd(w.to) ? w.to.elementId : null;
      if (f === el.id && t) peers.add(t);
      if (t === el.id && f) peers.add(f);
    }
    const xs: number[] = [];
    const ys: number[] = [];
    for (const e of diagram.elements) {
      if (!peers.has(e.id)) continue;
      xs.push(e.x);
      ys.push(e.y);
    }
    const pull = (v: number, cands: number[]) => {
      let best: number | null = null;
      for (const c of cands) if (Math.abs(c - v) <= SNAP_TOL && (best === null || Math.abs(c - v) < Math.abs(best - v))) best = c;
      return best;
    };
    const nx = pull(el.x + dx, xs);
    const ny = pull(el.y + dy, ys);
    return { dx: nx === null ? dx : nx - el.x, dy: ny === null ? dy : ny - el.y };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    const step = e.altKey ? 0 : snapStep;
    hoverRef.current = toWorld(e);
    if (tool === 'wire') setHoverPos(hoverRef.current);
    if (!d) return;
    if (d.kind === 'pan') {
      setView((v) => ({ ...v, pan: { x: d.pan.x - (e.clientX - d.sx) / v.zoom, y: d.pan.y - (e.clientY - d.sy) / v.zoom } }));
      return;
    }
    const w = toWorld(e);
    if (d.kind === 'wireSeg') {
      const raw = d.dir === 'v' ? w.x - d.start.x : w.y - d.start.y;
      const delta = snapTo(raw, step);
      if (delta !== 0 || d.moved) {
        dispatch({
          type: 'WIRE_SEGMENT_PREVIEW',
          diagramId: diagram.id,
          wireId: d.id,
          index: d.index,
          delta,
          base: d.base,
        });
        if (!d.moved) setDragBoth({ ...d, moved: true });
      }
      return;
    }
    if (d.kind === 'move') {
      const { dx, dy } = snapToPeers(d.ids, snapTo(w.x - d.start.x, step), snapTo(w.y - d.start.y, step));
      if (dx !== 0 || dy !== 0 || d.moved) {
        dispatch({ type: 'MOVE_PREVIEW', diagramId: diagram.id, ids: d.ids, dx, dy });
        if (!d.moved) setDragBoth({ ...d, moved: true });
      }
      return;
    }
    if (d.kind === 'label') {
      const dx = snapValue(w.x - d.start.x, 1);
      const dy = snapValue(w.y - d.start.y, 1);
      dispatch({ type: 'MOVE_LABEL_PREVIEW', diagramId: diagram.id, id: d.id, offset: { x: d.base.x + dx, y: d.base.y + dy } });
      if (!d.moved) setDragBoth({ ...d, moved: true });
      return;
    }
    if (d.kind === 'marquee') {
      setDragBoth({ ...d, cur: w });
    }
  };

  const onPointerUp = () => {
    const d = dragRef.current;
    if (!d) return;
    if (d.kind === 'move' || d.kind === 'label' || d.kind === 'wireSeg') {
      if (d.moved) dispatch({ type: 'COMMIT_PREVIEW' });
    } else if (d.kind === 'marquee') {
      const r = {
        minX: Math.min(d.start.x, d.cur.x),
        minY: Math.min(d.start.y, d.cur.y),
        maxX: Math.max(d.start.x, d.cur.x),
        maxY: Math.max(d.start.y, d.cur.y),
      };
      const tiny = r.maxX - r.minX < 1 && r.maxY - r.minY < 1;
      const ids = tiny ? [] : itemsInRect(diagram, r);
      onSelectionChange(d.additive ? Array.from(new Set([...selection, ...ids])) : ids);
    }
    setDragBoth(null);
  };

  const inner = diagramSvgInner(flattenDiagram(diagram, title ? { frame: title } : {}));
  /** 細線の格子は刻みに合わせる。画面上で細かすぎるときは出さない */
  const minorGrid = snapStep > 0 ? snapStep : GRID;
  const showMinorGrid = minorGrid < GRID * 2 && minorGrid * view.zoom >= 3;
  const vb = `${view.pan.x} ${view.pan.y} ${size.w / view.zoom} ${size.h / view.zoom}`;
  const px = (n: number) => n / view.zoom; // 画面ピクセル → 用紙 mm

  const showPorts = tool === 'wire';
  /** 端子は常に薄く見せる。当たり判定は配線ツール中と選択中だけ */
  const portElements = readOnly ? [] : diagram.elements;
  const selectedElements: Element[] = diagram.elements.filter((e) => selSet.has(e.id));

  return (
    <div
      className={`canvas-host${spaceDown ? ' panning' : ''} tool-${tool}`}
      ref={hostRef}
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <svg width={size.w} height={size.h} viewBox={vb} className="canvas-svg">
        <defs>
          <pattern id="grid" width={minorGrid} height={minorGrid} patternUnits="userSpaceOnUse">
            <path d={`M ${minorGrid} 0 L 0 0 0 ${minorGrid}`} fill="none" stroke={COLOR_GRID} strokeWidth="0.1" />
          </pattern>
          <pattern id="grid-major" width={GRID * 2} height={GRID * 2} patternUnits="userSpaceOnUse">
            <path d={`M ${GRID * 2} 0 L 0 0 0 ${GRID * 2}`} fill="none" stroke={COLOR_GRID} strokeWidth="0.25" />
          </pattern>
        </defs>
        <rect x={0} y={0} width={paper.w} height={paper.h} fill="#fff" stroke="#999" strokeWidth={0.3} />
        {showGrid && showMinorGrid && <rect x={0} y={0} width={paper.w} height={paper.h} fill="url(#grid)" />}
        {showGrid && <rect x={0} y={0} width={paper.w} height={paper.h} fill="url(#grid-major)" />}
        <g color="#000" dangerouslySetInnerHTML={{ __html: inner }} />

        {/* ヒット領域 */}
        {!readOnly && (
          <g className="hits">
            {diagram.wires.map((w) => (
              <polyline
                key={w.id}
                data-hit={w.id}
                data-kind="item"
                points={w.points.map((p) => `${p.x},${p.y}`).join(' ')}
                fill="none"
                stroke={selSet.has(w.id) ? COLOR_SELECTED : 'transparent'}
                strokeOpacity={selSet.has(w.id) ? 0.5 : 1}
                strokeWidth={px(8)}
                className="hit-wire"
              />
            ))}
            {diagram.elements.map((e) => {
              const b = elementBBox(e);
              return (
                <g key={e.id}>
                  <rect
                    data-hit={e.id}
                    data-kind="item"
                    data-symbol={e.kind}
                    x={b.minX}
                    y={b.minY}
                    width={b.maxX - b.minX}
                    height={b.maxY - b.minY}
                    fill="transparent"
                    className="hit-el"
                  />
                  {elementLabelLines(e).map((l, i) => {
                    const lb = labelLineBBox(l);
                    return (
                      <rect
                        key={i}
                        data-hit={e.id}
                        data-kind="label"
                        x={lb.minX}
                        y={lb.minY}
                        width={lb.maxX - lb.minX}
                        height={lb.maxY - lb.minY}
                        fill="transparent"
                        className="hit-label"
                      />
                    );
                  })}
                </g>
              );
            })}
            {diagram.texts.map((t) => {
              const b = textBBox(t);
              return (
                <rect
                  key={t.id}
                  data-hit={t.id}
                  data-kind="item"
                  x={b.minX}
                  y={b.minY}
                  width={b.maxX - b.minX}
                  height={b.maxY - b.minY}
                  fill="transparent"
                  className="hit-text"
                />
              );
            })}
          </g>
        )}

        {/* 選択表示 */}
        <g className="selection" pointerEvents="none">
          {selectedElements.map((e) => {
            const b = elementBBox(e);
            return (
              <rect
                key={e.id}
                x={b.minX - 1}
                y={b.minY - 1}
                width={b.maxX - b.minX + 2}
                height={b.maxY - b.minY + 2}
                fill="none"
                stroke={COLOR_SELECTED}
                strokeWidth={px(1.5)}
                strokeDasharray={`${px(4)} ${px(3)}`}
              />
            );
          })}
          {diagram.texts
            .filter((t) => selSet.has(t.id))
            .map((t) => {
              const b = textBBox(t);
              return (
                <rect
                  key={t.id}
                  x={b.minX - 0.5}
                  y={b.minY - 0.5}
                  width={b.maxX - b.minX + 1}
                  height={b.maxY - b.minY + 1}
                  fill="none"
                  stroke={COLOR_SELECTED}
                  strokeWidth={px(1.5)}
                  strokeDasharray={`${px(4)} ${px(3)}`}
                />
              );
            })}
        </g>

        {/* ポート */}
        {portElements.length > 0 && (
          <g className="ports">
            {portElements.map((e) =>
              elementPorts(e).map((p) => {
                const strong = showPorts || selSet.has(e.id);
                const s = px(strong ? 6 : 3.5);
                const active = wireFrom && wireFrom.elementId === e.id && wireFrom.portId === p.id;
                return (
                  <rect
                    key={`${e.id}:${p.id}`}
                    data-hit={e.id}
                    data-kind="port"
                    data-port={p.id}
                    x={p.p.x - s / 2}
                    y={p.p.y - s / 2}
                    width={s}
                    height={s}
                    fill={active ? COLOR_SELECTED : COLOR_PORT}
                    stroke="#fff"
                    strokeWidth={px(strong ? 1 : 0.5)}
                    opacity={strong ? 1 : 0.45}
                    className="port"
                    pointerEvents={strong ? 'all' : 'none'}
                  />
                );
              }),
            )}
          </g>
        )}

        {/* 配線ツールのラバーバンド */}
        {wireFrom && hoverPos && (
          <line
            x1={wireFrom.p.x}
            y1={wireFrom.p.y}
            x2={hoverPos.x}
            y2={hoverPos.y}
            stroke={COLOR_SELECTED}
            strokeWidth={px(1)}
            strokeDasharray={`${px(4)} ${px(2)}`}
            pointerEvents="none"
          />
        )}

        {/* 矩形選択 */}
        {drag?.kind === 'marquee' && (
          <rect
            x={Math.min(drag.start.x, drag.cur.x)}
            y={Math.min(drag.start.y, drag.cur.y)}
            width={Math.abs(drag.cur.x - drag.start.x)}
            height={Math.abs(drag.cur.y - drag.start.y)}
            fill={COLOR_SELECTED}
            fillOpacity={0.1}
            stroke={COLOR_SELECTED}
            strokeWidth={px(1)}
            pointerEvents="none"
          />
        )}
      </svg>
      <div className="canvas-toolbar">
        {tool !== 'select' && (
          <span className="tool-hint">
            {tool === 'wire' ? (wireFrom ? '接続先のポートをクリック' : '始点のポートをクリック') : 'クリック位置にテキストを追加'}（Esc で解除）
          </span>
        )}
        <label title="移動の刻み。Alt を押している間はスナップしません">
          スナップ
          <select value={snapStep} onChange={(e) => onSnapStepChange?.(Number(e.target.value))}>
            {[0.5, 1, 2.5, 5].map((v) => (
              <option key={v} value={v}>
                {v}mm
              </option>
            ))}
            <option value={0}>なし</option>
          </select>
        </label>
        <label title="格子の表示">
          <input type="checkbox" checked={showGrid} onChange={(e) => onShowGridChange?.(e.target.checked)} /> 格子
        </label>
        <button onClick={fit}>全体表示</button>
        <span>{Math.round(view.zoom * 100) / 100}x</span>
      </div>
    </div>
  );
}
