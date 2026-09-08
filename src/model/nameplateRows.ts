import type { HvSlot, Nameplate, Project } from './types';
import { deviceKey, deviceLabel, orderDevices } from './switchgear';
import type { SwitchDevice } from './switchgear';

/** 銘板表 1 行分。すべて表示用の文字列に落としてある */
export interface NameplateRow {
  /** 機器名称 */
  deviceName: string;
  model: string;
  ratingText: string;
  maker: string;
  madeOn: string;
  serial: string;
  location: string;
  /** 備考（所属盤・系統） */
  note: string;
}

/** 開閉装置の定格表記。図面ラベルと同じ内容を 6.6kV 系の表記にする */
function ratingOf(dev: SwitchDevice, o: { ratedA?: number; breakingKA?: number; pfA?: number }): string {
  const label = deviceLabel(dev, o).join(' ').replace(new RegExp(`^${dev}\\s*`), '');
  return label ? `7.2kV ${label}` : '';
}

function row(deviceName: string, np: Nameplate | undefined, fallbackRating: string, group: string): NameplateRow {
  return {
    deviceName,
    model: np?.model ?? '',
    ratingText: np?.ratingText || fallbackRating,
    maker: np?.maker ?? '',
    madeOn: np?.madeOn ?? '',
    serial: np?.serial ?? '',
    location: np?.location ?? '',
    note: np?.note || group,
  };
}

/**
 * 設備仕様から銘板表の行を組み立てる。
 * 銘板が未入力の機器も、定格だけは仕様から埋めて一覧に出す。
 */
export function nameplateRows(project: Project): NameplateRow[] {
  const hv = project.hv;
  const out: NameplateRow[] = [];
  const np = (slot: HvSlot) => hv.nameplates?.[slot];

  if (hv.enabled) {
    const incoming = hv.incoming === 'overhead' ? '架空引込' : '地中引込';
    if (hv.pas.kind !== 'none') {
      out.push(
        row(hv.pas.kind, np('pas'), `7.2kV ${hv.pas.ratedA}A${hv.pas.sog ? ' SOG付' : ''}`, `引込（${incoming}）`),
      );
    }
    if (np('dgr')) out.push(row('DGR', np('dgr'), '', '引込'));
    out.push(
      row(
        '高圧ケーブル',
        np('cable'),
        `${hv.cable.type} ${hv.cable.sq}sq${hv.cable.lengthM ? ` ${hv.cable.lengthM}m` : ''}`,
        '引込',
      ),
    );
    if (hv.vct) out.push(row('VCT', np('vct'), '取引用計器', '高圧受電盤'));
    if (hv.ds) out.push(row('DS', np('ds'), '7.2kV', '高圧受電盤'));
    if (hv.la) out.push(row('LA', np('la'), '', '高圧受電盤'));
    if (hv.metering.vt) out.push(row('VT', np('vt'), '6600/110V', '高圧受電盤'));

    const mb = hv.mainBreaker;
    if (mb.ct) out.push(row('CT', np('ct'), mb.ctRatio ?? '', '高圧受電盤'));
    if (mb.ocr) out.push(row('OCR', np('ocr'), '', '高圧受電盤'));
    for (const dev of orderDevices(mb.devices)) {
      out.push(row(dev, np(deviceKey(dev) as HvSlot), ratingOf(dev, mb), '高圧受電盤'));
    }

    for (const f of hv.feeders) {
      const fnp = (k: string) => f.nameplates?.[k];
      for (const dev of orderDevices(f.devices)) {
        out.push(row(dev, fnp(deviceKey(dev)), ratingOf(dev, f), f.name));
      }
      if (f.ct) out.push(row('CT', fnp('ct'), f.ctRatio ?? '', f.name));
      if (f.ocr) out.push(row('OCR', fnp('ocr'), '', f.name));
      if (f.cable) {
        out.push(
          row(
            '高圧ケーブル',
            fnp('cable'),
            `${f.cable.type} ${f.cable.sq}sq${f.cable.lengthM ? ` ${f.cable.lengthM}m` : ''}`,
            f.name,
          ),
        );
      }
    }

    for (const t of hv.transformers) {
      for (const dev of orderDevices(t.devices)) {
        out.push(row(dev, t.nameplates?.[deviceKey(dev)], ratingOf(dev, t), t.name));
      }
      out.push(row('Tr', t.nameplate, `${t.phase} ${t.kva}kVA ${t.primary || '6.6kV'}/${t.secondary}`, t.name));
    }
    for (const c of hv.capacitors) {
      for (const dev of orderDevices(c.devices)) {
        out.push(row(dev, c.nameplates?.[deviceKey(dev)], ratingOf(dev, c), c.name));
      }
      if (c.sr) out.push(row('SR', c.nameplates?.sr, '6%', c.name));
      out.push(row('SC', c.nameplate, `${c.kvar}kvar 6600V`, c.name));
    }
  }

  for (const p of project.panels) {
    const m = p.main;
    out.push(
      row(
        `分電盤 主幹 ${m.kind}`,
        p.nameplate,
        `${m.af}AF/${m.at}AT ${m.poles}${m.kind === 'ELB' && m.sensitivityMa ? ` ${m.sensitivityMa}mA` : ''}`,
        p.name,
      ),
    );
  }

  for (const e of project.extraNameplates ?? []) {
    out.push(row(e.deviceName, e, '', e.group ?? ''));
  }

  return out;
}
