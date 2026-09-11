import type { Point } from '../symbols/types';
import type { Diagram, Element, TextItem, Wire } from '../model/types';
import { isPortEnd } from '../model/types';
import { rerouteWire } from './builder';
import { unfitPoint } from './fit';

/**
 * 図面を作り直すときに、前の図面の手作業を新しい図面へ載せ替える。
 *
 * 引き継ぐもの:
 *  - `origin: 'manual'` の機器・配線・文字（手で足したもの）
 *  - 自動生成の機器の `labelOffset`（自動生成側は絶対に付けないので手入力と分かる）
 *  - 自動生成の機器の大きさ（手で変えた倍率。自動生成は常に等倍で作る）
 *  - 自動生成の配線の `manual: true` と経路（ドラッグで直した線）
 *
 * 引き継がないもの:
 *  - 自動生成の機器の位置・向き・ラベル（仕様どおりに引き直す。これが「作り直す」の意味）
 *
 * 前の図面は用紙に収めるため縮小・平行移動されているので、`fit` の逆変換で
 * 等倍に戻してから載せる。載せたあとに `fitDiagram` を通すこと。
 */
export function carryOverEdits(old: Diagram | undefined, gen: Diagram): { diagram: Diagram; warnings: string[] } {
  if (!old) return { diagram: gen, warnings: [] };

  const k = old.fit?.k ?? 1;
  const un = (p: Point): Point => unfitPoint(p, old.fit);
  const unEl = (e: Element): Element => ({
    ...e,
    ...un({ x: e.x, y: e.y }),
    scale: (e.scale ?? 1) / k,
    ...(e.labelOffset ? { labelOffset: { x: e.labelOffset.x / k, y: e.labelOffset.y / k } } : {}),
  });
  const unWire = (w: Wire): Wire => ({
    ...w,
    from: isPortEnd(w.from) ? w.from : un(w.from),
    to: isPortEnd(w.to) ? w.to : un(w.to),
    points: w.points.map(un),
  });
  const unText = (t: TextItem): TextItem => ({ ...t, ...un({ x: t.x, y: t.y }), h: t.h / k });

  // id がぶつかったら手動側を改名する（自動生成の連番と衝突しうる）
  const usedIds = new Set<string>([
    ...gen.elements.map((e) => e.id),
    ...gen.wires.map((w) => w.id),
    ...gen.texts.map((t) => t.id),
  ]);
  const renamed = new Map<string, string>();
  const freshId = (id: string): string => {
    if (!usedIds.has(id)) {
      usedIds.add(id);
      return id;
    }
    let n = 1;
    let next = `${id}m${n}`;
    while (usedIds.has(next)) next = `${id}m${++n}`;
    usedIds.add(next);
    renamed.set(id, next);
    return next;
  };

  const manualEls = old.elements.filter((e) => e.origin === 'manual').map((e) => ({ ...unEl(e), id: freshId(e.id) }));
  const manualTexts = old.texts.filter((t) => t.origin === 'manual').map((t) => ({ ...unText(t), id: freshId(t.id) }));

  // 自動生成の機器へは「自動生成が作らない値」だけを戻す
  const oldById = new Map(old.elements.map((e) => [e.id, e]));
  /** 何か引き継いだか（何も無ければ「手動編集あり」の印を落とす） */
  let carried = manualEls.length > 0 || manualTexts.length > 0;
  const elements: Element[] = [
    ...gen.elements.map((e) => {
      const prev = oldById.get(e.id);
      if (!prev || prev.kind !== e.kind || prev.origin === 'manual') return e;
      // 用紙に収める縮小を戻した倍率。1 でなければ手で大きさを変えている
      const prevScale = unEl(prev).scale ?? 1;
      const over = {
        ...(prev.labelOffset ? { labelOffset: unEl(prev).labelOffset! } : {}),
        ...(Math.abs(prevScale - 1) > 1e-3 ? { scale: prevScale } : {}),
        ...(prev.nameplate ? { nameplate: prev.nameplate } : {}),
        ...(prev.nameplateName ? { nameplateName: prev.nameplateName } : {}),
      };
      if (Object.keys(over).length === 0) return e;
      carried = true;
      return { ...e, ...over };
    }),
    ...manualEls,
  ];

  const alive = new Set(elements.map((e) => e.id));
  const warnings: string[] = [];
  let lost = 0;
  /** つなぎ先が消えた端は、最後に描かれていた座標で止める */
  const keepEnd = (end: Wire['from'], at: Point | undefined): Wire['from'] => {
    if (!isPortEnd(end)) return end;
    const id = renamed.get(end.elementId) ?? end.elementId;
    if (alive.has(id)) return { ...end, elementId: id };
    lost += 1;
    return at ?? { x: 0, y: 0 };
  };

  const manualWires = old.wires
    .filter((w) => w.origin === 'manual')
    .map((w) => {
      const u = unWire(w);
      return {
        ...u,
        id: freshId(w.id),
        from: keepEnd(u.from, u.points[0]),
        to: keepEnd(u.to, u.points[u.points.length - 1]),
      };
    });

  const oldWireById = new Map(old.wires.map((w) => [w.id, w]));
  /** 用紙合わせの逆変換で丸めが乗るので、少し緩く比べる */
  const samePoints = (a: Point[], b: Point[]): boolean =>
    a.length === b.length && a.every((p, i) => Math.abs(p.x - b[i]!.x) < 0.01 && Math.abs(p.y - b[i]!.y) < 0.01);
  const sameEnd = (a: Wire['from'], b: Wire['from']): boolean =>
    isPortEnd(a) && isPortEnd(b) ? a.elementId === b.elementId && a.portId === b.portId : !isPortEnd(a) && !isPortEnd(b);

  const genWires: Wire[] = gen.wires.map((w) => {
    const prev = oldWireById.get(w.id);
    if (!prev || !prev.manual || prev.origin === 'manual') return w;
    if (!sameEnd(prev.from, w.from) || !sameEnd(prev.to, w.to)) return w;
    const points = unWire(prev).points;
    // 自動生成そのままの経路（母線など manual で作られる線）は引き継ぎ扱いにしない
    if (samePoints(points, w.points)) return w;
    // 手で直した経路を戻す。端は新しいポート位置へ追従させる
    carried = true;
    return rerouteWire({ ...w, manual: true, points }, elements);
  });
  const wires: Wire[] = [...genWires, ...manualWires.map((w) => rerouteWire(w, elements))];

  if (lost > 0) {
    warnings.push(`手で引いた配線 ${lost} 本のつなぎ先が無くなったので、端を元の位置で止めました`);
  }

  carried = carried || manualWires.length > 0;
  return {
    diagram: { ...gen, elements, wires, texts: [...gen.texts, ...manualTexts], edited: carried },
    warnings,
  };
}
