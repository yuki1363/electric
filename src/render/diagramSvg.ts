import type { Diagram } from '../model/types';
import type { TitleInfo } from '../layout/sheet';
import { PAPER } from '../layout/constants';
import { flattenDiagram, type WorldPrim } from './flatten';
import { primToSvg, svgDocument, svgGroup } from './svg';
import { LAYER_ORDER, LAYER_STROKE, type Layer } from './style';

/** レイヤごとの <g> にまとめた SVG 断片（viewBox は用紙 mm） */
export function diagramSvgInner(prims: WorldPrim[]): string {
  const byLayer = new Map<Layer, string[]>();
  for (const wp of prims) {
    const arr = byLayer.get(wp.layer) ?? [];
    arr.push(primToSvg(wp.prim, { baseStroke: LAYER_STROKE[wp.layer] }));
    byLayer.set(wp.layer, arr);
  }
  return LAYER_ORDER.filter((l) => byLayer.has(l))
    .map((l) => svgGroup(byLayer.get(l)!.join(''), `id="layer-${l}" data-layer="${l}"`))
    .join('');
}

/** 単体 SVG 文書（ダウンロード・印刷用） */
export function diagramToSvg(d: Diagram, title?: TitleInfo): string {
  const paper = PAPER[d.sheet.size];
  const inner = diagramSvgInner(flattenDiagram(d, title ? { frame: title } : {}));
  return svgDocument(inner, { width: paper.w, height: paper.h });
}
