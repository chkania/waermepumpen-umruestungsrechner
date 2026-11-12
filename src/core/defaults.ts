import { formatMonth, monthFromDate, parseMonth } from './dates';
import type { Inputs } from './types';

/**
 * Zentrale Default-Annahmen. Quellen und Stand siehe docs/ANFORDERUNGEN.md (Abschnitt 5/6).
 *
 * Förderung KfW 458 – Stand der KfW-Seite, abgerufen 2026-11-11:
 *  - Grundförderung 30 %; ab Q1/2027 für Wärmepumpen 15 % + 15 % Wertschöpfungs-Bonus bei EU-Ursprung (RL Nr. 8.4.1 c, 8.4.6)
 *  - Klimageschwindigkeitsbonus 16 %, ab 01.02.2027 halbjährlich −4 %-Punkte, ab Anträgen 01.08.2028 entfallen
 *  - Einkommensbonus 40/30/10 % bis 30/40/50 T€ zvE (mit Kind +10 T€), gültig seit 21.07.2026
 *  - Höchstsatz 70 % (80 % bei niedrigstem Einkommen)
 *  - förderfähige Kosten 28.000 € (1. WE), ab 01.02.2027 halbjährlich −750 € bis 22.000 € ab 08/2030; 2.–6. WE 15.000 €, ab 7. WE 8.000 €
 * KfW 358/359: bis 120.000 € je WE; 358 bis 90.000 € Haushaltseinkommen. Zinsen laut Sekundärquelle (hausvoraus.de, 10.11.2026).
 * Markt- und Preiswerte: recherchiert am 11.11.2026, Quellen je Feld in sources.ts.
 * § 35c EStG: 20 % (7/7/6), max. 40.000 €, Kosten max. 200.000 €, Abschluss bis Ende 2029.
 */
export const FUNDING_SOURCE_DATE = '2026-11-11';

export const HEAT_PROFILE: readonly number[] = [
  // Jan … Dez – Anteil am Jahreswärmebedarf (Raumwärme + Warmwasser), Summe = 1
  0.165, 0.145, 0.125, 0.08, 0.045, 0.025, 0.02, 0.02, 0.035, 0.075, 0.12, 0.145,
];

export function createDefaults(today: Date = new Date()): Inputs {
  const start = monthFromDate(today);
  return {
    version: 1,
    general: {
      startMonth: start,
      horizonYears: 20,
      opportunityRate: 0.02,
      costIncrease: 0.02,
      investIncrease: 0.02,
      residualValue: true,
      vat: 0.19,
    },
    building: {
      ownerOccupied: true,
      units: 1,
      buildingAgeYears: 40,
      householdIncome: 60000,
      hasChild: false,
      incomeTax: 0,
    },
    oldHeating: {
      fuel: 'gas',
      consumption: 20000,
      efficiency: 0.9,
      ageYears: 22,
      remainingLifeYears: 5,
      maintenance: 200,
      replacementCost: 12000,
      replacementEfficiency: 0.95,
      replacementLifeYears: 20,
    },
    prices: {
      gasPriceCt: 12.2,
      gasBaseFee: 150,
      gasIncrease: 0.03,
      oilPriceEur: 1.64,
      oilIncrease: 0.03,
      oilKwhPerLiter: 10,
      co2Path: '2026:55, 2027:65, 2028:80, 2030:110, 2035:160, 2040:200, 2045:220',
      gasCo2Factor: 0.201,
      oilCo2Factor: 0.266,
      bioEnabled: true,
      bioSteps: '2029:10, 2030:15, 2035:30, 2040:60',
      bioPremiumCt: 3,
    },
    heatPump: {
      investment: 32000,
      eligibleShare: 1,
      extraCost: 0,
      jaz: 3.3,
      maintenance: 150,
      lifeYears: 20,
      installMonth: formatMonth(parseMonth(start) + 6),
      leadMonths: 4,
      euOrigin: true,
      separateTariff: true,
      elecPriceCt: 24,
      householdPriceCt: 37,
      elecIncrease: 0.02,
      meterFee: 100,
      meterSetupCost: 0,
      meterSetupEligible: false,
      para14aReduction: 130,
      existing14aOnHousehold: false,
      pvShare: 0,
      feedInCt: 7.7,
    },
    financing: {
      kfwEquity: 10000,
      taxEquity: 10000,
      kfwRate358: 0.022,
      kfwRate359: 0.046,
      kfwTermYears: 20,
      kfwGraceYears: 1,
      kfwFixYears: 10,
      followUpRate: 0.04,
      useKfwLoan: true,
      subsidyAsSpecialRepayment: true,
      bankRate: 0.075,
      bankTermYears: 15,
      bankGraceYears: 0,
      subsidyDelayMonths: 3,
      taxRefundMonth: 6,
      windfallAmount: 0,
      windfallMonth: formatMonth(parseMonth(start) + 60),
      windfallTarget: 'auto',
      kfwMinPrepay: 5000,
      kfwFeeAfterFix: 0.01,
      bankPrepayFee: 0.01,
      bankPrepayFeeShort: 0.005,
    },
    funding: {
      grundRate: 0.3,
      grundRateNew: 0.15,
      grundRateNewFrom: '2027-01',
      wsbRate: 0.15,
      kgbRate: 0.16,
      kgbStep: 0.04,
      kgbDegressionStart: '2027-02',
      kgbEnd: '2028-08',
      kgbMinGasAge: 20,
      incomeLimit1: 30000,
      incomeRate1: 0.4,
      incomeLimit2: 40000,
      incomeRate2: 0.3,
      incomeLimit3: 50000,
      incomeRate3: 0.1,
      incomeChildShift: 10000,
      maxRate: 0.7,
      maxRateLowIncome: 0.8,
      cap1: 28000,
      capStep: 750,
      capFloor: 22000,
      capDegressionStart: '2027-02',
      cap2to6: 15000,
      cap7plus: 8000,
      loanMaxPerUnit: 120000,
      loan358IncomeLimit: 90000,
    },
    tax: {
      rateYear1: 0.07,
      rateYear2: 0.07,
      rateYear3: 0.06,
      maxBonus: 40000,
      maxCost: 200000,
      deadline: '2029-12',
      minBuildingAge: 10,
    },
    compare: {
      stepMonths: 6,
      count: 9,
    },
  };
}
