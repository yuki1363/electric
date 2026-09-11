import { useState } from 'react';
import type { Project } from '../model/types';
import { titleInfoFromMeta } from '../layout/sheet';
import { diagramToSvg } from '../render/diagramSvg';
import { writeDxf, type DxfCodepage } from '../export/dxf';
import { encodeDxf } from '../export/dxfEncode';
import { openPrint } from '../export/print';
import { downloadBlob, safeFileName } from '../export/download';
import { projectFileName, serialize } from '../model/project';

export function ExportBar({ project }: { project: Project }) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(project.diagrams.map((d) => d.id)));
  const [codepage, setCodepage] = useState<DxfCodepage>('sjis');
  const [withFrame, setWithFrame] = useState(true);
  const [busy, setBusy] = useState(false);

  const targets = project.diagrams.filter((d) => selected.has(d.id));
  const title = (d: Project['diagrams'][number]) =>
    withFrame ? titleInfoFromMeta(project.meta, d.title, d.page, d.pageCount, d.scale) : undefined;

  /**
   * CAD や OS で扱いやすいよう、ファイル名は ASCII のみで組み立てる。
   * 例: E-001_hv-sld.dxf / E-001_lv-schedule_L-1_p2.dxf
   */
  const fileBase = (d: Project['diagrams'][number]) => {
    const panel = d.sourceId ? project.panels.find((p) => p.id === d.sourceId) : undefined;
    const parts = [project.meta.drawingNo || 'DWG', d.kind];
    if (panel) parts.push(panel.name);
    if (d.pageCount && d.pageCount > 1) parts.push(`p${d.page}`);
    return safeFileName(parts.join('_'), true);
  };

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const exportSvg = () => {
    for (const d of targets) downloadBlob(`${fileBase(d)}.svg`, diagramToSvg(d, title(d)), 'image/svg+xml');
  };
  const exportDxf = async () => {
    setBusy(true);
    try {
      for (const d of targets) {
        const text = writeDxf(d, { title: title(d), codepage });
        downloadBlob(`${fileBase(d)}.dxf`, await encodeDxf(text, codepage), 'application/dxf');
      }
    } catch (e) {
      alert(`DXF の出力に失敗しました: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };
  const print = () => {
    openPrint(targets.map((d) => ({ svg: diagramToSvg(d, title(d)), size: d.sheet.size })));
  };
  const exportJson = () => downloadBlob(projectFileName(project), serialize(project), 'application/json');

  return (
    <div className="export">
      <section className="form-section">
        <div className="form-section-head">
          <h3>出力する図面</h3>
          <div className="form-section-actions">
            <button onClick={() => setSelected(new Set(project.diagrams.map((d) => d.id)))}>全選択</button>{' '}
            <button onClick={() => setSelected(new Set())}>全解除</button>
          </div>
        </div>
        {project.diagrams.length === 0 && (
          <p className="muted">
            図面がありません。
            {project.meta.autoGenerate === false
              ? '「図面」タブの「+ 白紙」から描き始めてください。'
              : '「図面を再生成」で作成してください。'}
          </p>
        )}
        <ul className="export-list">
          {project.diagrams.map((d) => (
            <li key={d.id}>
              <label className="check">
                <input type="checkbox" checked={selected.has(d.id)} onChange={() => toggle(d.id)} />{' '}
                {d.title}
                {d.pageCount ? ` (${d.page}/${d.pageCount})` : ''}
                <span className="muted"> {d.sheet.size} 横{d.stale ? ' / 要更新' : ''}</span>
              </label>
            </li>
          ))}
        </ul>
        <label className="check">
          <input type="checkbox" checked={withFrame} onChange={(e) => setWithFrame(e.target.checked)} /> 図枠・表題欄を含める
        </label>
        <p className="muted">
          ファイル名は図番と図面種別から作ります（例: {targets[0] ? `${fileBase(targets[0])}.dxf` : 'E-001_hv-sld.dxf'}）。
          2 枚以上をまとめて出力すると、ブラウザが「複数のファイルのダウンロード」の許可を尋ねることがあります。
        </p>
      </section>

      <section className="form-section">
        <h3>PDF / 印刷</h3>
        <p className="muted">
          ブラウザの印刷ダイアログが開きます。送信先で「PDF に保存」を選び、用紙 {project.meta.sheet.size} 横・余白なし・倍率 100%・
          「ヘッダーとフッター」オフに設定してください。選択した図面が 1 ページ 1 枚で出力されます。
        </p>
        <button className="primary" disabled={targets.length === 0} onClick={print}>
          印刷 / PDF 保存（{targets.length} 枚）
        </button>
      </section>

      <section className="form-section">
        <h3>CAD（DXF）</h3>
        <p className="muted">
          DXF R12 形式・単位 mm・原点は用紙左下。JW-CAD / AutoCAD で読み込めます。線幅はレイヤ（FRAME / BUS / WIRE / SYMBOL / TEXT / TABLE）
          と色で区別しているため、CAD 側でペン幅を割り当ててください。
        </p>
        <div className="form-row">
          <div className="form-label">文字コード</div>
          <select value={codepage} onChange={(e) => setCodepage(e.target.value as DxfCodepage)}>
            <option value="sjis">Shift_JIS（JW-CAD / AutoCAD 日本語版 推奨）</option>
            <option value="utf8">UTF-8（一部 CAD 向け・互換性は環境依存）</option>
          </select>
        </div>
        <button disabled={targets.length === 0 || busy} onClick={exportDxf}>
          {busy ? '出力中…' : `DXF をダウンロード（${targets.length} ファイル）`}
        </button>
      </section>

      <section className="form-section">
        <h3>SVG / データ</h3>
        <div className="btn-row">
          <button disabled={targets.length === 0} onClick={exportSvg}>
            SVG をダウンロード（{targets.length} ファイル）
          </button>
          <button onClick={exportJson}>プロジェクト JSON を保存</button>
        </div>
      </section>
    </div>
  );
}
