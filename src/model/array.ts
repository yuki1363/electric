/** 配列の i 番目を 1 つ前（dir -1）／後（dir 1）へ動かす。端では何もしない */
export function moveAt<T>(arr: readonly T[], i: number, dir: -1 | 1): T[] {
  const j = i + dir;
  if (i < 0 || i >= arr.length || j < 0 || j >= arr.length) return [...arr];
  const out = [...arr];
  [out[i], out[j]] = [out[j]!, out[i]!];
  return out;
}
