import { halfYearSteps, tryParseMonth } from './dates';
import type { Fuel, FundingParams, KfwResult } from './types';

export interface KfwRequest {
  /** Förderfähige Bruttokosten (€). */
  eligibleCost: number;
  /** Antragsmonat (absoluter Index). */
  appMonth: number;
  fuel: Fuel;
  /** Alter der Altanlage zum Antragszeitpunkt (Jahre). */
  oldHeatingAge: number;
  ownerOccupied: boolean;
  units: number;
  householdIncome: number;
  hasChild: boolean;
}

const round2 = (x: number) => Math.round(x * 100) / 100;

export function grundRateAt(appMonth: number, p: FundingParams): number {
  const from = tryParseMonth(p.grundRateNewFrom);
  return from !== null && appMonth >= from ? p.grundRateNew : p.grundRate;
}

/** Klimageschwindigkeitsbonus-Satz zum Antragsmonat (ohne Berechtigungsprüfung). */
export function kgbRateAt(appMonth: number, p: FundingParams): number {
  const end = tryParseMonth(p.kgbEnd);
  if (end !== null && appMonth >= end) return 0;
  const start = tryParseMonth(p.kgbDegressionStart);
  const steps = start === null ? 0 : halfYearSteps(appMonth, start);
  return Math.max(0, round4(p.kgbRate - steps * p.kgbStep));
}

const round4 = (x: number) => Math.round(x * 10000) / 10000;

/** Höchstbetrag förderfähiger Kosten für die erste Wohneinheit zum Antragsmonat. */
export function cap1At(appMonth: number, p: FundingParams): number {
  const start = tryParseMonth(p.capDegressionStart);
  const steps = start === null ? 0 : halfYearSteps(appMonth, start);
  return Math.max(0, p.cap1 - steps * p.capStep);
}

export function capTotalAt(appMonth: number, units: number, p: FundingParams): number {
  const n = Math.max(1, Math.floor(units));
  return cap1At(appMonth, p) + Math.min(n - 1, 5) * p.cap2to6 + Math.max(n - 6, 0) * p.cap7plus;
}

export function incomeBonusRate(income: number, hasChild: boolean, p: FundingParams): number {
  const shift = hasChild ? p.incomeChildShift : 0;
  if (income <= p.incomeLimit1 + shift) return p.incomeRate1;
  if (income <= p.incomeLimit2 + shift) return p.incomeRate2;
  if (income <= p.incomeLimit3 + shift) return p.incomeRate3;
  return 0;
}

/** Berechnet den KfW-458-Zuschuss. */
export function kfwSubsidy(req: KfwRequest, p: FundingParams): KfwResult {
  const notes: string[] = [];
  const units = Math.max(1, Math.floor(req.units));
  const grund = grundRateAt(req.appMonth, p);

  let kgb = 0;
  if (req.ownerOccupied) {
    const oldEligible = req.fuel === 'oil' || req.oldHeatingAge >= p.kgbMinGasAge;
    const rate = kgbRateAt(req.appMonth, p);
    if (!oldEligible) {
      notes.push(`Kein Klimageschwindigkeitsbonus: Gasheizung jünger als ${p.kgbMinGasAge} Jahre.`);
    } else if (rate <= 0) {
      notes.push('Klimageschwindigkeitsbonus zum Antragszeitpunkt bereits ausgelaufen.');
    } else {
      kgb = rate;
    }
  } else {
    notes.push('Boni (Klimageschwindigkeit, Einkommen) nur bei Selbstnutzung.');
  }

  const income = req.ownerOccupied ? incomeBonusRate(req.householdIncome, req.hasChild, p) : 0;
  const maxRate = income > 0 && income >= p.incomeRate1 ? p.maxRateLowIncome : p.maxRate;
  const ownerUnitRate = req.ownerOccupied ? round4(Math.min(grund + kgb + income, maxRate)) : grund;
  if (req.ownerOccupied && grund + kgb + income > maxRate) {
    notes.push(`Fördersatz auf Höchstsatz ${Math.round(maxRate * 100)} % begrenzt.`);
  }

  const capTotal = capTotalAt(req.appMonth, units, p);
  const eligibleCosts = Math.max(0, Math.min(req.eligibleCost, capTotal));
  if (req.eligibleCost > capTotal) {
    notes.push(`Förderfähige Kosten auf Höchstbetrag ${capTotal.toLocaleString('de-DE')} € begrenzt.`);
  }
  const ownerShare = eligibleCosts / units;
  const subsidy = req.ownerOccupied
    ? grund * (eligibleCosts - ownerShare) + ownerUnitRate * ownerShare
    : grund * eligibleCosts;

  return {
    eligible: grund > 0 && eligibleCosts > 0,
    appMonth: req.appMonth,
    grundRate: grund,
    kgbRate: kgb,
    incomeRate: income,
    ownerUnitRate,
    maxRate,
    capTotal,
    eligibleCosts,
    subsidy: round2(subsidy),
    notes,
  };
}

/** KfW-Ergänzungskredit: 358 (zinsverbilligt) oder 359. */
export function kfwLoanVariant(
  ownerOccupied: boolean,
  units: number,
  householdIncome: number,
  p: FundingParams,
): '358' | '359' {
  return ownerOccupied && units <= 1 && householdIncome <= p.loan358IncomeLimit ? '358' : '359';
}
