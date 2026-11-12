import { tryParseMonth } from './dates';

/**
 * Prüfung von Eingaben aus Link, Datei und Browser-Speicher (F9.5).
 * Schützt vor Werten, die die Rechnung lahmlegen (ungültige Monate) oder den Browser einfrieren
 * (z. B. 1.000.000 Jahre Laufzeit). Ungültige Werte werden durch den Standardwert bzw. die Grenze ersetzt.
 */

export interface InputIssue {
  path: string;
  /** Kurzbeschreibung, z. B. „auf 50 begrenzt“. */
  reason: string;
}

/** Grenzen für Zahlen [min, max]. Alle übrigen Zahlen: ±GENERIC_LIMIT. */
export const NUMBER_LIMITS: Record<string, [number, number]> = {
  'general.horizonYears': [1, 50],
  'general.opportunityRate': [-0.5, 1],
  'general.costIncrease': [-0.5, 1],
  'general.investIncrease': [-0.5, 1],
  'general.vat': [0, 1],
  'building.units': [1, 500],
  'building.buildingAgeYears': [0, 1000],
  'oldHeating.consumption': [0, 1e7],
  'oldHeating.efficiency': [0.1, 1.5],
  'oldHeating.ageYears': [0, 200],
  'oldHeating.remainingLifeYears': [0, 100],
  'oldHeating.replacementEfficiency': [0.1, 1.5],
  'oldHeating.replacementLifeYears': [1, 100],
  'prices.gasIncrease': [-0.5, 1],
  'prices.oilIncrease': [-0.5, 1],
  'prices.oilKwhPerLiter': [1, 20],
  'heatPump.eligibleShare': [0, 1],
  'heatPump.jaz': [0.5, 10],
  'heatPump.lifeYears': [1, 100],
  'heatPump.leadMonths': [0, 120],
  'heatPump.elecIncrease': [-0.5, 1],
  'heatPump.pvShare': [0, 1],
  'financing.kfwRate358': [-0.1, 1],
  'financing.kfwRate359': [-0.1, 1],
  'financing.kfwTermYears': [1, 50],
  'financing.kfwGraceYears': [0, 50],
  'financing.kfwFixYears': [0, 50],
  'financing.followUpRate': [-0.1, 1],
  'financing.bankRate': [-0.1, 1],
  'financing.bankTermYears': [1, 50],
  'financing.bankGraceYears': [0, 50],
  'financing.subsidyDelayMonths': [0, 120],
  'financing.taxRefundMonth': [1, 12],
  'financing.kfwFeeAfterFix': [0, 1],
  'financing.bankPrepayFee': [0, 1],
  'financing.bankPrepayFeeShort': [0, 1],
  'compare.stepMonths': [1, 120],
  'compare.count': [1, 40],
};
export const GENERIC_LIMIT = 1e9;

/** Monatsfelder; true = darf leer sein. */
export const MONTH_FIELDS: Record<string, boolean> = {
  'general.startMonth': false,
  'heatPump.installMonth': false,
  'financing.windfallMonth': false,
  'financing.windfallRepayMonth': true,
  'tax.deadline': false,
  'funding.grundRateNewFrom': true,
  'funding.kgbDegressionStart': true,
  'funding.kgbEnd': true,
  'funding.capDegressionStart': true,
};
const MONTH_YEARS: [number, number] = [2000, 2150];

export const SELECT_VALUES: Record<string, readonly string[]> = {
  'oldHeating.fuel': ['gas', 'oil'],
  'financing.windfallTarget': ['auto', 'kfw', 'bank'],
};

/** Höchstlänge für Freitext; übrige Texte: 2.000 Zeichen. */
export const TEXT_LIMITS: Record<string, number> = {
  'scenario.name': 200,
  'scenario.notes': 20000,
};
const GENERIC_TEXT_LIMIT = 2000;

const fmt = (x: number) => x.toLocaleString('de-DE');

export function numberRange(path: string): [number, number] {
  return NUMBER_LIMITS[path] ?? [-GENERIC_LIMIT, GENERIC_LIMIT];
}

/** Prüft einen Monatswert (JJJJ-MM, Jahr 2000–2150). */
export function validMonth(path: string, v: string): boolean {
  if (v === '') return MONTH_FIELDS[path] === true;
  const m = tryParseMonth(v);
  if (m === null) return false;
  const y = Math.floor(m / 12);
  return y >= MONTH_YEARS[0] && y <= MONTH_YEARS[1];
}

/**
 * Prüft einen einzelnen Wert (Typ ist bereits passend). Liefert den bereinigten Wert und ggf. einen Befund.
 * `fallback` ist der Standardwert für nicht reparierbare Werte.
 */
export function checkValue(path: string, value: unknown, fallback: unknown): { value: unknown; issue?: InputIssue } {
  if (typeof value === 'number') {
    const [min, max] = numberRange(path);
    if (value < min) return { value: min, issue: { path, reason: `${fmt(value)} unter dem Mindestwert, auf ${fmt(min)} gesetzt` } };
    if (value > max) return { value: max, issue: { path, reason: `${fmt(value)} über dem Höchstwert, auf ${fmt(max)} begrenzt` } };
    return { value };
  }
  if (typeof value === 'string') {
    if (path in MONTH_FIELDS) {
      const v = value.trim();
      return validMonth(path, v) ? { value: v } : { value: fallback, issue: { path, reason: 'kein gültiger Monat, Standardwert verwendet' } };
    }
    const allowed = SELECT_VALUES[path];
    if (allowed) {
      return allowed.includes(value) ? { value } : { value: fallback, issue: { path, reason: 'unbekannter Wert, Standardwert verwendet' } };
    }
    const max = TEXT_LIMITS[path] ?? GENERIC_TEXT_LIMIT;
    if (value.length > max) return { value: value.slice(0, max), issue: { path, reason: `auf ${fmt(max)} Zeichen gekürzt` } };
    return { value };
  }
  return { value };
}
