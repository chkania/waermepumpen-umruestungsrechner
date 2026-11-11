import { describe, expect, it } from 'vitest';
import { decodeHash, diffInputs, encodeHash, exportJson, importJson, mergeInputs } from '../src/core/serialize';
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
