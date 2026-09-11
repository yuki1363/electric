import type { HvSlot, Nameplate, Project } from './types';
import { deviceKey, deviceLabel, isLvDevice, orderDevices } from './switchgear';
import { getSymbol } from '../symbols';
import { trConnectionText } from './transformer';
import { RELAY_SHORT, orderRelays, relayKey } from './relay';
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
  /** 台数（既定 1） */
  qty: number;
}

/** 開閉装置の定格表記。図面ラベルと同じ内容に電圧階級を足す（低圧の機器は 600V 系） */
function ratingOf(dev: SwitchDevice, o: { ratedA?: number; breakingKA?: number; pfA?: number }): string {
  const label = deviceLabel(dev, o).join(' ').replace(new RegExp(`^${dev}\\s*`), '');
  if (!label) return '';
  return `${isLvDevice(dev) ? '600V' : '7.2kV'} ${label}`;
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
    qty: np?.qty && np.qty > 1 ? np.qty : 1,
  };
}

/**
 * 設備仕様から銘板表の行を組み立てる。
 * 銘板が未入力の機器も、定格だけは仕様から埋めて一覧に出す。
 */
export function nameplateRows(project: Project): NameplateRow[] {
  // 自動作図を切っているときは図面が正。図面に置かれた機器だけから表を作る
  if (project.meta.autoGenerate === false) {
    return [...diagramRows(project), ...extraRows(project)];
  }
  const out = hvRows(project.hv, '');
  for (const sub of project.substations ?? []) out.push(...hvRows(sub.hv, `${sub.name} `));
  return [...out, ...panelRows(project), ...diagramRows(project), ...extraRows(project)];
}

/** 高圧設備 1 組ぶんの行。副変電所は備考の頭に盤名を付ける */
function hvRows(hv: Project['hv'], prefix: string): NameplateRow[] {
  const out: NameplateRow[] = [];
  const np = (slot: HvSlot) => hv.nameplates?.[slot];
  const g = (s: string) => `${prefix}${s}`;

  if (hv.enabled) {
    const incoming = hv.incoming === 'overhead' ? '架空引込' : '地中引込';
    if (hv.pas.kind !== 'none') {
      out.push(
        row(hv.pas.kind, np('pas'), `7.2kV ${hv.pas.ratedA}A${hv.pas.sog ? ' SOG付' : ''}`, g(`引込（${incoming}）`)),
      );
    }
    // 区分開閉器の地絡保護（ZCT と継電器）
    const pasRelays = orderRelays(hv.pas.relays);
    if (hv.pas.kind !== 'none' && (hv.pas.zct || pasRelays.length > 0)) {
      out.push(row('ZCT', np('zct'), '', g('引込')));
    }
    for (const r of pasRelays) out.push(row(RELAY_SHORT[r], np(relayKey(r) as HvSlot), '', g('引込')));
    // 旧データ（継電器を選ばずに DGR の銘板だけ入っている）も一覧から落とさない
    if (!pasRelays.includes('DGR') && np('dgr')) out.push(row('DGR', np('dgr'), '', g('引込')));
    out.push(
      row(
        '高圧ケーブル',
        np('cable'),
        `${hv.cable.type} ${hv.cable.sq}sq${hv.cable.lengthM ? ` ${hv.cable.lengthM}m` : ''}`,
        g('引込'),
      ),
    );
    if (hv.vct) {
      out.push(row('VCT', np('vct'), '取引用計器', g('高圧受電盤')));
      out.push(row('Wh', np('whTr'), '取引用電力量計', g('高圧受電盤')));
    }
    if (hv.ds) out.push(row('DS', np('ds'), '7.2kV', g('高圧受電盤')));
    if (hv.la) out.push(row('LA', np('la'), '', g('高圧受電盤')));
    if (hv.metering.vt) {
      out.push(row('VTヒューズ', np('vtf'), '', g('高圧受電盤')));
      out.push(row('VT', np('vt'), '6600/110V', g('高圧受電盤')));
    }

    const meters: [boolean, string, HvSlot][] = [
      [hv.metering.v && (hv.metering.vs ?? true), 'VS', 'vs'],
      [hv.metering.v, 'V', 'meterV'],
      [hv.metering.a && (hv.metering.as ?? true), 'AS', 'as'],
      [hv.metering.a, 'A', 'meterA'],
      [hv.metering.w, 'W', 'meterW'],
      [hv.metering.pf, 'cosφ', 'meterPf'],
      [hv.metering.wh, 'Wh', 'meterWh'],
    ];
    for (const [on, name, slot] of meters) if (on) out.push(row(name, np(slot), '', g('高圧受電盤')));

    const mb = hv.mainBreaker;
    if (mb.ct) out.push(row('CT', np('ct'), mb.ctRatio ?? '', g('高圧受電盤')));
    for (const r of orderRelays(mb.relays ?? (mb.ocr ? ['OCR'] : []))) {
      out.push(row(RELAY_SHORT[r], np(relayKey(r) as HvSlot), '', g('高圧受電盤')));
    }
    for (const dev of orderDevices(mb.devices)) {
      out.push(row(dev, np(deviceKey(dev) as HvSlot), ratingOf(dev, mb), g('高圧受電盤')));
    }

    for (const f of hv.feeders) {
      const fnp = (k: string) => f.nameplates?.[k];
      for (const dev of orderDevices(f.devices)) {
        out.push(row(dev, fnp(deviceKey(dev)), ratingOf(dev, f), g(f.name)));
      }
      if (f.ct) out.push(row('CT', fnp('ct'), f.ctRatio ?? '', g(f.name)));
      for (const r of orderRelays(f.relays ?? (f.ocr ? ['OCR'] : []))) {
        out.push(row(RELAY_SHORT[r], fnp(relayKey(r)), '', g(f.name)));
      }
      if (f.metering?.a) {
        if (f.metering.as) out.push(row('AS', fnp('as'), '', g(f.name)));
        out.push(row('A', fnp('meterA'), '', g(f.name)));
      }
      if (f.metering?.v) {
        out.push(row('VT', fnp('vt'), '6600/110V', g(f.name)));
        if (f.metering.vs) out.push(row('VS', fnp('vs'), '', g(f.name)));
        out.push(row('V', fnp('meterV'), '', g(f.name)));
      }
      if (f.cable) {
        out.push(
          row(
            '高圧ケーブル',
            fnp('cable'),
            `${f.cable.type} ${f.cable.sq}sq${f.cable.lengthM ? ` ${f.cable.lengthM}m` : ''}`,
            g(f.name),
          ),
        );
      }
    }

    for (const t of hv.transformers) {
      for (const dev of orderDevices(t.devices)) {
        out.push(row(dev, t.nameplates?.[deviceKey(dev)], ratingOf(dev, t), g(t.name)));
      }
      const conn = trConnectionText(t);
      const src = t.externalSource;
      const sm = t.secondaryMetering;
      if (sm?.a || sm?.v) {
        const tnp = (k: string) => t.nameplates?.[k];
        out.push(row('CT', tnp('ct'), '二次側', g(t.name)));
        if (sm.a) {
          if (sm.as) out.push(row('AS', tnp('as'), '', g(t.name)));
          out.push(row('A', tnp('meterA'), '', g(t.name)));
        }
        if (sm.v) {
          out.push(row('VT', tnp('vt'), '', g(t.name)));
          if (sm.vs) out.push(row('VS', tnp('vs'), '', g(t.name)));
          out.push(row('V', tnp('meterV'), '', g(t.name)));
        }
      }
      out.push(
        row(
          'Tr',
          t.nameplate,
          `${t.phase} ${t.kva}kVA ${t.primary || '6.6kV'}/${t.secondary}${conn ? ` ${conn}` : ''}`,
          src ? `${t.name}（${src.name}）` : t.name,
        ),
      );
    }
    for (const c of hv.capacitors) {
      for (const dev of orderDevices(c.devices)) {
        out.push(row(dev, c.nameplates?.[deviceKey(dev)], ratingOf(dev, c), g(c.name)));
      }
      if (c.sr) out.push(row('SR', c.nameplates?.sr, '6%', g(c.name)));
      out.push(row('SC', c.nameplate, `${c.kvar}kvar 6600V`, g(c.name)));
    }
  }

  return out;
}

function panelRows(project: Project): NameplateRow[] {
  const out: NameplateRow[] = [];
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

  return out;
}

/**
 * 図面に置かれた機器の銘板。
 * 自動作図が有効なときは、仕様側から出る機器と二重にならないよう
 * 手で足したもの（origin: 'manual'）と仕様に紐づかない図面のものだけを見る。
 * 自動作図を切っているときは図面が正なので、銘板が入っている機器はすべて出す。
 */
function diagramRows(project: Project): NameplateRow[] {
  const out: NameplateRow[] = [];
  const fromDrawingOnly = project.meta.autoGenerate === false;
  for (const d of project.diagrams) {
    if (d.kind === 'nameplate') continue;
    for (const el of d.elements) {
      if (!fromDrawingOnly && el.origin !== 'manual' && d.kind !== 'free') continue;
      if (!el.nameplate || Object.values(el.nameplate).every((v) => v === undefined || v === '')) continue;
      const def = getSymbol(el.kind);
      // 定格が空ならラベルの 1 行目で埋める。ただし図記号を置いたままの既定ラベル
      // （「VCB」など機器名そのもの）は定格ではないので使わない
      const label = el.labels[0] ?? '';
      const fallback = (def.defaultLabels ?? []).includes(label) ? '' : label;
      out.push(row(el.nameplateName || def.nameJa, el.nameplate, fallback, d.title));
    }
  }

  return out;
}

function extraRows(project: Project): NameplateRow[] {
  return (project.extraNameplates ?? []).map((e) => row(e.deviceName, e, '', e.group ?? ''));
}
