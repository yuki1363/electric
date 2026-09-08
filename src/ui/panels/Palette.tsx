import type { SymbolDef, SymbolKind } from '../../symbols/types';
import { symbolsByCategory } from '../../symbols';
import { primsToSvg, svgGroup } from '../../render/svg';
import { PICKABLE_TOOLS, TOOL_LABEL, type Tool } from '../canvas/types';

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
  tool,
  onToolChange,
  pending,
  onPendingChange,
}: {
  tool: Tool;
  onToolChange: (t: Tool) => void;
  /** 配置待ちの図記号 */
  pending: SymbolKind | null;
  onPendingChange: (k: SymbolKind | null) => void;
}) {
  /** 部品を押すと配置モードに入り、図面をクリックした位置に置く */
  const pick = (s: SymbolDef) => {
    if (pending === s.kind) {
      onPendingChange(null);
      onToolChange('select');
      return;
    }
    onPendingChange(s.kind);
    onToolChange('place');
  };
  return (
    <div className="palette">
      <div className="palette-tools">
        {PICKABLE_TOOLS.map((t) => (
          <button
            key={t}
            className={tool === t ? 'active' : ''}
            onClick={() => {
              onPendingChange(null);
              onToolChange(t);
            }}
          >
            {TOOL_LABEL[t]}
          </button>
        ))}
      </div>
      {tool === 'place' && pending && (
        <div className="palette-hint">図面をクリックして配置（配線の上に置くと途中に入ります）。Esc で取り消し</div>
      )}
      {symbolsByCategory().map((cat) => (
        <details key={cat.category} open={cat.category !== 'face'}>
          <summary>{cat.name}</summary>
          <div className="palette-grid">
            {cat.symbols.map((s) => (
              <button
                key={s.kind}
                className={`palette-item${pending === s.kind ? ' active' : ''}`}
                title={s.nameJa}
                onClick={() => pick(s)}
              >
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
