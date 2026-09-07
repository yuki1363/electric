import { useCallback, useEffect, useRef, useState } from 'react';
import type { Diagram } from '../../model/types';
import type { TitleInfo } from '../../layout/sheet';
import { PAPER } from '../../layout/constants';
import { flattenDiagram } from '../../render/flatten';
import { diagramSvgInner } from '../../render/diagramSvg';
import { COLOR_GRID } from '../../render/style';

export interface CanvasProps {
  diagram: Diagram;
  title?: TitleInfo;
  showGrid?: boolean;
}

interface View {
  /** 用紙座標 → 画面座標: screen = (world - pan) * zoom */
  zoom: number;
  pan: { x: number; y: number };
}

/** 図面を表示する SVG キャンバス（ホイールで拡縮、Space/中ボタンでパン） */
export function Canvas({ diagram, title, showGrid = true }: CanvasProps) {
  const paper = PAPER[diagram.sheet.size];
  const hostRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>({ zoom: 2, pan: { x: 0, y: 0 } });
  const [size, setSize] = useState({ w: 800, h: 600 });
  const dragRef = useRef<{ sx: number; sy: number; pan: { x: number; y: number } } | null>(null);
  const [spaceDown, setSpaceDown] = useState(false);

  // 初期表示: 用紙全体を収める
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
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        setSpaceDown(true);
        e.preventDefault();
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
  }, []);

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
      // カーソル位置の用紙座標を固定
      const wx = mx / v.zoom + v.pan.x;
      const wy = my / v.zoom + v.pan.y;
      return { zoom, pan: { x: wx - mx / zoom, y: wy - my / zoom } };
    });
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button === 1 || (e.button === 0 && spaceDown)) {
      dragRef.current = { sx: e.clientX, sy: e.clientY, pan: view.pan };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      e.preventDefault();
    }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    setView((v) => ({ ...v, pan: { x: d.pan.x - (e.clientX - d.sx) / v.zoom, y: d.pan.y - (e.clientY - d.sy) / v.zoom } }));
  };
  const onPointerUp = () => {
    dragRef.current = null;
  };

  const inner = diagramSvgInner(flattenDiagram(diagram, title ? { frame: title } : {}));
  const vb = `${view.pan.x} ${view.pan.y} ${size.w / view.zoom} ${size.h / view.zoom}`;

  return (
    <div
      className={`canvas-host${spaceDown ? ' panning' : ''}`}
      ref={hostRef}
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <svg width={size.w} height={size.h} viewBox={vb} className="canvas-svg">
        <defs>
          <pattern id="grid" width="5" height="5" patternUnits="userSpaceOnUse">
            <path d="M 5 0 L 0 0 0 5" fill="none" stroke={COLOR_GRID} strokeWidth="0.1" />
          </pattern>
        </defs>
        <rect x={0} y={0} width={paper.w} height={paper.h} fill="#fff" stroke="#999" strokeWidth={0.3} />
        {showGrid && <rect x={0} y={0} width={paper.w} height={paper.h} fill="url(#grid)" />}
        <g color="#000" dangerouslySetInnerHTML={{ __html: inner }} />
      </svg>
      <div className="canvas-toolbar">
        <button onClick={fit}>全体表示</button>
        <span>{Math.round(view.zoom * 100) / 100}x</span>
      </div>
    </div>
  );
}
