import { describe, expect, it } from 'vitest';
import { formatMonth } from '../src/core/dates';
import { keyEvents, type KeyEvent } from '../src/core/events';
import { runAll } from '../src/core/simulation';
import type { Inputs } from '../src/core/types';
import { defaults } from './helpers';

/** Szenario aus der Nutzerfrage (Gasheizung 16 J., Restlebensdauer 5 J., Einkommen 120 T€). */
function userCase(mut?: (i: Inputs) => void): Inputs {
  const i = defaults();
  i.building.buildingAgeYears = 76;
  i.building.householdIncome = 120000;
  i.oldHeating.consumption = 11000;
  i.oldHeating.ageYears = 16;
  i.financing.kfwEquity = 4000;
  mut?.(i);
  return i;
}

const ev = (i: Inputs) => keyEvents(i, runAll(i));
const find = (list: KeyEvent[], re: RegExp) => list.find((e) => re.test(e.title));

describe('F10 Wichtige Ereignisse', () => {
  it('F10.1 Kauf des Ersatzkessels im Referenzszenario mit Betrag', () => {
    const { timeline } = ev(userCase());
    const e = find(timeline, /neuen Kessels/)!;
    expect(formatMonth(e.month!)).toBe('2031-11');
    expect(e.scenario).toBe('ref');
    expect(e.level).toBe('important');
    expect(e.amount).toBeCloseTo(12000 * 1.02 ** 5, 2);
  });

  it('F10.1 Bio-Treppe nur ab Kesselkauf, Stufe 2030 gilt ab Kauf', () => {
    const { timeline } = ev(userCase());
    const bio = timeline.filter((e) => /Bio-Treppe/.test(e.title));
    expect(bio.map((e) => [formatMonth(e.month!), e.title.match(/\d+ %/)![0]])).toEqual([
      ['2031-11', '15 %'],
      ['2035-01', '30 %'],
      ['2040-01', '60 %'],
    ]);
    expect(bio[0].perYear).toBe(true);
    expect(bio[0].amount).toBeCloseTo(((11000 * 0.9) / 0.95) * 0.15 * 0.04, 6);
  });

  it('F10.2 letzte Steuererstattung ist hervorgehoben', () => {
    const { timeline } = ev(userCase());
    const refunds = timeline.filter((e) => /Steuererstattung/.test(e.title));
    expect(refunds.map((e) => formatMonth(e.month!))).toEqual(['2028-06', '2029-06', '2030-06']);
    const last = refunds[2];
    expect(last.title).toMatch(/Letzte/);
    expect(last.level).toBe('important');
    expect(last.detail).toMatch(/Kreditraten laufen weiter/);
    expect(last.amount).toBeLessThan(0);
  });

  it('F10.3 Zuschuss, Inbetriebnahme, Antrag und Kreditereignisse', () => {
    const { timeline } = ev(userCase());
    expect(find(timeline, /Förderantrag/)!.month).toBe(find(timeline, /Inbetriebnahme/)!.month! - 4);
    expect(find(timeline, /Auszahlung KfW-Zuschuss/)!.amount).toBe(-8400);
    expect(find(timeline, /Zinsbindung endet/)).toBeDefined();
    expect(find(timeline, /Bankkredit vollständig getilgt/)).toBeDefined();
    // chronologisch sortiert
    const months = timeline.map((e) => e.month!);
    expect([...months].sort((a, b) => a - b)).toEqual(months);
  });

  it('F10.4 Klimageschwindigkeitsbonus nicht erreichbar (Heizung wird erst nach Auslaufen 20 J. alt)', () => {
    const { hints } = ev(userCase());
    const h = find(hints, /Klimageschwindigkeitsbonus/)!;
    expect(h.title).toMatch(/nicht erreichbar/);
    expect(h.level).toBe('warning');
    expect(h.detail).toMatch(/11\/2030/);
    expect(h.detail).toMatch(/08\/2028/);
  });

  it('F10.4 Klimageschwindigkeitsbonus erst später erreichbar', () => {
    const { hints } = ev(userCase((i) => (i.oldHeating.ageYears = 19)));
    const h = find(hints, /Klimageschwindigkeitsbonus/)!;
    expect(h.title).toBe('Klimageschwindigkeitsbonus erst bei Antrag ab 11/2027');
    expect(h.level).toBe('info');
    expect(h.detail).toMatch(/8 %/);
  });

  it('F10.4 Klimageschwindigkeitsbonus nicht erreichbar wegen Restlebensdauer', () => {
    const { hints } = ev(userCase((i) => {
      i.oldHeating.ageYears = 19;
      i.oldHeating.remainingLifeYears = 0.5;
    }));
    const h = find(hints, /Klimageschwindigkeitsbonus/)!;
    expect(h.title).toMatch(/nicht erreichbar/);
  });

  it('F10.4 Klimageschwindigkeitsbonus gesichert mit Hinweis auf nächste Absenkung', () => {
    const { hints } = ev(defaults());
    const h = find(hints, /Klimageschwindigkeitsbonus/)!;
    expect(h.level).toBe('important');
    expect(h.detail).toMatch(/16 %/);
    expect(h.detail).toMatch(/ab 02\/2027 nur noch 12 %/);
  });

  it('F10.4 weitere Hinweise: Einkommensbonus, Kreditvariante, Steuerfrist', () => {
    const { hints } = ev(userCase());
    expect(find(hints, /Kein Einkommensbonus/)).toBeDefined();
    expect(find(hints, /359 statt/)).toBeDefined();
    expect(find(hints, /Steuerbonus nur bei Abschluss bis 12\/2029/)).toBeDefined();
    const late = ev(userCase((i) => (i.heatPump.installMonth = '2030-06'))).hints;
    expect(find(late, /Steuerbonus nicht möglich/)!.level).toBe('warning');
  });

  it('F10.1 WP-Szenario: Ausfall der Altanlage vor Installation als Warnung', () => {
    const { timeline } = ev(userCase((i) => {
      i.oldHeating.remainingLifeYears = 0.25;
      i.heatPump.installMonth = '2027-11';
    }));
    const w = timeline.filter((e) => /fällt vor der Wärmepumpe aus/.test(e.title));
    expect(w.map((e) => e.scenario)).toEqual(['kfw', 'tax']);
    expect(w[0].level).toBe('warning');
  });
});
