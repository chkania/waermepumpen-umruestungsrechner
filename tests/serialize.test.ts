import { describe, expect, it } from 'vitest';
import { decodeHash, diffInputs, encodeHash, exportFileName, exportJson, fileSlug, importJson, mergeInputs } from '../src/core/serialize';
import { defaults } from './helpers';

describe('F9 Persistenz', () => {
  it('Link: nur Abweichungen, Roundtrip inkl. Umlaute', () => {
    const d = defaults();
    const i = defaults();
    i.oldHeating.fuel = 'oil';
    i.prices.co2Path = '2026:55, 2030:150 ÄÖÜ';
    i.heatPump.jaz = 3.8;
    expect(diffInputs(d, i)).toEqual({
      oldHeating: { fuel: 'oil' },
      prices: { co2Path: '2026:55, 2030:150 ÄÖÜ' },
      heatPump: { jaz: 3.8 },
    });
    const hash = encodeHash(d, i);
    expect(hash).toMatch(/^#s=[A-Za-z0-9_-]+$/);
    expect(decodeHash(d, hash)).toEqual(i);
  });

  it('ungültiger Hash → null', () => {
    const d = defaults();
    expect(decodeHash(d, '')).toBeNull();
    expect(decodeHash(d, '#s=%%%')).toBeNull();
    expect(decodeHash(d, '#s=bm9wZQ')).toBeNull(); // "nope"
  });

  it('Merge: unbekannte Felder ignoriert, falsche Typen → Default, fehlende → Default', () => {
    const d = defaults();
    const m = mergeInputs(d, {
      foo: 1,
      heatPump: { jaz: 'viel', investment: 25000, unknown: true },
      building: { ownerOccupied: 'ja' },
      general: { horizonYears: Number.NaN },
    });
    expect(m.heatPump.jaz).toBe(d.heatPump.jaz);
    expect(m.heatPump.investment).toBe(25000);
    expect(m.building.ownerOccupied).toBe(true);
    expect(m.general.horizonYears).toBe(20);
    expect((m as unknown as Record<string, unknown>).foo).toBeUndefined();
  });

  it('JSON Export/Import Roundtrip und Fehler', () => {
    const d = defaults();
    const i = defaults();
    i.building.units = 3;
    expect(importJson(d, exportJson(i))).toEqual(i);
    expect(() => importJson(d, '{kaputt')).toThrow(/JSON/);
    expect(() => importJson(d, '{"version":2}')).toThrow(/version/);
  });
});

describe('F28 früherer fester PV-Anteil', () => {
  it('wird ignoriert, mit Hinweis auf die Leistung der PV-Anlage', () => {
    const issues: { path: string; reason: string }[] = [];
    const i = mergeInputs(defaults(), { heatPump: { pvShare: 0.25 } }, issues);
    expect(i.heatPump.pvKwp).toBe(0);
    expect(issues).toEqual([{ path: 'heatPump.pvKwp', reason: expect.stringContaining('feste PV-Anteil (25 %)') }]);
    const none: unknown[] = [];
    mergeInputs(defaults(), { heatPump: { pvShare: 0 } }, none as never);
    expect(none).toEqual([]);
  });
});

describe('F16 Szenario-Beschreibung', () => {
  const now = new Date(2026, 10, 12);

  it('Export-Dateiname mit Bezeichnung, Umlaute umgeschrieben', () => {
    const i = defaults();
    expect(exportFileName(i, now)).toBe('waermepumpe-rechner-2026-11.json');
    i.scenario.name = '  Angebot Müller / Herbst 2027 – 12 kW!  ';
    expect(exportFileName(i, now)).toBe('waermepumpe-rechner-Angebot-Mueller-Herbst-2027-12-kW-2026-11.json');
    expect(fileSlug('Größe Öl Straße')).toBe('Groesse-Oel-Strasse');
    expect(fileSlug('Café')).toBe('Cafe');
    expect(fileSlug('???')).toBe('');
    expect(fileSlug('x'.repeat(100))).toHaveLength(60);
  });

  it('Bezeichnung und Bemerkungen im Export und Link, ältere Dateien ohne Felder importierbar', () => {
    const d = defaults();
    const i = defaults();
    i.scenario.name = 'Variante B';
    i.scenario.notes = 'Zeile 1\nZeile 2 – äöü';
    expect(importJson(d, exportJson(i)).scenario).toEqual(i.scenario);
    expect(decodeHash(d, encodeHash(d, i))!.scenario).toEqual(i.scenario);
    const old = JSON.parse(exportJson(defaults()));
    delete old.scenario;
    expect(importJson(d, JSON.stringify(old)).scenario).toEqual({ name: '', notes: '' });
  });
});
