import { yearOf } from './dates';
import { simulate } from './simulation';
import type { Inputs, ScenarioResult } from './types';

export interface TariffYear {
  year: number;
  /** Strombezug der WP aus dem Netz (kWh, ohne PV-Anteil). */
  gridKWh: number;
  /** Stromkosten inkl. Grundpreis Zähler und § 14a-Reduzierung (€). */
  withTariff: number;
  withoutTariff: number;
}

export interface TariffComparison {
  years: TariffYear[];
  totalWith: number;
  totalWithout: number;
  /** Positiv = WP-Tarif günstiger. */
  saving: number;
  /** Erstes volles Betriebsjahr (oder erstes Jahr, falls keins voll ist). */
  firstFullYear: TariffYear | null;
  /** Netzbezug pro Jahr, ab dem sich der WP-Tarif bei den laufenden Kosten lohnt (Startpreise); null = nie. */
  breakEvenKWh: number | null;
  /** Einmalige Kosten zweiter Zähler (brutto, zum Kaufzeitpunkt). */
  setupCost: number;
  /** Zusätzlicher Zuschuss darauf (falls als förderfähig angesetzt und Höchstbetrag nicht ausgeschöpft). */
  setupSubsidy: number;
  /** Jahre, bis die laufende Ersparnis die Netto-Umbaukosten deckt; null = nie, 0 = keine Umbaukosten. */
  setupPaybackYears: number | null;
  /** Aktuell in den Eingaben gewählte Variante. */
  selected: 'with' | 'without';
  cheaper: 'with' | 'without';
}

/**
 * Vergleicht die Stromkosten der Wärmepumpe mit und ohne separaten Wärmepumpentarif (F13).
 * Gerechnet wird ab Inbetriebnahme bis zum Ende des Betrachtungszeitraums (nominal, ohne Opportunitätszins).
 * Einmalige Kosten für den zweiten Zähler (abzüglich eines etwaigen Zuschusses) gehen in die Summe „mit WP-Tarif“ ein.
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
      e.cost += r.energy + r.fixed;
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
  const breakEvenKWh = priceGap > 0 ? (hp.meterFee * 100) / priceGap : null;
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
