import { formatMonthDe, halfYearSteps, parseMonth, tryParseMonth, yearOf } from './dates';
import { cap1At, incomeBonusRate, kfwLoanVariant, kgbRateAt } from './funding';
import { annualHeatDemand, createPriceModel, parsePath } from './prices';
import type { RunResult } from './simulation';
import type { Inputs, ScenarioResult } from './types';

export type EventScenario = 'ref' | 'kfw' | 'tax' | 'all';
/** info = Orientierung, important = großer Zahlungsfluss / Wendepunkt, warning = Nachteil, der leicht übersehen wird. */
export type EventLevel = 'info' | 'important' | 'warning';

export interface KeyEvent {
  /** Absoluter Monat; null = zeitunabhängiger Hinweis. */
  month: number | null;
  scenario: EventScenario;
  level: EventLevel;
  title: string;
  detail?: string;
  /** Betrag in € (positiv = Ausgabe, negativ = Einnahme). */
  amount?: number;
  /** Optional: Betrag pro Jahr statt einmalig. */
  perYear?: boolean;
}

export interface KeyEvents {
  /** Zeitunabhängige Hinweise zu Förderung/Steuer/Kredit. */
  hints: KeyEvent[];
  /** Datierte Ereignisse, chronologisch. */
  timeline: KeyEvent[];
}

const eur = (x: number) => `${Math.round(x).toLocaleString('de-DE')} €`;
const pct = (x: number) => `${Math.round(x * 100)} %`;
const M = formatMonthDe;

/** Ermittelt die wichtigen Ereignisse und Hinweise (F10). */
export function keyEvents(inp: Inputs, run: RunResult): KeyEvents {
  const hints: KeyEvent[] = [];
  const timeline: KeyEvent[] = [];
  const start = parseMonth(inp.general.startMonth);
  const end = start + Math.round(inp.general.horizonYears * 12);
  const o = inp.oldHeating;

  // ---------- Referenz: Ersatzkessel + Bio-Treppe ----------
  for (const b of run.ref.boilerPurchases) {
    timeline.push({
      month: b.month,
      scenario: 'ref',
      level: 'important',
      title: 'Kauf eines neuen Kessels',
      detail: `Die Restlebensdauer der Altanlage (${fmtYears(o.remainingLifeYears)}) ist erreicht. Ersatzkessel ${eur(o.replacementCost)} zu heutigen Preisen, mit Preissteigerung ${pct(inp.general.investIncrease)} p. a.`,
      amount: b.cost,
    });
  }
  const firstBoiler = run.ref.boilerPurchases[0];
  if (firstBoiler && inp.prices.bioEnabled) {
    const pm = createPriceModel(inp);
    const fuelNew = annualHeatDemand(inp) / o.replacementEfficiency;
    const steps = parsePath(inp.prices.bioSteps).filter((st) => st.value > 0);
    // Stufen vor dem Kesselkauf zählen nur, wenn sie beim Kauf noch die gültige sind
    const relevant = steps.filter(
      (st, i) => st.year * 12 >= firstBoiler.month || !(steps[i + 1] && steps[i + 1].year * 12 <= firstBoiler.month),
    );
    for (const step of relevant) {
      const month = Math.max(step.year * 12, firstBoiler.month);
      if (month >= end) continue;
      timeline.push({
        month,
        scenario: 'ref',
        level: 'info',
        title: `Bio-Treppe: ${step.value} % Bio-Anteil für den neuen Kessel`,
        detail: 'Gebäudemodernisierungsgesetz – Mehrkosten für Biogas/Bioöl gegenüber fossilem Brennstoff.',
        amount: (fuelNew * pm.bioSurchargeCt(yearOf(month))) / 100,
        perYear: true,
      });
    }
  }

  // ---------- Wärmepumpe ----------
  const kfw = run.kfw;
  const tax = run.tax;
  const install = kfw.installMonth;
  for (const s of [kfw, tax]) {
    for (const b of s.boilerPurchases) {
      timeline.push({
        month: b.month,
        scenario: s.kind,
        level: 'warning',
        title: 'Altanlage fällt vor der Wärmepumpe aus',
        detail: 'Bis zur Inbetriebnahme der Wärmepumpe wäre ein Ersatzkessel nötig. Früher umrüsten vermeidet diese Doppelinvestition.',
        amount: b.cost,
      });
    }
  }
  if (install !== null) {
    const invest = kfw.months[install - start].investment - sumBoiler(kfw, install);
    timeline.push({
      month: install,
      scenario: 'all',
      level: 'important',
      title: 'Inbetriebnahme der Wärmepumpe',
      detail: 'Investition inkl. Preissteigerung bis zum Kaufzeitpunkt; Gasanschluss/Öltank und Wartung der Altanlage entfallen.',
      amount: invest,
    });
  }

  if (kfw.kfw && install !== null) {
    const k = kfw.kfw;
    if (k.appMonth >= start) {
      timeline.push({
        month: k.appMonth,
        scenario: 'kfw',
        level: 'info',
        title: 'Förderantrag KfW 458 stellen',
        detail: 'Vor Vorhabenbeginn, mit Liefer-/Leistungsvertrag mit aufschiebender oder auflösender Bedingung. Maßgeblich für Boni und Höchstbeträge ist das Antragsdatum.',
      });
    }
    const payout = install + Math.max(0, Math.round(inp.financing.subsidyDelayMonths));
    if (payout < end && k.subsidy > 0) {
      timeline.push({
        month: payout,
        scenario: 'kfw',
        level: 'important',
        title: 'Auszahlung KfW-Zuschuss',
        detail: inp.financing.subsidyAsSpecialRepayment && kfw.loans.length
          ? 'Wird als Sondertilgung für den KfW-Kredit verwendet.'
          : undefined,
        amount: -k.subsidy,
      });
    }
  }
  addLoanEvents(timeline, kfw, 'kfw');
  addLoanEvents(timeline, tax, 'tax');

  if (tax.tax?.eligible) {
    const refundMonth = Math.min(12, Math.max(1, Math.round(inp.financing.taxRefundMonth)));
    const refunds = tax.tax.yearly.filter((y) => y.amount > 0);
    refunds.forEach((y, i) => {
      const month = (y.year + 1) * 12 + (refundMonth - 1);
      if (month >= end) return;
      const last = i === refunds.length - 1;
      timeline.push({
        month,
        scenario: 'tax',
        level: last ? 'important' : 'info',
        title: last ? 'Letzte Steuererstattung (§ 35c)' : `Steuererstattung für ${y.year}`,
        detail: last
          ? `Für das Steuerjahr ${y.year}. Danach entfällt die Entlastung${tax.loans.length ? ' – die Kreditraten laufen weiter' : ''}.`
          : `Für das Steuerjahr ${y.year}.`,
        amount: -y.amount,
      });
    });
  }

  // ---------- Hinweise ----------
  if (install !== null) hints.push(...fundingHints(inp, run, start));

  timeline.sort((a, b) => a.month! - b.month! || order(a) - order(b));
  return { hints, timeline };
}

function order(e: KeyEvent): number {
  return { all: 0, ref: 1, kfw: 2, tax: 3 }[e.scenario];
}

function sumBoiler(s: ScenarioResult, month: number): number {
  return s.boilerPurchases.filter((b) => b.month === month).reduce((a, b) => a + b.cost, 0);
}

function addLoanEvents(timeline: KeyEvent[], s: ScenarioResult, scenario: 'kfw' | 'tax'): void {
  const end = s.months.length ? s.months[s.months.length - 1].month : 0;
  for (const l of s.loans) {
    if (l.repaymentStartMonth !== null && l.repaymentStartMonth <= end) {
      timeline.push({
        month: l.repaymentStartMonth,
        scenario,
        level: 'info',
        title: `${l.name}: Tilgung beginnt`,
        detail: 'Ende der tilgungsfreien Anlaufzeit – ab jetzt volle Annuitätenrate.',
      });
    }
    if (l.fixEndMonth !== null && l.fixEndMonth <= end) {
      timeline.push({
        month: l.fixEndMonth,
        scenario,
        level: 'important',
        title: `${l.name}: Zinsbindung endet`,
        detail: `Restschuld wird mit dem angenommenen Anschlusszins von ${(l.followUpRate * 100).toLocaleString('de-DE')} % weitergeführt (vorher ${(l.rate * 100).toLocaleString('de-DE')} %).`,
      });
    }
    if (l.payoffMonth !== null) {
      timeline.push({ month: l.payoffMonth, scenario, level: 'info', title: `${l.name} vollständig getilgt` });
    } else if (l.balanceAtEnd > 0) {
      timeline.push({
        month: end,
        scenario,
        level: 'warning',
        title: `${l.name}: Restschuld am Ende des Zeitraums`,
        detail: 'Als Ablösung eingerechnet.',
        amount: l.balanceAtEnd,
      });
    }
  }
}

function fundingHints(inp: Inputs, run: RunResult, start: number): KeyEvent[] {
  const out: KeyEvent[] = [];
  const p = inp.funding;
  const b = inp.building;
  const k = run.kfw.kfw;
  if (!k) return out;
  const app = k.appMonth;
  const kgbEnd = tryParseMonth(p.kgbEnd);
  const kgbStart = tryParseMonth(p.kgbDegressionStart);
  const ownerShare = k.eligibleCosts / Math.max(1, Math.floor(b.units));

  // Klimageschwindigkeitsbonus
  if (!b.ownerOccupied) {
    out.push(hint('warning', 'Kein Klimageschwindigkeits- und Einkommensbonus', 'Beide Boni gibt es nur für selbstgenutztes Wohneigentum.'));
  } else if (k.kgbRate > 0) {
    let detail = `${pct(k.kgbRate)} ≈ ${eur(k.kgbRate * ownerShare)} bei Antrag ${M(app)}.`;
    if (kgbStart !== null) {
      const next = kgbStart + 6 * halfYearSteps(app, kgbStart);
      const nextRate = kgbRateAt(next, p);
      if (kgbEnd === null || next < kgbEnd) {
        detail += ` Bei Antrag ab ${M(next)} nur noch ${pct(nextRate)}`;
      } else {
        detail += ` Bei Antrag ab ${M(kgbEnd)} entfällt der Bonus`;
      }
      detail += kgbEnd !== null ? `; für Anträge ab ${M(kgbEnd)} entfällt er ganz.` : '.';
    }
    out.push(hint('important', 'Klimageschwindigkeitsbonus gesichert – Antragsdatum entscheidend', detail));
  } else {
    const reason = kgbReason(inp, run, start, app, kgbEnd);
    if (reason) out.push(reason);
  }

  // Einkommensbonus
  if (b.ownerOccupied) {
    const shift = b.hasChild ? p.incomeChildShift : 0;
    const rate = incomeBonusRate(b.householdIncome, b.hasChild, p);
    if (rate > 0) {
      out.push(hint('important', `Einkommensbonus ${pct(rate)}`, `Zu versteuerndes Haushaltseinkommen ${eur(b.householdIncome)}. Nachweis über die Steuerbescheide des 2. und 3. Jahres vor Antragstellung.`));
    } else {
      out.push(hint('info', 'Kein Einkommensbonus', `Grenze ${eur(p.incomeLimit3 + shift)} zu versteuerndes Haushaltseinkommen, angegeben sind ${eur(b.householdIncome)}.`));
    }
  }

  // Höchstbetrag förderfähiger Kosten
  const capStart = tryParseMonth(p.capDegressionStart);
  if (k.eligibleCosts >= k.capTotal && p.capStep > 0 && capStart !== null) {
    const next = capStart + 6 * halfYearSteps(app, capStart);
    out.push(
      hint(
        'info',
        `Förderfähige Kosten auf ${eur(k.capTotal)} begrenzt`,
        `Höchstbetrag der 1. Wohneinheit bei Antrag ${M(app)}: ${eur(cap1At(app, p))}; ab ${M(next)} ${eur(cap1At(next, p))}. Kosten darüber werden nicht bezuschusst.`,
      ),
    );
  }

  // Kreditvariante
  const kfwLoan = run.kfw.loans.find((l) => l.name.startsWith('KfW'));
  if (kfwLoan && kfwLoanVariant(b.ownerOccupied, b.units, b.householdIncome, p) === '359') {
    out.push(
      hint(
        'info',
        'KfW-Kredit 359 statt zinsverbilligtem 358',
        b.householdIncome > p.loan358IncomeLimit
          ? `Haushaltseinkommen über ${eur(p.loan358IncomeLimit)}.`
          : 'Zinsverbilligung nur für selbstgenutzte Ein-Wohneinheit-Gebäude.',
      ),
    );
  }

  // Steuerbonus
  const t = run.tax.tax;
  if (t && t.eligible) {
    out.push(
      hint(
        'info',
        `Steuerbonus nur bei Abschluss bis ${M(parseMonth(inp.tax.deadline))}`,
        `Verteilt auf ${t.yearly.map((y) => y.year).join(', ')}; Erstattung jeweils mit dem Steuerbescheid des Folgejahres. Nicht mit dem KfW-Zuschuss kombinierbar.`,
      ),
    );
  } else if (t) {
    out.push(hint('warning', 'Steuerbonus nicht möglich', t.notes.join(' ')));
  }
  return out;
}

/** Begründung, warum kein Klimageschwindigkeitsbonus gewährt wird – inkl. Prüfung, ob er später erreichbar wäre. */
function kgbReason(inp: Inputs, run: RunResult, start: number, app: number, kgbEnd: number | null): KeyEvent | null {
  const p = inp.funding;
  const o = inp.oldHeating;
  if (kgbRateAt(app, p) <= 0) {
    return hint('warning', 'Klimageschwindigkeitsbonus ausgelaufen', `Für Anträge ab ${kgbEnd !== null ? M(kgbEnd) : '–'} wird kein Klimageschwindigkeitsbonus mehr gewährt.`);
  }
  if (o.fuel !== 'gas') return null;
  if (run.kfw.boilerPurchases.some((b) => b.month <= app)) {
    return hint('warning', 'Kein Klimageschwindigkeitsbonus', 'Ersetzt wird dann ein neuer Ersatzkessel, nicht die alte Gasheizung (Mindestalter nicht erfüllt).');
  }
  const reach = start + Math.ceil((p.kgbMinGasAge - o.ageYears) * 12);
  const oldEnd = start + Math.round(o.remainingLifeYears * 12);
  const ageAtApp = o.ageYears + (app - start) / 12;
  const base = `Gasheizungen erst ab ${p.kgbMinGasAge} Jahren; die Heizung ist bei Antrag ${M(app)} ${fmtYears(ageAtApp)} alt und erreicht ${p.kgbMinGasAge} Jahre ${M(reach)}.`;
  if (kgbEnd !== null && reach >= kgbEnd) {
    return hint(
      'warning',
      'Klimageschwindigkeitsbonus nicht erreichbar',
      `${base} Der Bonus entfällt aber für Anträge ab ${M(kgbEnd)} – Warten lohnt sich dafür nicht.`,
    );
  }
  if (reach >= oldEnd) {
    return hint('warning', 'Klimageschwindigkeitsbonus nicht erreichbar', `${base} Die angegebene Restlebensdauer endet bereits ${M(oldEnd)}.`);
  }
  const rate = kgbRateAt(reach, p);
  return hint(
    'info',
    `Klimageschwindigkeitsbonus erst bei Antrag ab ${M(reach)}`,
    `${base} Dann ${pct(rate)} Bonus – der Zeitpunktvergleich zeigt, ob sich das Warten trotz weiter laufender Energiekosten rechnet.`,
  );
}

function hint(level: EventLevel, title: string, detail: string): KeyEvent {
  return { month: null, scenario: 'all', level, title, detail };
}

function fmtYears(y: number): string {
  const r = Math.round(y * 10) / 10;
  return `${r.toLocaleString('de-DE')} ${r === 1 ? 'Jahr' : 'Jahre'}`;
}
