/** Brennstoff der Bestandsheizung. */
export type Fuel = 'gas' | 'oil';

/** Monate werden als ISO-String "YYYY-MM" eingegeben und intern als absoluter Monatsindex (Jahr*12 + Monat-1) gerechnet. */
export type MonthString = string;

export interface GeneralInputs {
  startMonth: MonthString;
  horizonYears: number;
  /** Opportunitätszins p. a. als Anteil (0.02 = 2 %). */
  opportunityRate: number;
  /** Allgemeine Kostensteigerung (Wartung) p. a. */
  costIncrease: number;
  /** Steigerung der Investitionskosten (WP, Kessel) p. a. bis zum Kaufzeitpunkt. */
  investIncrease: number;
  residualValue: boolean;
  vat: number;
}

export interface BuildingInputs {
  ownerOccupied: boolean;
  units: number;
  buildingAgeYears: number;
  /** Zu versteuerndes Haushaltsjahreseinkommen (€). */
  householdIncome: number;
  hasChild: boolean;
  /** Jährliche Einkommensteuerschuld (€) als Obergrenze für § 35c; 0 = unbegrenzt. */
  incomeTax: number;
}

export interface OldHeatingInputs {
  fuel: Fuel;
  /** Gas: kWh/Jahr, Öl: Liter/Jahr. */
  consumption: number;
  efficiency: number;
  ageYears: number;
  remainingLifeYears: number;
  /** Wartung + Schornsteinfeger €/Jahr. */
  maintenance: number;
  replacementCost: number;
  replacementEfficiency: number;
  replacementLifeYears: number;
}

export interface PriceInputs {
  /** Aktueller Gaspreis ct/kWh brutto inkl. CO2. */
  gasPriceCt: number;
  gasBaseFee: number;
  gasIncrease: number;
  /** Aktueller Heizölpreis €/Liter brutto inkl. CO2. */
  oilPriceEur: number;
  oilIncrease: number;
  oilKwhPerLiter: number;
  /** CO2-Preispfad "Jahr:€/t, Jahr:€/t, …". */
  co2Path: string;
  gasCo2Factor: number;
  oilCo2Factor: number;
  bioEnabled: boolean;
  /** Bio-Treppe "Jahr:Anteil%, …". */
  bioSteps: string;
  bioPremiumCt: number;
}

export interface HeatPumpInputs {
  investment: number;
  eligibleShare: number;
  extraCost: number;
  jaz: number;
  maintenance: number;
  lifeYears: number;
  installMonth: MonthString;
  leadMonths: number;
  separateTariff: boolean;
  elecPriceCt: number;
  householdPriceCt: number;
  elecIncrease: number;
  meterFee: number;
  para14aReduction: number;
  pvShare: number;
  feedInCt: number;
}

export interface FinancingInputs {
  kfwEquity: number;
  taxEquity: number;
  kfwRate358: number;
  kfwRate359: number;
  kfwTermYears: number;
  kfwGraceYears: number;
  kfwFixYears: number;
  followUpRate: number;
  subsidyAsSpecialRepayment: boolean;
  bankRate: number;
  bankTermYears: number;
  bankGraceYears: number;
  subsidyDelayMonths: number;
  taxRefundMonth: number;
}

export interface FundingParams {
  grundRate: number;
  grundRateNew: number;
  /** Ab diesem Antragsmonat gilt grundRateNew; leer = nie. */
  grundRateNewFrom: MonthString;
  kgbRate: number;
  kgbStep: number;
  kgbDegressionStart: MonthString;
  kgbEnd: MonthString;
  kgbMinGasAge: number;
  incomeLimit1: number;
  incomeRate1: number;
  incomeLimit2: number;
  incomeRate2: number;
  incomeLimit3: number;
  incomeRate3: number;
  incomeChildShift: number;
  maxRate: number;
  maxRateLowIncome: number;
  cap1: number;
  capStep: number;
  capDegressionStart: MonthString;
  cap2to6: number;
  cap7plus: number;
  loanMaxPerUnit: number;
  loan358IncomeLimit: number;
}

export interface TaxParams {
  rateYear1: number;
  rateYear2: number;
  rateYear3: number;
  maxBonus: number;
  maxCost: number;
  /** Letzter zulässiger Abschlussmonat. */
  deadline: MonthString;
  minBuildingAge: number;
}

export interface CompareInputs {
  stepMonths: number;
  count: number;
}

export interface Inputs {
  version: 1;
  general: GeneralInputs;
  building: BuildingInputs;
  oldHeating: OldHeatingInputs;
  prices: PriceInputs;
  heatPump: HeatPumpInputs;
  financing: FinancingInputs;
  funding: FundingParams;
  tax: TaxParams;
  compare: CompareInputs;
}

export type ScenarioKind = 'ref' | 'kfw' | 'tax';

/** Kostenkategorien; positive Werte = Ausgaben, negative = Einnahmen. */
export interface CostBreakdown {
  energy: number;
  fixed: number;
  maintenance: number;
  investment: number;
  loanPayout: number;
  interest: number;
  principal: number;
  subsidy: number;
  taxBonus: number;
  residual: number;
  total: number;
}

export interface MonthRow extends CostBreakdown {
  month: number;
  heatKWh: number;
  /** 'old' | 'new' (Ersatzkessel) | 'wp' */
  system: 'old' | 'new' | 'wp';
}

export interface YearRow extends CostBreakdown {
  year: number;
  /** Kumulierte Kosten (inkl. Opportunitätszins) am Jahresende. */
  cumulative: number;
}

export interface KfwResult {
  eligible: boolean;
  appMonth: number;
  grundRate: number;
  kgbRate: number;
  incomeRate: number;
  /** Effektiver Fördersatz der selbstgenutzten WE (nach Höchstsatz). */
  ownerUnitRate: number;
  maxRate: number;
  capTotal: number;
  eligibleCosts: number;
  subsidy: number;
  notes: string[];
}

export interface TaxResult {
  eligible: boolean;
  completionYear: number;
  total: number;
  yearly: { year: number; amount: number }[];
  notes: string[];
}

export interface LoanInfo {
  name: string;
  principal: number;
  rate: number;
  totalInterest: number;
}

export interface ScenarioResult {
  kind: ScenarioKind;
  label: string;
  feasible: boolean;
  installMonth: number | null;
  months: MonthRow[];
  years: YearRow[];
  /** Kumulierte Kosten je Monatsende (inkl. Opportunitätszins). */
  cumulative: number[];
  totalCost: number;
  /** Summe ohne Verzinsung. */
  nominalCost: number;
  warnings: string[];
  kfw?: KfwResult;
  tax?: TaxResult;
  loans: LoanInfo[];
}
