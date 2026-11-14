import { DHW_PROFILE, SPACE_PROFILE } from './defaults';
import { energySplit } from './prices';
import type { Inputs } from './types';

/**
 * Monthly PV model (F28): how much of the heat pump electricity a PV system (Photovoltaik) with optional battery
 * storage (Batteriespeicher) can really cover. In winter, when the heat pump needs most electricity, PV yields little.
 *
 * Per month: PV yield = kWp × specific yield × monthly share. Of the overlap min(PV, consumption) only part
 * is used at the same time (simultaneity (Gleichzeitigkeit)); a battery shifts surplus into the evening and night
 * (at most one full cycle per day, with losses). The heat pump only gets what is left after the household
 * electricity (Haushaltsstrom): its share is the difference between "household + heat pump" and "household only".
 */

/** Share of the annual PV yield per month (Germany, south-facing, rough average of several years). */
export const PV_MONTH_SHARE: readonly number[] = normalize([3, 5, 8.5, 11.5, 13, 13, 13.5, 12, 9, 6, 3, 2]);
/** Share of the annual household electricity per month (slightly higher in winter: light, being at home). */
export const HOUSEHOLD_MONTH_SHARE: readonly number[] = normalize([9.5, 8.7, 8.8, 8, 7.6, 7.2, 7.3, 7.5, 7.7, 8.4, 9.3, 10]);
/** Share of the monthly overlap min(PV, consumption) that is used directly (without battery). */
export const SIMULTANEITY = 0.5;
/** Round-trip efficiency of the battery. */
export const BATTERY_EFFICIENCY = 0.9;
const DAYS = [31, 28.25, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function normalize(xs: number[]): number[] {
  const s = xs.reduce((a, b) => a + b, 0);
  return xs.map((x) => x / s);
}

/** Electricity covered by PV (kWh) in a month for a given consumption. */
export function pvCovered(pv: number, load: number, batteryKwh: number, days: number): number {
  if (pv <= 0 || load <= 0) return 0;
  const direct = SIMULTANEITY * Math.min(pv, load);
  const stored = Math.min((pv - direct) * BATTERY_EFFICIENCY, load - direct, Math.max(0, batteryKwh) * BATTERY_EFFICIENCY * days);
  return direct + Math.max(0, stored);
}

export interface PvModel {
  /** PV yield in calendar month index 0–11 (kWh). */
  yieldKWh(mo: number): number;
  /** PV electricity used by the heat pump in month index 0–11 with heat pump consumption `hpKWh` (kWh). */
  forHeatPump(mo: number, hpKWh: number): number;
}

export function createPvModel(inp: Inputs): PvModel {
  const hp = inp.heatPump;
  const annual = Math.max(0, hp.pvKwp) * Math.max(0, hp.pvYield);
  const house = Math.max(0, hp.householdKwh);
  const yieldKWh = (mo: number) => annual * PV_MONTH_SHARE[mo];
  return {
    yieldKWh,
    forHeatPump(mo, hpKWh) {
      const pv = yieldKWh(mo);
      if (pv <= 0 || hpKWh <= 0) return 0;
      const h = house * HOUSEHOLD_MONTH_SHARE[mo];
      const d = DAYS[mo];
      return Math.max(0, Math.min(hpKWh, pvCovered(pv, h + hpKWh, hp.batteryKwh, d) - pvCovered(pv, h, hp.batteryKwh, d)));
    },
  };
}

export interface PvMonth {
  month: number;
  pvKWh: number;
  hpKWh: number;
  /** Of which from PV. */
  hpFromPv: number;
}

export interface PvSummary {
  months: PvMonth[];
  annualPv: number;
  annualHp: number;
  annualHpFromPv: number;
  /** Share of heat pump electricity from PV over the year and in winter (Dec–Feb) / summer (Jun–Aug). */
  share: number;
  winterShare: number;
  summerShare: number;
}

/** PV coverage of the heat pump in a typical year (heat demand profile of the house) – for display (F28). */
export function pvSummary(inp: Inputs): PvSummary {
  const s = energySplit(inp);
  const pv = createPvModel(inp);
  const months: PvMonth[] = SPACE_PROFILE.map((sp, mo) => {
    const hpKWh = (s.spaceHeat * sp + s.dhwHeat * DHW_PROFILE[mo]) / inp.heatPump.jaz;
    return { month: mo + 1, pvKWh: pv.yieldKWh(mo), hpKWh, hpFromPv: pv.forHeatPump(mo, hpKWh) };
  });
  const sum = (f: (m: PvMonth) => number, idx?: number[]) => (idx ? idx.map((i) => months[i]) : months).reduce((a, m) => a + f(m), 0);
  const ratio = (idx?: number[]) => {
    const hpSum = sum((m) => m.hpKWh, idx);
    return hpSum > 0 ? sum((m) => m.hpFromPv, idx) / hpSum : 0;
  };
  return {
    months,
    annualPv: sum((m) => m.pvKWh),
    annualHp: sum((m) => m.hpKWh),
    annualHpFromPv: sum((m) => m.hpFromPv),
    share: ratio(),
    winterShare: ratio([11, 0, 1]),
    summerShare: ratio([5, 6, 7]),
  };
}
