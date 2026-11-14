import { yearOf } from './dates';
import { para14aFor, simulate } from './simulation';
import type { Inputs, ScenarioResult } from './types';

export interface TariffYear {
  year: number;
  /** Heat pump electricity drawn from the grid (kWh, without PV share). */
  gridKWh: number;
  /** Electricity costs incl. meter standing charge (Grundpreis) and § 14a reduction (€). */
  withTariff: number;
  withoutTariff: number;
}

export interface TariffComparison {
  years: TariffYear[];
  totalWith: number;
  totalWithout: number;
  /** Positive = heat pump tariff (Wärmepumpentarif) is cheaper. */
  saving: number;
  /** First full year of operation (or the first year if none is full). */
  firstFullYear: TariffYear | null;
  /**
   * Annual grid consumption from which the heat pump tariff (Wärmepumpentarif) pays off in running costs (start prices):
   * (meter standing charge (Grundpreis) − additional § 14a flat rate (Pauschale)) ÷ price advantage. 0 = at any consumption; null = never.
   */
  breakEvenKWh: number | null;
  /** One-off cost of the second meter (gross, at purchase time). */
  setupCost: number;
  /** Additional subsidy (Zuschuss) on it (if treated as eligible and the cap is not exhausted). */
  setupSubsidy: number;
  /** Years until the running savings cover the net conversion cost; null = never, 0 = no conversion cost. */
  setupPaybackYears: number | null;
  /** Variant currently selected in the inputs. */
  selected: 'with' | 'without';
  cheaper: 'with' | 'without';
}

/**
 * Compares the heat pump's electricity costs with and without a separate heat pump tariff (F13).
 * Calculated from commissioning (Inbetriebnahme) until the end of the analysis period (Betrachtungszeitraum) (nominal, without opportunity interest (Opportunitätszins)).
 * One-off costs for the second meter (less any subsidy (Zuschuss)) are included in the "with heat pump tariff (Wärmepumpentarif)" total.
 */
export function tariffComparison(inp: Inputs): TariffComparison | null {
  const variant = (separateTariff: boolean): Inputs => ({ ...inp, heatPump: { ...inp.heatPump, separateTariff } });
  const a = simulate(variant(true), 'kfw');
  const b = simulate(variant(false), 'kfw');
  if (a.installMonth === null) return null;
  const hp = inp.heatPump;
  const iIdx = a.installMonth - a.months[0].month;
  const setupCost = Math.max(0, hp.meterSetupCost) * Math.pow(1 + inp.general.investIncrease, iIdx / 12);
  const setupSubsidy = hp.meterSetupEligible ? Math.max(0, (a.kfw?.subsidy ?? 0) - (b.kfw?.subsidy ?? 0)) : 0;
  const setupNet = setupCost - setupSubsidy;

  const perYear = (s: ScenarioResult) => {
    const m = new Map<number, { cost: number; kwh: number; months: number }>();
    for (const r of s.months) {
      if (r.system !== 'wp') continue;
      const y = yearOf(r.month);
      const e = m.get(y) ?? { cost: 0, kwh: 0, months: 0 };
      // Cooking (gas or induction on the household meter (Haushaltszähler)) is not part of the heat pump electricity
      e.cost += r.energy + r.fixed - r.cookingCost;
      e.kwh += (r.heatKWh / inp.heatPump.jaz) * (1 - inp.heatPump.pvShare);
      e.months += 1;
      m.set(y, e);
    }
    return m;
  };
  const wa = perYear(a);
  const wb = perYear(b);
  const years: TariffYear[] = [...wa.keys()].map((year) => ({
    year,
    gridKWh: wa.get(year)!.kwh,
    withTariff: wa.get(year)!.cost,
    withoutTariff: wb.get(year)!.cost,
  }));
  const totalWith = years.reduce((s, y) => s + y.withTariff, 0) + setupNet;
  const totalWithout = years.reduce((s, y) => s + y.withoutTariff, 0);
  const fullYear = [...wa.entries()].find(([, v]) => v.months === 12)?.[0];
  const firstFullYear = years.find((y) => y.year === fullYear) ?? years[0] ?? null;

  const priceGap = hp.householdPriceCt - hp.elecPriceCt; // ct/kWh
  // Fixed extra cost of the own meter: standing charge (Grundpreis) minus an additional § 14a flat rate (Pauschale)
  // (only if the flat rate (Pauschale) on the household meter (Haushaltszähler) is already used for e.g. a wallbox, F13.6)
  const extra14a = para14aFor({ ...hp, separateTariff: true }) - para14aFor({ ...hp, separateTariff: false });
  const fixedGap = hp.meterFee - extra14a;
  const breakEvenKWh = priceGap > 0 ? (Math.max(0, fixedGap) * 100) / priceGap : fixedGap <= 0 && priceGap === 0 ? 0 : null;
  const annualSaving = firstFullYear ? firstFullYear.withoutTariff - firstFullYear.withTariff : 0;
  const setupPaybackYears = setupNet <= 0 ? 0 : annualSaving > 0 ? setupNet / annualSaving : null;

  return {
    years,
    totalWith,
    totalWithout,
    saving: totalWithout - totalWith,
    firstFullYear,
    breakEvenKWh,
    setupCost,
    setupSubsidy,
    setupPaybackYears,
    selected: hp.separateTariff ? 'with' : 'without',
    cheaper: totalWith <= totalWithout ? 'with' : 'without',
  };
}
