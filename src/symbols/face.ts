import type { SymbolDef } from './types';
import { L, RECT } from './helpers';

/** 盤面配置図用ブロック。ポート無し。 */
function faceBlock(
  kind: SymbolDef['kind'],
  nameJa: string,
  w: number,
  h: number,
  handleW: number,
): SymbolDef {
  const hw = handleW / 2;
  return {
    kind,
    nameJa,
    category: 'face',
    bbox: { w, h },
    prims: [
      RECT(-w / 2, -h / 2, w / 2, h / 2),
      // 操作ハンドル（上半分に縦長の小矩形）
      RECT(-hw, -h / 2 + 4, hw, -h / 2 + 4 + h * 0.3),
      // ON 表示の横線
      L(-hw, -h / 2 + 4 + h * 0.15, hw, -h / 2 + 4 + h * 0.15),
    ],
    ports: [],
    labelAnchor: { dx: 0, dy: h / 2 + 4, anchor: 'middle' },
    defaultLabels: [],
  };
}

export const FACE_MAIN = faceBlock('FACE_MAIN', '盤面: 主幹', 40, 60, 10);
export const FACE_BR_1P = faceBlock('FACE_BR_1P', '盤面: 分岐 1P', 9, 40, 4);
export const FACE_BR_2P = faceBlock('FACE_BR_2P', '盤面: 分岐 2P', 18, 40, 6);
export const FACE_BR_3P = faceBlock('FACE_BR_3P', '盤面: 分岐 3P', 27, 40, 8);

/** 端子バー（N / E） */
export const FACE_BAR: SymbolDef = {
  kind: 'FACE_BAR',
  nameJa: '盤面: 端子バー',
  category: 'face',
  bbox: { w: 60, h: 6 },
  prims: [RECT(-30, -3, 30, 3), ...Array.from({ length: 11 }, (_, i) => L(-25 + i * 5, -3, -25 + i * 5, 3))],
  ports: [],
  labelAnchor: { dx: -33, dy: 0, anchor: 'end' },
  defaultLabels: ['N'],
};

export const FACE_SYMBOLS: SymbolDef[] = [FACE_MAIN, FACE_BR_1P, FACE_BR_2P, FACE_BR_3P, FACE_BAR];
