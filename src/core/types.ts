import type { ExtraResult } from './loan';

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
  /** Wärmepumpe mit Ursprung in der EU (Wertschöpfungs-Bonus). */
  euOrigin: boolean;
  separateTariff: boolean;
  elecPriceCt: number;
  householdPriceCt: number;
  elecIncrease: number;
  meterFee: number;
  /** Einmalige Kosten für den zweiten Zähler (Zählerschrank-Umbau), nur mit separatem WP-Tarif. */
  meterSetupCost: number;
  /** Zählerschrank-Umbau als förderfähig anerkannt (vom Fachbetrieb zu bestätigen). */
  meterSetupEligible: boolean;
  para14aReduction: number;
  /** Am Haushaltszähler hängt bereits eine steuerbare Verbrauchseinrichtung mit § 14a (z. B. Wallbox). */
  existing14aOnHousehold: boolean;
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
  /** KfW-Ergänzungskredit 358/359 beantragen; false = Fremdfinanzierung nur über den Bankkredit. */
  useKfwLoan: boolean;
  subsidyAsSpecialRepayment: boolean;
  bankRate: number;
  bankTermYears: number;
  bankGraceYears: number;
  subsidyDelayMonths: number;
  taxRefundMonth: number;
  /** Einmalzahlung in der Zukunft (z. B. Lebensversicherung) für Sondertilgungen; 0 = keine. */
  windfallAmount: number;
  windfallMonth: MonthString;
  /** Monat der Sondertilgung (JJJJ-MM); leer = sofort bei Verfügbarkeit. */
  windfallRepayMonth: string;
  /** Welcher Kredit zuerst: 'auto' = höchster Zins zuerst. */
  windfallTarget: 'auto' | 'kfw' | 'bank';
  /** KfW: Mindestbetrag Sondertilgung innerhalb der ersten Zinsbindung. */
  kfwMinPrepay: number;
  /** KfW: Vorfälligkeitsentschädigung nach Ende der Zinsbindung (Anteil, Annahme). */
  kfwFeeAfterFix: number;
  /** Bank: Vorfälligkeitsentschädigung (§ 502 BGB max. 1 %). */
  bankPrepayFee: number;
  /** Bank: Vorfälligkeitsentschädigung bei Restlaufzeit ≤ 1 Jahr (§ 502 BGB max. 0,5 %). */
  bankPrepayFeeShort: number;
}

export interface FundingParams {
  grundRate: number;
  /** Grundförderung für Wärmepumpen ab grundRateNewFrom (Richtlinie Nr. 8.4.1 c: 15 %). */
  grundRateNew: number;
  /** Ab diesem Antragsmonat gelten grundRateNew und der Wertschöpfungs-Bonus; leer = nie. */
  grundRateNewFrom: MonthString;
  /** Wertschöpfungs-Bonus für Wärmepumpen mit EU-Ursprung (Richtlinie Nr. 8.4.6). */
  wsbRate: number;
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
  /** Untergrenze nach Ende der Degression (ab 08/2030: 22.000 €). */
  capFloor: number;
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

/** Beschreibung des Szenarios (F16) – ohne Einfluss auf die Rechnung. */
export interface ScenarioInfo {
  /** Bezeichnung, z. B. „Variante Herbst 2027“; fließt in den Export-Dateinamen ein. */
  name: string;
  /** Freitext: Beschreibung, Annahmen, Angebote … */
  notes: string;
}

export interface Inputs {
  version: 1;
  scenario: ScenarioInfo;
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
  /** Vorfälligkeitsentschädigungen. */
  fees: number;
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
  wsbRate: number;
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
  startMonth: number;
  /** Erste Tilgungsrate (nach tilgungsfreier Zeit); null ohne Anlaufzeit. */
  repaymentStartMonth: number | null;
  /** Ende der Zinsbindung, falls vor Tilgungsende; danach gilt followUpRate. */
  fixEndMonth: number | null;
  followUpRate: number;
  /** Monat der letzten Rate, falls im Betrachtungszeitraum. */
  payoffMonth: number | null;
  /** Restschuld am Ende des Zeitraums (als Ablösung eingerechnet). */
  balanceAtEnd: number;
  /** Ergebnisse der Sondertilgungen (Zuschuss, Einmalzahlung). */
  extras: ExtraResult[];
  totalFees: number;
}

export interface WindfallAttempt {
  loan: string;
  applied: number;
  fee: number;
  status: 'applied' | 'partial' | 'rejected';
  reason?: string;
  paidOff: boolean;
}

export interface WindfallInfo {
  /** Monat der Sondertilgung. */
  month: number;
  /** Monat, ab dem das Geld verfügbar ist. */
  availableMonth: number;
  /** Ersparte Kreditzinsen im Betrachtungszeitraum durch die Sondertilgung. */
  interestSaved: number;
  /** Vorfälligkeitsentschädigungen der Sondertilgung. */
  fees: number;
  amount: number;
  used: number;
  unused: number;
  attempts: WindfallAttempt[];
  /** Hinweis, warum nichts eingesetzt wurde (z. B. außerhalb des Zeitraums, kein Kredit). */
  note?: string;
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
  /** Käufe von Ersatzkesseln (Monat, Bruttokosten). */
  boilerPurchases: { month: number; cost: number }[];
  /** Ersatz-Wärmepumpen nach Ablauf der Lebensdauer (Monat, Kosten brutto). */
  hpReplacements: { month: number; cost: number }[];
  windfall?: WindfallInfo;
}
