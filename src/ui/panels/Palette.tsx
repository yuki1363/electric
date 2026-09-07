import type { Point } from '../../symbols/types';
import type { SymbolDef } from '../../symbols/types';
import { symbolsByCategory } from '../../symbols';
import { primsToSvg, svgGroup } from '../../render/svg';
import { GRID } from '../../layout/constants';
import { snapValue } from '../../geom/point';
import { newId } from '../../model/ids';
import { useDispatch } from '../../state/context';
import { TOOL_LABEL, type Tool } from '../canvas/types';

function SymbolIcon({ s }: { s: SymbolDef }) {
  const pad = 2;
  const w = s.bbox.w + pad * 2;
  const h = s.bbox.h + pad * 2;
  const scale = Math.min(28 / w, 28 / h);
  return (
    <svg
      viewBox={`${-w / 2} ${-h / 2} ${w} ${h}`}
      width={w * scale}
      height={h * scale}
      dangerouslySetInnerHTML={{ __html: svgGroup(primsToSvg(s.prims)) }}
    />
  );
}

export function Palette({
  diagramId,
  getViewCenter,
  onAdded,
  tool,
  onToolChange,
}: {
  diagramId: string;
  getViewCenter: () => Point;
  onAdded: (id: string) => void;
  tool: Tool;
  onToolChange: (t: Tool) => void;
}) {
  const dispatch = useDispatch();
  const add = (s: SymbolDef) => {
    const c = getViewCenter();
    const id = newId('e');
    dispatch({
      type: 'ADD_ELEMENT',
      diagramId,
      element: {
        id,
        kind: s.kind,
        x: snapValue(c.x, GRID),
        y: snapValue(c.y, GRID),
        rot: 0,
        labels: [...(s.defaultLabels ?? [])],
      },
    });
    onAdded(id);
    onToolChange('select');
  };
  return (
    <div className="palette">
      <div className="palette-tools">
        {(['select', 'wire', 'text'] as Tool[]).map((t) => (
          <button key={t} className={tool === t ? 'active' : ''} onClick={() => onToolChange(t)}>
            {TOOL_LABEL[t]}
          </button>
        ))}
      </div>
      {symbolsByCategory().map((cat) => (
        <details key={cat.category} open={cat.category !== 'face'}>
          <summary>{cat.name}</summary>
          <div className="palette-grid">
            {cat.symbols.map((s) => (
              <button key={s.kind} className="palette-item" title={s.nameJa} onClick={() => add(s)}>
                <SymbolIcon s={s} />
                <span>{s.kind}</span>
              </button>
            ))}
          </div>
        </details>
      ))}
    </div>
  );
}
