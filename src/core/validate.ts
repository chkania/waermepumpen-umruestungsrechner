import { tryParseMonth } from './dates';

/**
 * Validation of inputs from link, file and browser storage (F9.5).
 * Protects against values that break the calculation (invalid months) or freeze the browser
 * (e.g. a term of 1,000,000 years). Invalid values are replaced by the default or the limit.
 */

export interface InputIssue {
  path: string;
  /** Short description, e.g. "auf 50 begrenzt". */
  reason: string;
}

/** Limits for numbers [min, max]. All other numbers: ±GENERIC_LIMIT. */
export const NUMBER_LIMITS: Record<string, [number, number]> = {
  'general.horizonYears': [1, 50],
  'general.opportunityRate': [-0.5, 1],
  'general.costIncrease': [-0.5, 1],
  'general.investIncrease': [-0.5, 1],
  'general.vat': [0, 1],
  'building.units': [1, 500],
  'building.constructionYear': [1500, 2100],
  'building.heatedArea': [10, 100000],
  'building.renovationYear': [0, 2100],
  'oldHeating.dhwShare': [0, 0.6],
  'oldHeating.cookingShare': [0, 0.3],
  'oldHeating.cookingSwitchCost': [0, 50000],
  'prices.cookingElecFactor': [0.1, 2],
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
  'heatPump.pvKwp': [0, 100],
  'heatPump.pvYield': [300, 1500],
  'heatPump.batteryKwh': [0, 100],
  'heatPump.householdKwh': [0, 100000],
  'prices.currentBioShare': [0, 1],
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
  // Expert funding/tax parameters: rates are fractions, amounts in €. Without these they would only be
  // clamped to ±1e9, which still allows nonsensical scenarios from a crafted link or import (F9.5).
  'funding.grundRate': [0, 1],
  'funding.grundRateNew': [0, 1],
  'funding.wsbRate': [0, 1],
  'funding.kgbRate': [0, 1],
  'funding.kgbStep': [0, 1],
  'funding.kgbMinGasAge': [0, 100],
  'funding.incomeLimit1': [0, 1e7],
  'funding.incomeRate1': [0, 1],
  'funding.incomeLimit2': [0, 1e7],
  'funding.incomeRate2': [0, 1],
  'funding.incomeLimit3': [0, 1e7],
  'funding.incomeRate3': [0, 1],
  'funding.incomeChildShift': [0, 1e7],
  'funding.maxRate': [0, 1],
  'funding.maxRateLowIncome': [0, 1],
  'funding.cap1': [0, 1e7],
  'funding.capStep': [0, 1e6],
  'funding.capFloor': [0, 1e7],
  'funding.cap2to6': [0, 1e7],
  'funding.cap7plus': [0, 1e7],
  'funding.loanMaxPerUnit': [0, 1e7],
  'funding.loan358IncomeLimit': [0, 1e7],
  'tax.rateYear1': [0, 1],
  'tax.rateYear2': [0, 1],
  'tax.rateYear3': [0, 1],
  'tax.maxBonus': [0, 1e6],
  'tax.maxCost': [0, 1e7],
  'tax.minBuildingAge': [0, 100],
  'compare.stepMonths': [1, 120],
  'compare.count': [1, 40],
};
export const GENERIC_LIMIT = 1e9;

/** Month fields; true = may be empty. */
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
  'oldHeating.cookingAfter': ['electric', 'gas'],
  'heatPump.source': ['air', 'ground'],
  'heatPump.emitter': ['floor', 'largeRadiators', 'radiators'],
  'building.renovationScope': ['partial', 'full'],
  'financing.windfallTarget': ['auto', 'kfw', 'bank'],
};

/** Maximum length for free text; other texts: 2,000 characters. */
export const TEXT_LIMITS: Record<string, number> = {
  'scenario.name': 200,
  'scenario.notes': 20000,
};
const GENERIC_TEXT_LIMIT = 2000;

const fmt = (x: number) => x.toLocaleString('de-DE');

export function numberRange(path: string): [number, number] {
  return NUMBER_LIMITS[path] ?? [-GENERIC_LIMIT, GENERIC_LIMIT];
}

/** Validates a month value (YYYY-MM, year 2000–2150). */
export function validMonth(path: string, v: string): boolean {
  if (v === '') return MONTH_FIELDS[path] === true;
  const m = tryParseMonth(v);
  if (m === null) return false;
  const y = Math.floor(m / 12);
  return y >= MONTH_YEARS[0] && y <= MONTH_YEARS[1];
}

/**
 * Validates a single value (type already matches). Returns the cleaned value and a finding if any.
 * `fallback` is the default for values that cannot be repaired.
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
