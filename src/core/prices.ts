import { parseMonth, yearOf } from './dates';
import type { Fuel, Inputs } from './types';

export interface PathPoint {
  year: number;
  value: number;
}

/** Parst "2026:55, 2027:65" → sortierte Stützstellen. Ungültige Einträge werden ignoriert. */
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

/** Linear interpoliert; außerhalb der Stützstellen konstant. Leerer Pfad → 0. */
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

/** Treppenfunktion: Wert der letzten Stützstelle mit year ≤ Jahr, davor 0. */
export function stepValue(points: PathPoint[], year: number): number {
  let v = 0;
  for (const p of points) if (p.year <= year) v = p.value;
  return v;
}

/**
 * Vorbereitete Preisfunktionen (alle Werte brutto, ct/kWh).
 * Preissteigerungen wirken stetig ab dem Startmonat ((1 + Rate)^(Monate/12)), wie Wartung und Investition.
 * Der CO₂-Preis folgt dem Pfad je Kalenderjahr (gesetzliche Festlegung je Jahr).
 */
export interface PriceModel {
  startYear: number;
  startMonth: number;
  co2Price(year: number): number;
  co2SurchargeCt(fuel: Fuel, year: number): number;
  /** Brennstoffpreis ct/kWh (Endenergie) inkl. CO2 im Monat `month` (absolut). */
  fuelCt(fuel: Fuel, month: number): number;
  /** Bio-Mehrkosten ct/kWh für neu eingebaute fossile Kessel. */
  bioSurchargeCt(year: number): number;
  bioShare(year: number): number;
  /** Strompreis ct/kWh für die WP (WP-Tarif oder Haushaltsstrom) im Monat `month`. */
  elecCt(month: number): number;
  /** Faktor der Strompreissteigerung im Monat `month` (1 im Startmonat). */
  elecGrowth(month: number): number;
  /** Gas-Grundpreis €/Jahr im Monat `month`. */
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
    elecGrowth(month) {
      return g(hp.elecIncrease, month);
    },
    gasBaseFee(month) {
      return p.gasBaseFee * g(p.gasIncrease, month);
    },
  };
}

/** Endenergie (kWh) aus Verbrauchsangabe der Altanlage. */
export function fuelKWh(inp: Inputs): number {
  const o = inp.oldHeating;
  return o.fuel === 'gas' ? o.consumption : o.consumption * inp.prices.oilKwhPerLiter;
}

/** Jahreswärmebedarf (Nutzwärme, kWh). */
export function annualHeatDemand(inp: Inputs): number {
  return fuelKWh(inp) * inp.oldHeating.efficiency;
}
