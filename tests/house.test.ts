import { describe, expect, it } from 'vitest';
import { parseMonth } from '../src/core/dates';
import { DHW_PROFILE, HEAT_PROFILE, SPACE_PROFILE } from '../src/core/defaults';
import { efficiencyClass, rateHouse } from '../src/core/house';
import { energySplit } from '../src/core/prices';
import { importJson, mergeInputs } from '../src/core/serialize';
import { runAll, simulate } from '../src/core/simulation';
import { cookingSwitchSaving, keyEvents } from '../src/core/events';
import { tariffComparison } from '../src/core/tariff';
import type { Inputs } from '../src/core/types';
import { defaults, neutral } from './helpers';

const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);
/** Heat pump from the start, old system lasts, constant prices: 26 ct heat pump, 34 ct household, gas 11.5 ct, standing charge (Grundpreis) 180 €. */
const wp = (mut?: (i: Inputs) => void) =>
  neutral((i) => {
    i.oldHeating.remainingLifeYears = 100;
    i.heatPump.installMonth = '2026-11';
    i.financing.kfwEquity = 1e6;
    mut?.(i);
  });
const year2027 = (i: Inputs, kind: 'ref' | 'kfw') => simulate(i, kind).years.find((y) => y.year === 2027)!;

describe('F17 Aufteilung Raumwärme / Warmwasser / Kochen', () => {
  it('Profile summieren sich zu 1; 85 % Raumwärme + 15 % Warmwasser ≈ bisheriges Profil', () => {
    expect(sum(SPACE_PROFILE)).toBeCloseTo(1, 6);
    expect(sum(DHW_PROFILE)).toBeCloseTo(1, 6);
    SPACE_PROFILE.forEach((s, m) => expect(0.85 * s + 0.15 * DHW_PROFILE[m]).toBeCloseTo(HEAT_PROFILE[m], 3));
  });

  it('Kochen läuft nicht über den Kessel; Warmwasser-Anteil vom Gesamtverbrauch', () => {
    const i = defaults();
    i.oldHeating.cookingWithGas = true; // 3 % of 20,000 = 600 kWh
    const s = energySplit(i);
    expect(s.cookingFuel).toBeCloseTo(600, 6);
    expect(s.heatingFuel).toBeCloseTo(19400, 6);
    expect(s.dhwHeat).toBeCloseTo(3000 * 0.9, 6);
    expect(s.spaceHeat).toBeCloseTo(16400 * 0.9, 6);
    // Oil: no cooking
    i.oldHeating.fuel = 'oil';
    i.oldHeating.consumption = 2000;
    expect(energySplit(i).cookingFuel).toBe(0);
  });

  it('ohne Warmwasser über die Heizung: im Sommer kaum Heizkosten', () => {
    const jul = (i: Inputs) => simulate(i, 'kfw').months.find((m) => m.month === parseMonth('2027-07'))!.energy;
    expect(jul(wp((i) => (i.oldHeating.dhwViaHeating = false)))).toBeLessThan(jul(wp()) * 0.6);
  });

  it('Referenz: Gesamtverbrauch unverändert, Kochen zum Gaspreis ohne Kesselverlust', () => {
    const base = year2027(wp(), 'ref').energy; // 20,000 kWh × 11.5 ct
    expect(base).toBeCloseTo(2300, 6);
    expect(year2027(wp((i) => (i.oldHeating.cookingWithGas = true)), 'ref').energy).toBeCloseTo(2300, 6);
  });

  it('WP: Kochen mit Induktion zum Haushaltsstrom, Gasanschluss entfällt', () => {
    const plain = year2027(wp(), 'kfw');
    const ind = year2027(wp((i) => (i.oldHeating.cookingWithGas = true)), 'kfw');
    // Heating: 19,400 instead of 20,000 kWh fuel; cooking: 600 × 0.55 × 34 ct
    const heatShare = 19400 / 20000;
    expect(ind.energy).toBeCloseTo(plain.energy * heatShare + 600 * 0.55 * 0.34, 4);
    expect(ind.fixed).toBeCloseTo(plain.fixed, 6);
  });

  it('WP: Kochen weiter mit Gas → Gas-Grundpreis bleibt', () => {
    const plain = year2027(wp(), 'kfw');
    const gas = year2027(wp((i) => {
      i.oldHeating.cookingWithGas = true;
      i.oldHeating.cookingAfter = 'gas';
    }), 'kfw');
    expect(gas.fixed).toBeCloseTo(plain.fixed + 180, 6);
    expect(gas.energy).toBeCloseTo(plain.energy * (19400 / 20000) + 600 * 0.115, 4);
  });

  it('Tarifvergleich ohne Kochkosten', () => {
    const t = tariffComparison(wp((i) => {
      i.oldHeating.cookingWithGas = true;
      i.oldHeating.cookingAfter = 'gas';
    }))!;
    const plain = tariffComparison(wp())!;
    expect(t.firstFullYear!.withTariff).toBeCloseTo(plain.firstFullYear!.withTariff * 1 - (plain.firstFullYear!.gridKWh - t.firstFullYear!.gridKWh) * 0.26, 4);
  });

  it('Steuerbonus: Gebäudealter aus dem Baujahr', () => {
    const t = simulate(wp((i) => (i.building.constructionYear = 2020)), 'tax');
    expect(t.feasible).toBe(false);
    expect(t.tax!.notes.join()).toMatch(/10 Jahre/);
    expect(simulate(wp((i) => (i.building.constructionYear = 2016)), 'tax').feasible).toBe(true);
  });
});

describe('F17.1 Übernahme älterer Datenstände', () => {
  it('Gebäudealter → Baujahr (Startjahr − Alter)', () => {
    const old = { version: 1, general: { startMonth: '2026-11' }, building: { buildingAgeYears: 76 } };
    expect(importJson(defaults(), JSON.stringify(old)).building.constructionYear).toBe(1950);
    expect(mergeInputs(defaults(), { building: { buildingAgeYears: 10, constructionYear: 1999 } }).building.constructionYear).toBe(1999);
  });
});

describe('F18 Einordnung des Hauses', () => {
  it('Effizienzklassen nach GEG Anlage 10', () => {
    expect([29, 30, 49, 74, 99, 129, 159, 199, 249, 250].map(efficiencyClass)).toEqual(['A+', 'A', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']);
  });

  it('Default: 20.000 kWh auf 140 m², Baujahr 1986 → ~143 kWh/m², Klasse E, typisch', () => {
    const h = rateHouse(defaults());
    expect(h.kwhPerM2).toBeCloseTo(20000 / 140, 6);
    expect(h.efficiencyClass).toBe('E');
    expect(h.ageClass.range).toEqual([120, 170]);
    expect(h.renovation.state).toBe('unsaniert');
    expect(h.comparison).toBe('typical');
    expect(h.heatLoadKW).toBeCloseTo(18000 / 2000, 6);
    expect(h.wpSuitability.level).toBe('ok'); // Space heating (Raumwärme) 15,300 kWh / 140 m² ≈ 109
  });

  it('Sanierung senkt die Erwartung; Kochen zählt nicht zum Kennwert', () => {
    const i = defaults();
    i.building.renovationYear = 2015;
    i.building.renovationScope = 'full';
    const h = rateHouse(i);
    expect(h.renovation.state).toBe('umfassend saniert');
    expect(h.expected).toEqual([48, 102]); // 120 × 0.4 … 170 × 0.6
    i.oldHeating.cookingWithGas = true;
    expect(rateHouse(i).kwhPerM2).toBeCloseTo(19400 / 140, 6);
  });

  it('schlechter als erwartet bzw. Eignung prüfen', () => {
    const h = rateHouse(neutral((i) => {
      i.building.constructionYear = 2005;
      i.oldHeating.consumption = 30000;
    }));
    expect(h.comparison).toBe('worse');
    expect(h.wpSuitability.level).toBe('check');
  });
});

describe('F17.3/F17.4 Kochfeld und Umstiegs-Hinweis', () => {
  const cooking = (after: 'gas' | 'electric', mut?: (i: Inputs) => void) =>
    wp((i) => {
      i.oldHeating.cookingWithGas = true;
      i.oldHeating.cookingAfter = after;
      mut?.(i);
    });

  it('Kochfeld-Investition nur beim Umstieg auf Strom, im Installationsmonat, ohne Kredit', () => {
    const el = simulate(cooking('electric'), 'kfw');
    const gas = simulate(cooking('gas'), 'kfw');
    expect(el.months[0].investment - gas.months[0].investment).toBeCloseTo(800, 6);
    expect(el.loans).toEqual(gas.loans);
    expect(simulate(cooking('electric', (i) => (i.oldHeating.cookingSwitchCost = 0)), 'kfw').months[0].investment).toBeCloseTo(gas.months[0].investment, 6);
  });

  it('Hinweis zeigt die Ersparnis durch Induktion (gleich der Differenz der Gesamtkosten)', () => {
    const i = cooking('gas');
    const run = runAll(i);
    const alt = runAll(cooking('electric'));
    const best = (r: typeof run) => (r.best === 'tax' ? r.tax.totalCost : r.kfw.totalCost);
    const saving = cookingSwitchSaving(i, run)!;
    expect(saving).toBeCloseTo(best(run) - best(alt), 6);
    expect(saving).toBeGreaterThan(0); // 180 € standing charge (Grundpreis) per year no longer applies
    const h = keyEvents(i, run).hints.find((x) => /Kochen mit Strom statt Gas spart/.test(x.title))!;
    expect(h.level).toBe('important');
    expect(h.detail).toMatch(/Grundpreis 180 €/);
    // no notice if induction is already selected or there is no gas cooker (Gasherd)
    expect(cookingSwitchSaving(cooking('electric'))).toBeNull();
    expect(cookingSwitchSaving(wp())).toBeNull();
  });

  it('teures Kochfeld: Hinweis nennt Mehrkosten', () => {
    const i = cooking('gas', (x) => (x.oldHeating.cookingSwitchCost = 20000));
    const h = keyEvents(i, runAll(i)).hints.find((x) => /Kochen mit Strom statt Gas/.test(x.title))!;
    expect(h.title).toMatch(/mehr kosten/);
    expect(h.level).toBe('info');
  });
});
