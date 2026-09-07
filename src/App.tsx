import { useMemo, useState } from 'react';
import { SymbolGallery } from './ui/SymbolGallery';
import { Canvas } from './ui/canvas/Canvas';
import { sampleProject } from './model/defaults';
import { regenerateAll } from './layout';
import { titleInfoFromMeta } from './layout/sheet';

export function App() {
  if (new URLSearchParams(location.search).has('gallery')) {
    return <SymbolGallery />;
  }
  return <Preview />;
}

function Preview() {
  const { project, diagrams, warnings } = useMemo(() => {
    const project = sampleProject();
    const r = regenerateAll(project);
    return { project, diagrams: r.diagrams, warnings: r.warnings };
  }, []);
  const initial = new URLSearchParams(location.search).get('d') ?? '';
  const [activeId, setActiveId] = useState(initial || diagrams[0]?.id || '');
  const d = diagrams.find((x) => x.id === activeId) ?? diagrams[0];
  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>電気図面作成</h1>
        <select value={d?.id ?? ''} onChange={(e) => setActiveId(e.target.value)}>
          {diagrams.map((x) => (
            <option key={x.id} value={x.id}>
              {x.title}
              {x.pageCount ? ` (${x.page}/${x.pageCount})` : ''}
            </option>
          ))}
        </select>
        {warnings.length > 0 && <div className="warnings">{warnings.join(' / ')}</div>}
      </header>
      <main className="app-main">
        {d ? (
          <Canvas key={d.id} diagram={d} title={titleInfoFromMeta(project.meta, d.title, d.page, d.pageCount)} />
        ) : (
          <p>図面がありません</p>
        )}
      </main>
    </div>
  );
}
