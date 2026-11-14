import { halfYearSteps, tryParseMonth } from './dates';
import type { Fuel, FundingParams, KfwResult } from './types';

export interface KfwRequest {
  /** Eligible gross costs (förderfähige Kosten) (€). */
  eligibleCost: number;
  /** Application month (Antragsmonat) (absolute index). */
  appMonth: number;
  fuel: Fuel;
  /** Age of the old system at the time of application (years). */
  oldHeatingAge: number;
  ownerOccupied: boolean;
  units: number;
  householdIncome: number;
  hasChild: boolean;
  /** Heat pump of EU origin (value-added bonus (Wertschöpfungs-Bonus), guideline (Richtlinie) no. 8.4.6). Default: true. */
  euOrigin?: boolean;
}

const round2 = (x: number) => Math.round(x * 100) / 100;

/** Base funding (Grundförderung) in the application month (Antragsmonat) (reduced for heat pumps from Q1/2027, guideline (Richtlinie) no. 8.4.1 c). */
export function grundRateAt(appMonth: number, p: FundingParams): number {
  const from = tryParseMonth(p.grundRateNewFrom);
  return from !== null && appMonth >= from ? p.grundRateNew : p.grundRate;
}

/** Value-added bonus (Wertschöpfungs-Bonus) for heat pumps of EU origin (guideline (Richtlinie) no. 8.4.6), applies from the same cut-off date (Stichtag). */
export function wsbRateAt(appMonth: number, euOrigin: boolean, p: FundingParams): number {
  const from = tryParseMonth(p.grundRateNewFrom);
  return euOrigin && from !== null && appMonth >= from ? p.wsbRate : 0;
}

/** Climate speed bonus (Klimageschwindigkeitsbonus) rate in the application month (Antragsmonat) (without eligibility check). */
export function kgbRateAt(appMonth: number, p: FundingParams): number {
  const end = tryParseMonth(p.kgbEnd);
  if (end !== null && appMonth >= end) return 0;
  const start = tryParseMonth(p.kgbDegressionStart);
  const steps = start === null ? 0 : halfYearSteps(appMonth, start);
  return Math.max(0, round4(p.kgbRate - steps * p.kgbStep));
}

const round4 = (x: number) => Math.round(x * 10000) / 10000;

/** Cap on eligible costs (Höchstbetrag förderfähiger Kosten) for the first dwelling unit (Wohneinheit) in the application month (Antragsmonat). */
export function cap1At(appMonth: number, p: FundingParams): number {
  const start = tryParseMonth(p.capDegressionStart);
  const steps = start === null ? 0 : halfYearSteps(appMonth, start);
  // Guideline (Richtlinie) no. 8.3.1 a: the reduction stops at the floor (from 1 August 2030: 22,000 €)
  return Math.max(Math.min(p.capFloor, p.cap1), p.cap1 - steps * p.capStep);
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

/** Calculates the KfW 458 subsidy (Zuschuss). */
export function kfwSubsidy(req: KfwRequest, p: FundingParams): KfwResult {
  const notes: string[] = [];
  const units = Math.max(1, Math.floor(req.units));
  const grund = grundRateAt(req.appMonth, p);
  const wsb = wsbRateAt(req.appMonth, req.euOrigin ?? true, p);
  const base = grund + wsb;
  if (grund < p.grundRate && wsb === 0) {
    notes.push(`Grundförderung nur ${Math.round(grund * 100)} %: kein Wertschöpfungs-Bonus (Wärmepumpe ohne EU-Ursprung).`);
  }

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
  const ownerUnitRate = req.ownerOccupied ? round4(Math.min(base + kgb + income, maxRate)) : base;
  if (req.ownerOccupied && base + kgb + income > maxRate) {
    notes.push(`Fördersatz auf Höchstsatz ${Math.round(maxRate * 100)} % begrenzt.`);
  }

  const capTotal = capTotalAt(req.appMonth, units, p);
  const eligibleCosts = Math.max(0, Math.min(req.eligibleCost, capTotal));
  if (req.eligibleCost > capTotal) {
    notes.push(`Förderfähige Kosten auf Höchstbetrag ${capTotal.toLocaleString('de-DE')} € begrenzt.`);
  }
  const ownerShare = eligibleCosts / units;
  const subsidy = req.ownerOccupied
    ? base * (eligibleCosts - ownerShare) + ownerUnitRate * ownerShare
    : base * eligibleCosts;

  return {
    eligible: base > 0 && eligibleCosts > 0,
    appMonth: req.appMonth,
    grundRate: grund,
    wsbRate: wsb,
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

/** KfW supplementary loan (Ergänzungskredit): 358 (interest-subsidised) or 359. */
export function kfwLoanVariant(
  ownerOccupied: boolean,
  units: number,
  householdIncome: number,
  p: FundingParams,
): '358' | '359' {
  return ownerOccupied && units <= 1 && householdIncome <= p.loan358IncomeLimit ? '358' : '359';
}
