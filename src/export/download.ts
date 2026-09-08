export function downloadBlob(name: string, data: string | Uint8Array | Blob, mime: string): void {
  const blob = data instanceof Blob ? data : new Blob([data as BlobPart], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsText(file);
  });
}

export function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as ArrayBuffer);
    r.onerror = () => reject(r.error);
    r.readAsArrayBuffer(file);
  });
}

/** ファイル選択ダイアログを開く */
export function pickFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.oncancel = () => resolve(null);
    input.click();
  });
}

/**
 * ファイル名に使えない文字を除去する。
 * asciiOnly を指定すると非 ASCII も `_` に落とす（DXF など CAD 取り込み用）。
 */
export function safeFileName(s: string, asciiOnly = false): string {
  let out = s.replace(/[\\/:*?"<>|]/g, '_');
  if (asciiOnly) out = out.replace(/[^\x20-\x7E]+/g, '_');
  out = out.replace(/\s+/g, '_').replace(/_{2,}/g, '_').replace(/^_+|_+$/g, '');
  return out || 'drawing';
}
