import type { CircuitSpec, HvSpec, LvPanelSpec, Project, ProjectMeta } from './types';
import { defaultSheet } from '../layout/constants';

export const today = (): string => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export function defaultHv(): HvSpec {
  return {
    enabled: true,
    incoming: 'overhead',
    pas: { kind: 'PAS', sog: true, ratedA: 300 },
    cable: { type: 'CVT', sq: 38, lengthM: 30 },
    vct: true,
    ds: true,
    mainBreaker: { devices: ['VCB'], ratedA: 600, breakingKA: 12.5, ct: true, ctRatio: '75/5A', ocr: true },
    la: true,
    metering: { vt: true, a: true, v: true, w: true, wh: false, pf: false, as: true, vs: true },
    feeders: [],
    transformers: [],
    capacitors: [],
    grounding: { aType: true, bType: true },
  };
}

export function defaultCircuit(no: number): CircuitSpec {
  return {
    no,
    name: `回路${no}`,
    breaker: 'MCB',
    at: 20,
    poles: '2P',
    voltage: 100,
    loadName: '',
    loadVA: 0,
    wireSize: 'VVF1.6-2C',
  };
}

export function defaultPanel(id: string, name: string): LvPanelSpec {
  return {
    id,
    name,
    supply: '1φ3W100/200',
    main: { kind: 'ELB', af: 100, at: 75, poles: '3P', sensitivityMa: 30 },
    circuits: [],
    face: { rows: 2, order: 'oddTopEvenBottom' },
  };
}

export function defaultMeta(): ProjectMeta {
  return {
    name: '受変電設備',
    drawingNo: 'E-001',
    date: today(),
    author: '',
    company: '',
    sheet: defaultSheet('A3'),
  };
}

export function createEmptyProject(): Project {
  return {
    version: 1,
    meta: defaultMeta(),
    hv: { ...defaultHv(), enabled: false },
    panels: [{ ...defaultPanel('panel_L1', 'L-1'), circuits: [defaultCircuit(1), defaultCircuit(2)] }],
    diagrams: [],
  };
}

const c = (
  no: number,
  name: string,
  loadName: string,
  loadVA: number,
  o: Partial<CircuitSpec> = {},
): CircuitSpec => ({
  ...defaultCircuit(no),
  name,
  loadName,
  loadVA,
  ...o,
});

/** 6.6kV 受電 + 分電盤 2 面の現実的なサンプル */
export function sampleProject(): Project {
  const hv: HvSpec = {
    ...defaultHv(),
    transformers: [
      { id: 'tr_1', name: 'Tr-1', phase: '1φ', kva: 100, secondary: '105-210V', devices: ['LBS', 'PF'], pfA: 30, feeds: 'panel_L1' },
      { id: 'tr_2', name: 'Tr-2', phase: '3φ', kva: 150, secondary: '210V', devices: ['LBS', 'PF'], pfA: 40, feeds: 'panel_P1' },
    ],
    capacitors: [{ id: 'sc_1', name: 'SC-1', kvar: 50, sr: true, devices: ['LBS', 'PF'], pfA: 30 }],
  };

  const l1: LvPanelSpec = {
    ...defaultPanel('panel_L1', 'L-1'),
    sourceTransformerId: 'tr_1',
    main: { kind: 'ELB', af: 100, at: 75, poles: '3P', sensitivityMa: 30 },
    circuits: [
      c(1, '照明1', '1F 事務室 照明', 800, { at: 20, poles: '1P' }),
      c(2, '照明2', '1F 廊下・WC 照明', 600, { at: 20, poles: '1P' }),
      c(3, 'コンセント1', '1F 事務室 コンセント', 1500, { at: 20, poles: '1P' }),
      c(4, 'コンセント2', '1F 給湯室 コンセント', 1500, { at: 20, poles: '1P', breaker: 'ELB', sensitivityMa: 15 }),
      c(5, '照明3', '2F 事務室 照明', 800, { at: 20, poles: '1P' }),
      c(6, '照明4', '2F 会議室 照明', 500, { at: 20, poles: '1P' }),
      c(7, 'コンセント3', '2F 事務室 コンセント', 1500, { at: 20, poles: '1P' }),
      c(8, 'コンセント4', '2F 会議室 コンセント', 1500, { at: 20, poles: '1P' }),
      c(9, 'エアコン1', '1F 事務室 EAC', 2500, { at: 20, poles: '2P', voltage: 200, wireSize: 'VVF2.0-2C' }),
      c(10, 'エアコン2', '2F 事務室 EAC', 2500, { at: 20, poles: '2P', voltage: 200, wireSize: 'VVF2.0-2C' }),
      c(11, 'エアコン3', '2F 会議室 EAC', 2000, { at: 20, poles: '2P', voltage: 200, wireSize: 'VVF2.0-2C' }),
      c(12, '給湯器', '給湯室 電気温水器', 3000, { at: 20, poles: '2P', voltage: 200, wireSize: 'VVF2.0-2C', breaker: 'ELB', sensitivityMa: 15 }),
      c(13, '換気', '換気扇', 300, { at: 20, poles: '1P' }),
      c(14, '予備', '', 0, { at: 20, poles: '1P' }),
      c(15, '予備', '', 0, { at: 20, poles: '2P', voltage: 200 }),
      c(16, '予備', '', 0, { at: 20, poles: '2P', voltage: 200 }),
    ],
  };

  const p1: LvPanelSpec = {
    ...defaultPanel('panel_P1', 'P-1'),
    supply: '3φ3W210',
    sourceTransformerId: 'tr_2',
    main: { kind: 'MCB', af: 225, at: 150, poles: '3P' },
    face: { rows: 1, order: 'sequential' },
    circuits: [
      c(1, '空調1', '空調室外機 RC-1', 7500, { at: 30, poles: '3P', voltage: 210, wireSize: 'CV5.5-3C' }),
      c(2, '空調2', '空調室外機 RC-2', 7500, { at: 30, poles: '3P', voltage: 210, wireSize: 'CV5.5-3C' }),
      c(3, 'ポンプ', '揚水ポンプ 3.7kW', 4500, { at: 30, poles: '3P', voltage: 210, wireSize: 'CV3.5-3C', breaker: 'ELB', sensitivityMa: 30 }),
      c(4, 'ファン', '排風機 1.5kW', 2000, { at: 15, poles: '3P', voltage: 210, wireSize: 'CV2-3C' }),
      c(5, '予備', '', 0, { at: 30, poles: '3P', voltage: 210, wireSize: 'CV3.5-3C' }),
    ],
  };

  return {
    version: 1,
    meta: {
      name: '○○ビル 受変電設備',
      drawingNo: 'E-001',
      date: today(),
      author: '',
      company: '',
      sheet: defaultSheet('A3'),
    },
    hv,
    panels: [l1, p1],
    diagrams: [],
  };
}
