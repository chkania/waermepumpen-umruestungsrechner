import { parseMonth, yearOf } from './dates';
import type { Fuel, Inputs } from './types';

export interface PathPoint {
  year: number;
  value: number;
}

/** Parses "2026:55, 2027:65" → sorted support points. Invalid entries are ignored. */
export function parsePath(text: string): PathPoint[] {
  const points: PathPoint[] = [];
  for (const part of String(text ?? '').split(/[,;\n]+/)) {
    const m = /^\s*(\d{4})\s*:\s*(-?\d+(?:[.,]\d+)?)\s*$/.exec(part);
    if (!m) continue;
    points.push({ year: Number(m[1]), value: Number(m[2].replace(',', '.')) });
  }
  points.sort((a, b) => a.year - b.year);
  return points;
}

/** Linear interpolation; constant outside the support points. Empty path → 0. */
export function interpolate(points: PathPoint[], year: number): number {
  if (points.length === 0) return 0;
  if (year <= points[0].year) return points[0].value;
  const last = points[points.length - 1];
  if (year >= last.year) return last.value;
  for (let i = 1; i < points.length; i++) {
    const b = points[i];
    if (year <= b.year) {
      const a = points[i - 1];
      return a.value + ((b.value - a.value) * (year - a.year)) / (b.year - a.year);
    }
  }
  return last.value;
}

/** Step function: value of the last support point with year ≤ year, 0 before that. */
export function stepValue(points: PathPoint[], year: number): number {
  let v = 0;
  for (const p of points) if (p.year <= year) v = p.value;
  return v;
}

/**
 * Prepared price functions (all values gross, ct/kWh).
 * Price increases apply continuously from the start month ((1 + rate)^(months/12)), like maintenance and investment.
 * The CO₂ price follows the path per calendar year (set by law per year).
 */
export interface PriceModel {
  startYear: number;
  startMonth: number;
  co2Price(year: number): number;
  co2SurchargeCt(fuel: Fuel, year: number): number;
  /** Fuel price ct/kWh (final energy (Endenergie)) incl. CO2 in month `month` (absolute). */
  fuelCt(fuel: Fuel, month: number): number;
  /** Bio surcharge (Bio-Mehrkosten) ct/kWh for newly installed fossil boilers. */
  bioSurchargeCt(year: number): number;
  bioShare(year: number): number;
  /** Electricity price ct/kWh for the heat pump (heat pump tariff (Wärmepumpentarif) or household electricity (Haushaltsstrom)) in month `month`. */
  elecCt(month: number): number;
  /** Household electricity (Haushaltsstrom) price ct/kWh in month `month` (e.g. induction cooking). */
  householdCt(month: number): number;
  /** Electricity price growth factor in month `month` (1 in the start month). */
  elecGrowth(month: number): number;
  /** Gas standing charge (Grundpreis) €/year in month `month`. */
  gasBaseFee(month: number): number;
}

export function createPriceModel(inp: Inputs): PriceModel {
  const startMonth = parseMonth(inp.general.startMonth);
  const startYear = yearOf(startMonth);
  const co2 = parsePath(inp.prices.co2Path);
  const bio = parsePath(inp.prices.bioSteps);
  const vat = inp.general.vat;
  const p = inp.prices;
  const hp = inp.heatPump;

  const co2Price = (year: number) => interpolate(co2, year);
  const factor = (fuel: Fuel) => (fuel === 'gas' ? p.gasCo2Factor : p.oilCo2Factor);
  // €/t × kg/kWh = €/1000 kWh → /10 = ct/kWh
  const co2SurchargeCt = (fuel: Fuel, year: number) => ((co2Price(year) * factor(fuel)) / 10) * (1 + vat);

  const gasTotal0 = p.gasPriceCt;
  const oilTotal0 = (p.oilPriceEur * 100) / p.oilKwhPerLiter;
  const gasBase0 = gasTotal0 - co2SurchargeCt('gas', startYear);
  const oilBase0 = oilTotal0 - co2SurchargeCt('oil', startYear);

  const g = (rate: number, month: number) => Math.pow(1 + rate, Math.max(0, month - startMonth) / 12);

  return {
    startYear,
    startMonth,
    co2Price,
    co2SurchargeCt,
    fuelCt(fuel, month) {
      const base = fuel === 'gas' ? gasBase0 * g(p.gasIncrease, month) : oilBase0 * g(p.oilIncrease, month);
      return base + co2SurchargeCt(fuel, yearOf(month));
    },
    bioShare(year) {
      return p.bioEnabled ? stepValue(bio, year) / 100 : 0;
    },
    bioSurchargeCt(year) {
      return p.bioEnabled ? (stepValue(bio, year) / 100) * p.bioPremiumCt : 0;
    },
    elecCt(month) {
      const base = hp.separateTariff ? hp.elecPriceCt : hp.householdPriceCt;
      return base * g(hp.elecIncrease, month);
    },
    householdCt(month) {
      return hp.householdPriceCt * g(hp.elecIncrease, month);
    },
    elecGrowth(month) {
      return g(hp.elecIncrease, month);
    },
    gasBaseFee(month) {
      return p.gasBaseFee * g(p.gasIncrease, month);
    },
  };
}

/** Final energy (Endenergie) (kWh) from the consumption figure of the old system. */
export function fuelKWh(inp: Inputs): number {
  const o = inp.oldHeating;
  return o.fuel === 'gas' ? o.consumption : o.consumption * inp.prices.oilKwhPerLiter;
}

/**
 * Split of consumption (F17): cooking (gas, does not run through the boiler), hot water (Warmwasser) and space heating (Raumwärme).
 * Space heating and hot water are converted into useful heat (Nutzwärme) using the efficiency.
 */
export interface EnergySplit {
  /** Total final energy (Endenergie) consumption (kWh). */
  fuelTotal: number;
  /** Final energy (Endenergie) for cooking (kWh gas). */
  cookingFuel: number;
  /** Final energy (Endenergie) for heating (space heating (Raumwärme) + hot water (Warmwasser)), without cooking. */
  heatingFuel: number;
  /** Useful heat (Nutzwärme) for space heating (Raumwärme) (kWh). */
  spaceHeat: number;
  /** Useful heat (Nutzwärme) for hot water (Warmwasser) (kWh). */
  dhwHeat: number;
}

export function energySplit(inp: Inputs): EnergySplit {
  const o = inp.oldHeating;
  const fuelTotal = fuelKWh(inp);
  const cookShare = o.fuel === 'gas' && o.cookingWithGas ? Math.max(0, o.cookingShare) : 0;
  const dhwShare = o.dhwViaHeating ? Math.max(0, o.dhwShare) : 0;
  const cookingFuel = fuelTotal * cookShare;
  const heatingFuel = fuelTotal - cookingFuel;
  const dhwFuel = fuelTotal * Math.min(dhwShare, 1 - cookShare);
  return {
    fuelTotal,
    cookingFuel,
    heatingFuel,
    spaceHeat: (heatingFuel - dhwFuel) * o.efficiency,
    dhwHeat: dhwFuel * o.efficiency,
  };
}

/** Annual heat demand (Wärmebedarf) of the heating system (useful heat (Nutzwärme) for space heating (Raumwärme) + hot water (Warmwasser), without cooking, kWh). */
export function annualHeatDemand(inp: Inputs): number {
  const s = energySplit(inp);
  return s.spaceHeat + s.dhwHeat;
}
