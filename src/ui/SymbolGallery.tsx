import { ALL_SYMBOLS } from '../symbols';
import { primsToSvg, svgGroup } from '../render/svg';
import { COLOR_PORT } from '../render/style';

/** 開発用: 全図記号とポートの一覧（?gallery で表示） */
export function SymbolGallery() {
  return (
    <div className="gallery">
      <h2>図記号一覧（{ALL_SYMBOLS.length}種）</h2>
      <div className="gallery-grid">
        {ALL_SYMBOLS.map((s) => {
          const pad = 6;
          const w = s.bbox.w + pad * 2;
          const h = s.bbox.h + pad * 2;
          const ports = s.ports
            .map(
              (p) =>
                `<rect x="${p.x - 0.8}" y="${p.y - 0.8}" width="1.6" height="1.6" fill="${COLOR_PORT}" stroke="none"/>` +
                `<text x="${p.x + 1.5}" y="${p.y - 1}" font-size="2" fill="${COLOR_PORT}" stroke="none">${p.id}</text>`,
            )
            .join('');
          const inner =
            `<rect x="${-s.bbox.w / 2}" y="${-s.bbox.h / 2}" width="${s.bbox.w}" height="${s.bbox.h}" fill="none" stroke="#bbb" stroke-width="0.1" stroke-dasharray="1 1"/>` +
            svgGroup(primsToSvg(s.prims)) +
            ports;
          return (
            <figure key={s.kind} className="gallery-item">
              <svg
                viewBox={`${-w / 2} ${-h / 2} ${w} ${h}`}
                width={w * 4}
                height={h * 4}
                dangerouslySetInnerHTML={{ __html: inner }}
              />
              <figcaption>
                <code>{s.kind}</code>
                <br />
                {s.nameJa}
              </figcaption>
            </figure>
          );
        })}
      </div>
    </div>
  );
}
