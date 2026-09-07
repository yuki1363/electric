import type { PaperSize } from '../model/types';

export interface PrintPage {
  svg: string;
  size: PaperSize;
}

/**
 * #print-root に用紙実寸の SVG を並べ、ブラウザの印刷ダイアログを開く。
 * PDF にするには印刷先で「PDF に保存」を選ぶ。
 */
export function openPrint(pages: PrintPage[]): void {
  if (pages.length === 0) return;
  const root = document.getElementById('print-root');
  if (!root) throw new Error('#print-root がありません');
  const size = pages[0]!.size;
  root.innerHTML = pages.map((p) => `<div class="print-page ${p.size}">${p.svg}</div>`).join('');
  const style = document.createElement('style');
  style.id = 'print-page-style';
  style.textContent = `@page { size: ${size} landscape; margin: 0; }`;
  document.head.appendChild(style);

  const cleanup = () => {
    root.innerHTML = '';
    style.remove();
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);
  // Safari などで afterprint が来ない場合の保険
  setTimeout(() => window.print(), 50);
  setTimeout(cleanup, 60_000);
}
