import { parsePath } from './prices';
import { runAll, type RunResult } from './simulation';
import type { Inputs } from './types';

/**
 * Sensitivity analysis (Sensitivitätsanalyse) (F27): "What influences my result most?"
 * Each key assumption is varied a little lower and higher while all others stay unchanged; the result is the
 * saving with a heat pump (best way KfW or tax bonus (Steuerbonus), recalculated per variant) compared with the base case.
 * Sorted by the width of the range – the widest bar influences the result most (tornado chart).
 */

export interface SensitivityItem {
  id: string;
  label: string;
  /** Base value of the assumption, formatted (e.g. "12,2 ct/kWh"). */
  base: string;
  /** Lower / higher value of the assumption, formatted. */
  lowValue: string;
  highValue: string;
  /** Saving with a heat pump with the lower / higher assumption (€). */
  low: number;
  high: number;
}

export interface Sensitivity {
  /** Saving with a heat pump in the base case (€). */
  base: number;
  /** Sorted by influence (largest range first). */
  items: SensitivityItem[];
}

interface Lever {
  id: string;
  label: string | ((i: Inputs) => string);
  /** Shown only if relevant for the base case. */
  show?: (run: RunResult) => boolean;
  value: (i: Inputs) => string;
  /** Applies the variation: dir = -1 (lower) or +1 (higher). */
  apply: (i: Inputs, dir: -1 | 1) => void;
}

const de = (x: number, d = 1) => x.toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d });
const pct = (x: number) => `${de(x * 100)} %`;
/** Relative variation for prices and investment. */
export const REL = 0.2;
/** Absolute variation for growth and interest rates (percentage points). */
export const PP = 0.02;
export const RATE_PP = 0.01;
export const JAZ_STEP = 0.5;
/** Relative variation of the CO2 price path. */
export const CO2_REL = 0.3;

const isGas = (i: Inputs) => i.oldHeating.fuel === 'gas';

const LEVERS: Lever[] = [
  {
    id: 'fuelPrice',
    label: (i) => (isGas(i) ? 'Gaspreis heute' : 'Heizölpreis heute'),
    value: (i) => (isGas(i) ? `${de(i.prices.gasPriceCt)} ct/kWh` : `${de(i.prices.oilPriceEur, 2)} €/l`),
    apply: (i, d) => {
      if (isGas(i)) i.prices.gasPriceCt *= 1 + d * REL;
      else i.prices.oilPriceEur *= 1 + d * REL;
    },
  },
  {
    id: 'fuelIncrease',
    label: (i) => (isGas(i) ? 'Steigerung Gaspreis' : 'Steigerung Heizölpreis'),
    value: (i) => `${pct(isGas(i) ? i.prices.gasIncrease : i.prices.oilIncrease)} p. a.`,
    apply: (i, d) => {
      if (isGas(i)) i.prices.gasIncrease += d * PP;
      else i.prices.oilIncrease += d * PP;
    },
  },
  {
    id: 'elecPrice',
    label: 'Strompreis heute',
    value: (i) => `${de(i.heatPump.separateTariff ? i.heatPump.elecPriceCt : i.heatPump.householdPriceCt)} ct/kWh`,
    apply: (i, d) => {
      i.heatPump.elecPriceCt *= 1 + d * REL;
      i.heatPump.householdPriceCt *= 1 + d * REL;
    },
  },
  {
    id: 'elecIncrease',
    label: 'Steigerung Strompreis',
    value: (i) => `${pct(i.heatPump.elecIncrease)} p. a.`,
    apply: (i, d) => (i.heatPump.elecIncrease += d * PP),
  },
  {
    id: 'jaz',
    label: 'Jahresarbeitszahl (JAZ)',
    value: (i) => de(i.heatPump.jaz),
    apply: (i, d) => (i.heatPump.jaz = Math.max(1, i.heatPump.jaz + d * JAZ_STEP)),
  },
  {
    id: 'investment',
    label: 'Investition Wärmepumpe',
    value: (i) => `${Math.round(i.heatPump.investment).toLocaleString('de-DE')} €`,
    apply: (i, d) => (i.heatPump.investment *= 1 + d * REL),
  },
  {
    id: 'co2Price',
    label: 'CO₂-Preis',
    value: (i) => {
      const p = parsePath(i.prices.co2Path);
      return p.length ? `${Math.round(p[p.length - 1].value)} €/t (${p[p.length - 1].year})` : '–';
    },
    apply: (i, d) => {
      i.prices.co2Path = parsePath(i.prices.co2Path)
        .map((p) => `${p.year}:${Math.round(p.value * (1 + d * CO2_REL) * 100) / 100}`)
        .join(', ');
    },
  },
  {
    id: 'loanRate',
    label: 'Kreditzinsen',
    // Only relevant if a loan is needed at all
    show: (run) => run.kfw.loans.length + run.tax.loans.length > 0,
    value: (i) => `KfW ${pct(i.financing.kfwRate358)}, Bank ${pct(i.financing.bankRate)}`,
    apply: (i, d) => {
      const f = i.financing;
      f.kfwRate358 = Math.max(0, f.kfwRate358 + d * RATE_PP);
      f.kfwRate359 = Math.max(0, f.kfwRate359 + d * RATE_PP);
      f.bankRate = Math.max(0, f.bankRate + d * RATE_PP);
      f.followUpRate = Math.max(0, f.followUpRate + d * RATE_PP);
    },
  },
  {
    id: 'opportunityRate',
    label: 'Opportunitätszins',
    value: (i) => `${pct(i.general.opportunityRate)} p. a.`,
    apply: (i, d) => (i.general.opportunityRate = Math.max(0, i.general.opportunityRate + d * RATE_PP)),
  },
];

/** Text of the variation per lever, e.g. "±20 %", for labels and the manual. */
export const VARIATION_TEXT: Record<string, string> = {
  fuelPrice: `±${REL * 100} %`,
  fuelIncrease: `±${PP * 100} Prozentpunkte`,
  elecPrice: `±${REL * 100} %`,
  elecIncrease: `±${PP * 100} Prozentpunkte`,
  jaz: `±${de(JAZ_STEP)}`,
  investment: `±${REL * 100} %`,
  co2Price: `±${CO2_REL * 100} %`,
  loanRate: `±${RATE_PP * 100} Prozentpunkt`,
  opportunityRate: `±${RATE_PP * 100} Prozentpunkt`,
};

/** Saving with a heat pump: reference minus the best heat pump way. */
export function savingOf(inp: Inputs, run: RunResult = runAll(inp)): number {
  const best = run.best === 'tax' ? run.tax : run.kfw;
  return run.ref.totalCost - best.totalCost;
}

export function sensitivity(inp: Inputs): Sensitivity {
  const baseRun = runAll(inp);
  const base = savingOf(inp, baseRun);
  const items: SensitivityItem[] = [];
  for (const l of LEVERS) {
    if (l.show && !l.show(baseRun)) continue;
    const variant = (dir: -1 | 1) => {
      const v = structuredClone(inp);
      l.apply(v, dir);
      return v;
    };
    const lo = variant(-1);
    const hi = variant(1);
    items.push({
      id: l.id,
      label: typeof l.label === 'string' ? l.label : l.label(inp),
      base: l.value(inp),
      lowValue: l.value(lo),
      highValue: l.value(hi),
      low: savingOf(lo),
      high: savingOf(hi),
    });
  }
  items.sort((a, b) => Math.abs(b.high - b.low) - Math.abs(a.high - a.low));
  return { base, items };
}
