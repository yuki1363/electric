let counter = 0;

/** 一意 id。prefix + ランダム。テスト用に決定的な採番も可能 */
export function newId(prefix = 'id'): string {
  const rnd =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  counter += 1;
  return `${prefix}_${rnd}${counter.toString(36)}`;
}

/** 生成器用: 決定的な id（図面 id + 連番） */
export function seqId(scope: string, n: number, prefix = 'e'): string {
  return `${scope}_${prefix}${n}`;
}
