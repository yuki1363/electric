import { useMemo, useState } from 'react';
import type { Project } from '../model/types';
import { readFileAsArrayBuffer, readFileAsText } from '../export/download';
import { readCsv, readXlsx, type SheetData } from '../import/xlsx';
import {
  NP_FIELD_LABEL,
  detectHeader,
  parseRows,
  pickSheet,
  type ColumnMap,
  type DetectedHeader,
  type NpField,
  type ParsedRow,
} from '../import/nameplate';
import { applyImportPlan, buildImportPlan } from '../import/plan';
import { useDispatch } from '../state/context';

const FIELDS = Object.keys(NP_FIELD_LABEL) as NpField[];

const GROUP_LABEL: Record<ParsedRow['group']['kind'], string> = {
  incoming: '引込・柱上',
  main: '高圧受電盤',
  feeder: '高圧分岐盤',
  capacitor: '進相コンデンサ',
  lvPanel: '変圧器・低圧盤',
  other: 'その他',
};

export function ImportDialog({ project, onClose }: { project: Project; onClose: () => void }) {
  const dispatch = useDispatch();
  const [fileName, setFileName] = useState('');
  const [sheets, setSheets] = useState<SheetData[]>([]);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [header, setHeader] = useState<DetectedHeader | null>(null);
  const [map, setMap] = useState<ColumnMap>({});
  const [mode, setMode] = useState<'replace' | 'merge'>('replace');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const sheet = sheets[sheetIndex];

  const rows = useMemo(() => (sheet && header ? parseRows(sheet, header, map) : []), [sheet, header, map]);
  const plan = useMemo(() => (rows.length ? buildImportPlan(rows) : null), [rows]);

  const chooseSheet = (idx: number) => {
    setSheetIndex(idx);
    const s = sheets[idx];
    const h = s ? detectHeader(s.rows) : null;
    setHeader(h);
    setMap(h?.map ?? {});
  };

  const onPick = async (file: File) => {
    setBusy(true);
    setError('');
    try {
      const isCsv = /\.(csv|tsv|txt)$/i.test(file.name);
      const list = isCsv ? readCsv(await readFileAsText(file)) : await readXlsx(await readFileAsArrayBuffer(file));
      setSheets(list);
      setFileName(file.name);
      const picked = pickSheet(list);
      const idx = picked ? list.indexOf(picked.sheet) : 0;
      setSheetIndex(idx);
      setHeader(picked?.header ?? detectHeader(list[idx]?.rows ?? []));
      setMap(picked?.header.map ?? {});
      if (!picked) setError('銘板表らしい見出し行が見つかりませんでした。シートと列の対応を選んでください。');
    } catch (e) {
      setError((e as Error).message);
      setSheets([]);
    } finally {
      setBusy(false);
    }
  };

  const doImport = () => {
    if (!plan) return;
    dispatch({ type: 'IMPORT_NAMEPLATES', project: applyImportPlan(project, plan, mode) });
    onClose();
  };

  const colOptions = sheet ? (sheet.rows[header?.rowIndex ?? 0] ?? []).map((c, i) => ({ i, label: c || `列${i + 1}` })) : [];

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal import-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Excel から機器銘板を取り込む</h2>
          <button onClick={onClose}>閉じる</button>
        </div>

        <div className="modal-body">
          <section className="form-section">
            <h3>1. ファイルを選ぶ</h3>
            <input
              type="file"
              accept=".xlsx,.csv,.tsv,.txt"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onPick(f);
              }}
            />
            {busy && <span className="muted"> 読み込み中…</span>}
            {fileName && <span className="muted"> {fileName}</span>}
            <p className="muted">
              機器名称・型式・定格容量・製造者・製造年月・製造番号・使用箇所・備考 の列を持つ台帳を読み取ります。
              備考の盤名（高圧受電盤 / 高圧分岐盤 / SC / 低圧◯◯ など）で機器を振り分けます。
            </p>
            {error && <p className="error">{error}</p>}
          </section>

          {sheets.length > 0 && (
            <section className="form-section">
              <h3>2. シートと列の対応</h3>
              <div className="form-row">
                <div className="form-label">シート</div>
                <select value={sheetIndex} onChange={(e) => chooseSheet(Number(e.target.value))}>
                  {sheets.map((s, i) => (
                    <option key={i} value={i}>
                      {s.name}（{s.rows.length} 行）
                    </option>
                  ))}
                </select>
                {header && <span className="muted"> 見出し行: {header.rowIndex + 1} 行目</span>}
              </div>
              <div className="col-map">
                {FIELDS.map((f) => (
                  <label key={f}>
                    <span>{NP_FIELD_LABEL[f]}</span>
                    <select
                      value={map[f] ?? ''}
                      onChange={(e) =>
                        setMap({ ...map, [f]: e.target.value === '' ? undefined : Number(e.target.value) })
                      }
                    >
                      <option value="">（使わない）</option>
                      {colOptions.map((c) => (
                        <option key={c.i} value={c.i}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            </section>
          )}

          {plan && (
            <section className="form-section">
              <h3>3. 取り込む内容の確認</h3>
              <div className="import-summary">
                <span>読み取った機器 <b>{plan.rows.length}</b> 件</span>
                <span>高圧分岐盤 <b>{plan.feeders.length}</b></span>
                <span>変圧器 <b>{plan.transformers.length}</b></span>
                <span>進相コンデンサ <b>{plan.capacitors.length}</b></span>
                <span>分電盤 <b>{plan.panels.length}</b></span>
                <span>銘板表のみ <b>{plan.extras.length}</b></span>
              </div>
              {plan.notes.map((n, i) => (
                <p key={i} className="notice">{n}</p>
              ))}
              <div className="preview-wrap">
                <table className="grid-table preview">
                  <thead>
                    <tr>
                      <th>行</th>
                      <th>機器名称</th>
                      <th>型式</th>
                      <th>定格容量</th>
                      <th>製造者</th>
                      <th>製造年月</th>
                      <th>製造番号</th>
                      <th>振り分け先</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plan.rows.map((r) => (
                      <tr key={r.lineNo}>
                        <td className="muted">{r.lineNo}</td>
                        <td>{r.deviceName}</td>
                        <td>{r.model}</td>
                        <td>{r.ratingText}</td>
                        <td>{r.maker}</td>
                        <td>{r.madeOn}</td>
                        <td>{r.serial}</td>
                        <td>
                          {GROUP_LABEL[r.group.kind]}
                          {r.group.name ? ` / ${r.group.name}` : ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>

        <div className="modal-foot">
          <label className="check">
            <input type="radio" checked={mode === 'replace'} onChange={() => setMode('replace')} /> 今の設備を置き換える
          </label>
          <label className="check">
            <input type="radio" checked={mode === 'merge'} onChange={() => setMode('merge')} /> 今の設備に追加する
          </label>
          <span className="muted">取り込みは「元に戻す」1 回で取り消せます</span>
          <button className="primary" disabled={!plan || plan.rows.length === 0} onClick={doImport}>
            取り込む
          </button>
        </div>
      </div>
    </div>
  );
}
