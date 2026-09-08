/** 台帳の表記ゆれを吸収するための正規化 */

/** ハイフンに見える文字（全角・図形文字・音引きの誤用など）をすべて ASCII の - に寄せる */
const HYPHENS = /[‐‑‒–—―−－﹣ー]/g;

/**
 * 全角英数記号を半角へ、各種ハイフンを - へ、空白を 1 個に畳む。
 * 日本語（かな・漢字）はそのまま残す。
 */
export function normalize(s: string): string {
  return s
    .replace(/[！-～]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(HYPHENS, '-')
    .replace(/　/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** 比較用のキー。正規化に加えて大文字化し空白と記号を落とす */
export function keyOf(s: string): string {
  return normalize(s).toUpperCase().replace(/[\s.・]/g, '');
}

/** 数値を取り出す（"500kVA" → 500）。見つからなければ undefined */
export function firstNumber(s: string): number | undefined {
  const m = normalize(s).match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : undefined;
}
