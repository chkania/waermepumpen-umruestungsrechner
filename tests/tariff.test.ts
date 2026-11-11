import { describe, expect, it } from 'vitest';
import { simulate } from '../src/core/simulation';
import { tariffComparison } from '../src/core/tariff';
import { neutral } from './helpers';

// neutral: WP-Tarif 26 ct, Haushalt 34 ct, Zähler 100 €, § 14a 130 €, JAZ 3,3, Wärme 18.000 kWh, keine Steigerung
const base = (mut?: Parameters<typeof neutral>[0]) =>
  neutral((i) => {
    i.oldHeating.remainingLifeYears = 100;
    i.heatPump.installMonth = '2026-11';
    mut?.(i);
  });

describe('F13 Stromkosten mit/ohne Wärmepumpentarif', () => {
  const kwh = 18000 / 3.3;

  it('Jahreskosten beider Varianten inkl. Zähler und § 14a', () => {
    const t = tariffComparison(base())!;
    const y = t.firstFullYear!;
    expect(y.year).toBe(2027);
    expect(y.gridKWh).toBeCloseTo(kwh, 6);
    expect(y.withTariff).toBeCloseTo(kwh * 0.26 + 100 - 130, 6);
    expect(y.withoutTariff).toBeCloseTo(kwh * 0.34 - 130, 6);
    expect(t.cheaper).toBe('with');
    expect(t.saving).toBeCloseTo(20 * (kwh * 0.08 - 100), 4);
    expect(t.totalWith).toBeCloseTo(20 * (kwh * 0.26 - 30), 4);
  });

  it('Schwelle: Zählergrundpreis ÷ Preisvorteil', () => {
    expect(tariffComparison(base())!.breakEvenKWh).toBeCloseTo(1250, 6);
    const none = tariffComparison(base((i) => (i.heatPump.householdPriceCt = 26)))!;
    expect(none.breakEvenKWh).toBeNull();
    expect(none.cheaper).toBe('without');
  });

  it('kleiner Verbrauch: Haushaltsstrom günstiger', () => {
    const t = tariffComparison(base((i) => (i.oldHeating.consumption = 3000)))!; // ≈ 818 kWh WP-Strom
    expect(t.firstFullYear!.gridKWh).toBeLessThan(1250);
    expect(t.cheaper).toBe('without');
    expect(t.saving).toBeLessThan(0);
  });

  it('PV-Anteil senkt den Netzbezug in beiden Varianten', () => {
    const t = tariffComparison(base((i) => (i.heatPump.pvShare = 0.25)))!;
    expect(t.firstFullYear!.gridKWh).toBeCloseTo(kwh * 0.75, 6);
  });

  it('nur ab Inbetriebnahme; gewählte Variante wird gemeldet', () => {
    const t = tariffComparison(base((i) => {
      i.heatPump.installMonth = '2028-03';
      i.heatPump.separateTariff = false;
    }))!;
    expect(t.years[0].year).toBe(2028);
    expect(t.firstFullYear!.year).toBe(2029);
    expect(t.selected).toBe('without');
  });

  it('keine Inbetriebnahme im Zeitraum → null', () => {
    expect(tariffComparison(base((i) => (i.heatPump.installMonth = '2050-01')))).toBeNull();
  });

  it('F13.5 Zählerschrank-Umbau: einmalig in „mit WP-Tarif“, Amortisation', () => {
    const t = tariffComparison(base((i) => (i.heatPump.meterSetupCost = 1500)))!;
    expect(t.setupCost).toBe(1500); // Inbetriebnahme sofort, keine Preissteigerung
    expect(t.setupSubsidy).toBe(0);
    const annual = kwh * 0.08 - 100;
    expect(t.setupPaybackYears).toBeCloseTo(1500 / annual, 6);
    expect(t.saving).toBeCloseTo(20 * annual - 1500, 4);
    // ohne Preisvorteil amortisiert sich der Umbau nie
    expect(tariffComparison(base((i) => {
      i.heatPump.meterSetupCost = 1500;
      i.heatPump.householdPriceCt = 26;
    }))!.setupPaybackYears).toBeNull();
    expect(tariffComparison(base())!.setupPaybackYears).toBe(0);
  });

  it('F13.5 förderfähiger Umbau: Zuschuss nur, solange Höchstbetrag nicht ausgeschöpft', () => {
    const under = tariffComparison(base((i) => {
      i.heatPump.investment = 20000;
      i.heatPump.meterSetupCost = 1500;
      i.heatPump.meterSetupEligible = true;
    }))!;
    expect(under.setupSubsidy).toBeCloseTo(1500 * 0.46, 6); // 30 % + 16 % Klimageschwindigkeitsbonus
    const capped = tariffComparison(base((i) => {
      i.heatPump.meterSetupCost = 1500;
      i.heatPump.meterSetupEligible = true;
    }))!; // 32.000 € > 28.000 € Höchstbetrag
    expect(capped.setupSubsidy).toBe(0);
  });
});

describe('F13.5 Zählerschrank-Umbau in der Hauptrechnung', () => {
  it('nur mit separatem WP-Tarif; nicht förderfähig → Nebenkosten (Bankkredit)', () => {
    const mk = (sep: boolean, eligible = false) =>
      simulate(base((i) => {
        i.heatPump.separateTariff = sep;
        i.heatPump.meterSetupCost = 1500;
        i.heatPump.meterSetupEligible = eligible;
        i.heatPump.investment = 20000;
        i.financing.kfwEquity = 0;
      }), 'kfw');
    expect(mk(true).months[0].investment).toBe(21500);
    expect(mk(false).months[0].investment).toBe(20000);
    expect(mk(true).loans.find((l) => l.name === 'Bankkredit')!.principal).toBeCloseTo(1500, 6);
    expect(mk(true).kfw!.subsidy).toBe(9200);
    expect(mk(true, true).kfw!.subsidy).toBeCloseTo(9200 + 690, 6);
    expect(mk(true, true).loans.map((l) => l.name)).toEqual(['KfW-Kredit 358']);
  });
});

describe('F13.6 § 14a je Zähler (Wallbox am Haushaltszähler)', () => {
  const kwh = 18000 / 3.3;
  it('ohne WP-Tarif keine zusätzliche Pauschale, mit eigenem WP-Zähler schon', () => {
    const t = tariffComparison(base((i) => (i.heatPump.existing14aOnHousehold = true)))!;
    const y = t.firstFullYear!;
    expect(y.withoutTariff).toBeCloseTo(kwh * 0.34, 6); // keine −130 €
    expect(y.withTariff).toBeCloseTo(kwh * 0.26 + 100 - 130, 6);
    expect(t.saving).toBeCloseTo(20 * (kwh * 0.08 - 100 + 130), 4);
  });

  it('wirkt in der Hauptrechnung nur ohne separaten WP-Tarif', () => {
    const mk = (sep: boolean, wallbox: boolean) =>
      simulate(base((i) => {
        i.heatPump.separateTariff = sep;
        i.heatPump.existing14aOnHousehold = wallbox;
      }), 'kfw').years.find((y) => y.year === 2027)!.fixed;
    expect(mk(false, false)).toBeCloseTo(-130, 6);
    expect(mk(false, true)).toBeCloseTo(0, 6);
    expect(mk(true, true)).toBeCloseTo(100 - 130, 6);
  });
});

