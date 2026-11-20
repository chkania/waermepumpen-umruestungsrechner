import { describe, expect, it } from 'vitest';
import { DEFAULT_CHANGES, outdatedDefaults } from '../src/core/default-history';
import { INCOME_RANGES } from '../src/core/income-range';
import { decodeHash, diffInputs, encodeHash, exportJson, importJson, mergeInputs } from '../src/core/serialize';
import { checkValue, SELECT_VALUES, type InputIssue } from '../src/core/validate';
import { defaults } from './helpers';

const PATH = 'building.incomeRange';
const DEFAULT = '50001-60000';

/** Merges a raw data set and returns the resulting code and the findings for the income path. */
function load(data: unknown) {
  const issues: InputIssue[] = [];
  const i = mergeInputs(defaults(), data, issues);
  return { code: i.building.incomeRange, issues: issues.filter((x) => x.path === PATH) };
}

describe('F9.5 Altwert householdIncome (Zahl) → Bereichscode', () => {
  it.each([
    [45000, '40001-50000'],
    [0, '0-30000'],
    [120000, '90001+'],
    [30000, '0-30000'],
    [30000.5, '30001-40000'],
    [90000.5, '90001+'],
  ])('F9.5 Altwert %s → %s ohne Meldung', (old, code) => {
    expect(load({ building: { householdIncome: old } })).toEqual({ code, issues: [] });
  });

  it('F9.5 Altwert −5.000 ergibt 0-30000 mit Meldung „unter 0, dem ersten Bereich zugeordnet“', () => {
    expect(load({ building: { householdIncome: -5000 } })).toEqual({
      code: '0-30000',
      issues: [{ path: PATH, reason: 'unter 0, dem ersten Bereich zugeordnet' }],
    });
  });

  it('F9.5 Text „abc“ ergibt den Standard mit „ungültiger Wert, Standardwert verwendet“', () => {
    expect(load({ building: { householdIncome: 'abc' } })).toEqual({
      code: DEFAULT,
      issues: [{ path: PATH, reason: 'ungültiger Wert, Standardwert verwendet' }],
    });
  });

  it.each([null, true, {}, [], Infinity, NaN])('F9.5 keine endliche Zahl (%s) ergibt den Standard mit Meldung', (old) => {
    expect(load({ building: { householdIncome: old } })).toEqual({
      code: DEFAULT,
      issues: [{ path: PATH, reason: 'ungültiger Wert, Standardwert verwendet' }],
    });
  });

  it('F9.5 Ohne Altwert gilt der Standard ohne Meldung', () => {
    expect(load({})).toEqual({ code: DEFAULT, issues: [] });
    expect(load({ building: { hasChild: true } })).toEqual({ code: DEFAULT, issues: [] });
  });

  it('F9.5 incomeRange hat Vorrang, householdIncome wird ignoriert', () => {
    expect(load({ building: { householdIncome: 20000, incomeRange: '90001+' } })).toEqual({ code: '90001+', issues: [] });
  });

  it('F9.5 Ein Code, der kein Text ist, ergibt den Standard mit „ungültiger Wert, Standardwert verwendet“', () => {
    expect(load({ building: { incomeRange: 5 } })).toEqual({
      code: DEFAULT,
      issues: [{ path: PATH, reason: 'ungültiger Wert, Standardwert verwendet' }],
    });
  });

  it('F9.5 Ein unbekannter Code („foo“) ergibt den Standard mit „unbekannter Wert, Standardwert verwendet“', () => {
    expect(load({ building: { incomeRange: 'foo' } })).toEqual({
      code: DEFAULT,
      issues: [{ path: PATH, reason: 'unbekannter Wert, Standardwert verwendet' }],
    });
  });

  it('F9.5 Auswahlprüfung: gültige Codes bleiben, unbekannte fallen auf den Standard', () => {
    expect(SELECT_VALUES[PATH]).toEqual(INCOME_RANGES.map((r) => r.code));
    expect(checkValue(PATH, '60001-90000', DEFAULT)).toEqual({ value: '60001-90000' });
    expect(checkValue(PATH, 'foo', DEFAULT).value).toBe(DEFAULT);
  });
});

describe('F22.4 Hinweis „Neue Standardwerte“ betrifft das Einkommensfeld nie', () => {
  it('F22.4 DEFAULT_CHANGES bleibt ohne Einkommensfeld; alte und neue Daten zeigen keinen Hinweis dafür', () => {
    expect(JSON.stringify(DEFAULT_CHANGES)).not.toContain('incomeRange');
    expect(JSON.stringify(DEFAULT_CHANGES)).not.toContain('householdIncome');
    const old = mergeInputs(defaults(), { building: { householdIncome: 45000 } });
    const neu = mergeInputs(defaults(), { building: { incomeRange: '90001+' } });
    expect(JSON.stringify(outdatedDefaults(old, defaults(), '2000-01-01'))).not.toContain('incomeRange');
    expect(JSON.stringify(outdatedDefaults(neu, defaults(), '2000-01-01'))).not.toContain('incomeRange');
  });
});

describe('F9.5 Ladewege durchlaufen die Migration', () => {
  it('F9.5 Datei (importJson) mit altem Einkommen wird in den Bereich übernommen', () => {
    const json = JSON.stringify({ version: 1, building: { householdIncome: 45000 } });
    expect(importJson(defaults(), json).building.incomeRange).toBe('40001-50000');
  });

  it('F9.5 Link „#s=“ mit altem Einkommen wird in den Bereich übernommen', () => {
    const old = '#s=' + Buffer.from(JSON.stringify({ building: { householdIncome: 45000 } })).toString('base64url');
    expect(decodeHash(defaults(), old)?.building.incomeRange).toBe('40001-50000');
  });

  it('F9.5 Speicher (JSON-Zeichenkette) mit altem Einkommen wird in den Bereich übernommen', () => {
    const stored = JSON.stringify({ building: { householdIncome: 45000 } });
    expect(mergeInputs(defaults(), JSON.parse(stored)).building.incomeRange).toBe('40001-50000');
  });
});

describe('F9.5 Export, Import und Link mit Bereichscode', () => {
  it('F9.5 Export enthält building.incomeRange und kein building.householdIncome; Re-Import liefert denselben Code', () => {
    const i = defaults();
    i.building.incomeRange = '90001+';
    const text = exportJson(i);
    const parsed = JSON.parse(text);
    expect(parsed.building.incomeRange).toBe('90001+');
    expect(parsed.building).not.toHaveProperty('householdIncome');
    expect(importJson(defaults(), text).building.incomeRange).toBe('90001+');
  });

  it('F9.5 Link mit Standardbereich enthält das Feld nicht; abweichender Bereich bleibt im Link', () => {
    const d = defaults();
    expect(diffInputs(d, defaults())).toEqual({});
    const i = defaults();
    i.building.incomeRange = '60001-90000';
    expect(diffInputs(d, i)).toEqual({ building: { incomeRange: '60001-90000' } });
    expect(decodeHash(d, encodeHash(d, i))?.building.incomeRange).toBe('60001-90000');
  });

  it('F9.5 Dateiversion bleibt 1', () => {
    expect(JSON.parse(exportJson(defaults())).version).toBe(1);
  });
});
