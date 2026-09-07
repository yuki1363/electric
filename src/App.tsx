import { SymbolGallery } from './ui/SymbolGallery';

export function App() {
  if (new URLSearchParams(location.search).has('gallery')) {
    return <SymbolGallery />;
  }
  return (
    <div className="app-shell">
      <h1>電気図面作成</h1>
      <p>高圧受電設備 単線結線図 / 低圧分電盤図</p>
    </div>
  );
}
