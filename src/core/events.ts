import { formatMonthDe, halfYearSteps, monthFromDate, parseMonth, tryParseMonth, yearOf } from './dates';
import { incomeRangeLabel, incomeRangeValue } from './income-range';
import { cap1At, incomeBonusRate, kfwLoanVariant, kgbRateAt } from './funding';
import { annualHeatDemand, createPriceModel, energySplit, parsePath } from './prices';
import { estimateJaz } from './jaz';
import { runAll, type RunResult } from './simulation';
import type { Inputs, ScenarioResult } from './types';

export type EventScenario = 'ref' | 'kfw' | 'tax' | 'all';
/** info = orientation, important = large cash flow / turning point, warning = drawback that is easily overlooked. */
export type EventLevel = 'info' | 'important' | 'warning';

export interface KeyEvent {
  /** Absolute month; null = notice not tied to a date. */
  month: number | null;
  scenario: EventScenario;
  level: EventLevel;
  title: string;
  detail?: string;
  /** Amount in € (positive = expense, negative = income). */
  amount?: number;
  /** Optional: amount per year instead of one-off. */
  perYear?: boolean;
}

export interface KeyEvents {
  /** Notices on funding/tax/loan that are not tied to a date. */
  hints: KeyEvent[];
  /** Dated events, in chronological order. */
  timeline: KeyEvent[];
}

const eur = (x: number) => `${Math.round(x).toLocaleString('de-DE')} €`;
const pct = (x: number) => `${Math.round(x * 100)} %`;
const M = formatMonthDe;

/**
 * Determines the key events and notices (F10).
 * @param today current date – for notices that depend on it (start month in the future, F10.6); omitted = no such notices
 */
export function keyEvents(inp: Inputs, run: RunResult, today?: Date): KeyEvents {
  const hints: KeyEvent[] = [];
  const timeline: KeyEvent[] = [];
  const start = parseMonth(inp.general.startMonth);
  const end = start + Math.round(inp.general.horizonYears * 12);
  const o = inp.oldHeating;

  // ---------- Reference: replacement boiler (Ersatzkessel) + bio step-up (Bio-Treppe) ----------
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
    // Steps before the boiler purchase only count if they are still the applicable ones at purchase time
    const relevant = steps.filter(
      (st, i) => st.year * 12 >= firstBoiler.month || !(steps[i + 1] && steps[i + 1].year * 12 <= firstBoiler.month),
    );
    for (const step of relevant) {
      const month = Math.max(step.year * 12, firstBoiler.month);
      if (month >= end) continue;
      const surcharge = (fuelNew * pm.bioSurchargeCt(yearOf(month))) / 100;
      const zero = Math.round(surcharge) === 0;
      const covered = zero && inp.prices.currentBioShare > 0;
      timeline.push({
        month,
        scenario: 'ref',
        level: 'info',
        title: `Bio-Treppe: ${step.value} % Bio-Anteil für den neuen Kessel`,
        detail: covered
          ? `Gebäudemodernisierungsgesetz – kein Aufpreis: Der Bio-Anteil im heutigen Tarif (${pct(inp.prices.currentBioShare)}) deckt die Pflicht bereits.`
          : 'Gebäudemodernisierungsgesetz – Mehrkosten für Biogas/Bioöl gegenüber fossilem Brennstoff.',
        // F25.4: a bio share bought today covers the obligation – no "−0 €" amount
        ...(zero ? {} : { amount: surcharge, perYear: true }),
      });
    }
  }

  // ---------- Heat pump ----------
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
  for (const r of kfw.hpReplacements) {
    timeline.push({
      month: r.month,
      scenario: 'all',
      level: 'important',
      title: 'Ersatz der Wärmepumpe',
      detail: `Lebensdauer der Wärmepumpe (${fmtYears(inp.heatPump.lifeYears)}) erreicht. Ersatz zu heutigen Preisen mit Preissteigerung, ohne Förderung.`,
      amount: r.cost,
    });
  }
  if (install !== null) {
    const cooking = energySplit(inp).cookingFuel > 0;
    timeline.push({
      month: install,
      scenario: 'all',
      level: 'important',
      title: 'Inbetriebnahme der Wärmepumpe',
      detail:
        cooking && inp.oldHeating.cookingAfter === 'electric'
          ? 'Investition inkl. Preissteigerung bis zum Kaufzeitpunkt und neuem Kochfeld (Induktion); Gasanschluss und Wartung der Altanlage entfallen.'
          : inp.oldHeating.cookingAfter === 'gas' && cooking
            ? 'Investition inkl. Preissteigerung bis zum Kaufzeitpunkt; Wartung der Altanlage entfällt, der Gasanschluss bleibt für den Herd.'
            : 'Investition inkl. Preissteigerung bis zum Kaufzeitpunkt; Gasanschluss/Öltank und Wartung der Altanlage entfallen.',
      // Boiler purchases always happen strictly before commissioning and appear as their own events above, so the
      // investment of this month is exactly the heat pump plus the optional induction hob (F17.3).
      amount: kfw.months[install - start].investment,
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
        detail: repaidLoan(kfw, 'Zuschuss') ? `Wird als Sondertilgung für den ${repaidLoan(kfw, 'Zuschuss')} verwendet.` : undefined,
        amount: -k.subsidy,
      });
    }
  }
  addLoanEvents(timeline, kfw, 'kfw');
  addLoanEvents(timeline, tax, 'tax');
  addWindfallEvents(timeline, kfw, 'kfw');
  addWindfallEvents(timeline, tax, 'tax');

  if (tax.tax?.eligible) {
    const refundMonth = Math.min(12, Math.max(1, Math.round(inp.financing.taxRefundMonth)));
    const refunds = tax.tax.yearly.filter((y) => y.amount > 0);
    refunds.forEach((y, i) => {
      const month = (y.year + 1) * 12 + (refundMonth - 1);
      if (month >= end) return;
      const last = i === refunds.length - 1;
      const loan = repaidLoan(tax, 'Steuererstattung', month);
      const repay = loan ? ` Wird als Sondertilgung für den ${loan} verwendet.` : '';
      timeline.push({
        month,
        scenario: 'tax',
        level: last ? 'important' : 'info',
        title: last ? 'Letzte Steuererstattung (§ 35c)' : `Steuererstattung für ${y.year}`,
        detail: last
          ? `Für das Steuerjahr ${y.year}.${repay} Danach entfällt die Entlastung${tax.loans.some((l) => l.payoffMonth === null || l.payoffMonth > month) ? ' – die Kreditraten laufen weiter' : ''}.`
          : `Für das Steuerjahr ${y.year}.${repay}`,
        amount: -y.amount,
      });
    });
  }

  // ---------- Notices ----------
  const future = today ? futureStartHint(inp, start, today) : null;
  if (future) hints.push(future);
  if (install !== null) {
    const cook = cookingSwitchHint(inp, run);
    if (cook) hints.push(cook);
    hints.push(...fundingHints(inp, run, start));
  }
  const jazHint = jazAboveEstimateHint(inp);
  if (install !== null && jazHint) hints.push(jazHint);
  const bio = bioTariffHint(inp);
  if (bio) hints.push(bio);

  timeline.sort((a, b) => a.month! - b.month! || order(a) - order(b));
  return { hints, timeline };
}

/** Entered SPF (JAZ) above the estimate for the house (F26): savings are probably overestimated. */
function jazAboveEstimateHint(inp: Inputs): KeyEvent | null {
  const e = estimateJaz(inp);
  const jaz = inp.heatPump.jaz;
  if (!(jaz > e.high + 1e-9)) return null;
  const d1 = (x: number) => x.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return {
    month: null,
    scenario: 'all',
    level: 'warning',
    title: `JAZ ${d1(jaz)} liegt über der Schätzung für Ihr Haus (${d1(e.low)}–${d1(e.high)})`,
    detail:
      `Mit den angegebenen Heizflächen und dem Wärmebedarf ist an kalten Tagen ein Vorlauf von ca. ${e.supplyTemp} °C zu erwarten. ` +
      `Eine zu hohe JAZ unterschätzt die Stromkosten und überschätzt Ersparnis und CO₂-Einsparung. ` +
      `Den Wert nur so ansetzen, wenn der Fachbetrieb ihn für Ihr Haus bestätigt.`,
  };
}

/**
 * Bio share (Bio-Anteil) bought today (F25.4): the entered fuel price must be the price of that tariff,
 * because the bio premium (Bio-Mehrpreis) is not charged again for a replacement boiler (Ersatzkessel).
 */
function bioTariffHint(inp: Inputs): KeyEvent | null {
  const share = inp.prices.currentBioShare;
  if (!(share > 0)) return null;
  const gas = inp.oldHeating.fuel === 'gas';
  const fuel = gas ? 'Biogas' : 'Bioöl';
  const price = gas ? 'Gaspreis' : 'Heizölpreis';
  return {
    month: null,
    scenario: 'ref',
    level: 'warning',
    title: `${pct(share)} ${fuel} im heutigen Tarif: ${price} dieses Tarifs eintragen`,
    detail:
      `Der Rechner nimmt an, dass der Bio-Aufpreis im eingetragenen ${price} steckt, und rechnet ihn bei einem neuen Kessel ` +
      `(Bio-Treppe) nicht noch einmal. Steht dort der Preis von reinem ${gas ? 'Erdgas' : 'Heizöl'}, wird der Weiterbetrieb ` +
      `ohne Wärmepumpe zu günstig gerechnet und die Ersparnis der Wärmepumpe fällt zu niedrig aus. ` +
      `In der CO₂-Bilanz zählt der Bio-Anteil als klimaneutral.`,
  };
}

function order(e: KeyEvent): number {
  return { all: 0, ref: 1, kfw: 2, tax: 3 }[e.scenario];
}

/** Name of the loan that a subsidy (Zuschuss) or tax refund (Steuererstattung) repaid (in the given month), if any. */
function repaidLoan(s: ScenarioResult, label: string, month?: number): string | null {
  const l = s.loans.find((x) => x.extras.some((e) => e.label === label && e.applied > 0 && (month === undefined || e.month === month)));
  return l ? l.name : null;
}

function addWindfallEvents(timeline: KeyEvent[], s: ScenarioResult, scenario: 'kfw' | 'tax'): void {
  // Subsidy (Zuschuss) or tax refund (Steuererstattung) rejected as special repayment (Sondertilgung) (e.g. below 5,000 €)
  for (const l of s.loans) {
    for (const x of l.extras) {
      if ((x.label === 'Zuschuss' || x.label === 'Steuererstattung') && x.status === 'rejected') {
        timeline.push({ month: x.month, scenario, level: 'warning', title: `${x.label} nicht als Sondertilgung für ${l.name}`, detail: x.reason });
      }
    }
  }
  const w = s.windfall;
  if (!w) return;
  if (w.availableMonth !== w.month && !w.note) {
    timeline.push({
      month: w.availableMonth,
      scenario,
      level: 'info',
      title: `Einmalzahlung ${eur(w.amount)} verfügbar`,
      detail: `Die Sondertilgung ist für ${M(w.month)} geplant.`,
    });
  }
  if (w.note) {
    timeline.push({ month: w.month, scenario, level: 'warning', title: 'Einmalzahlung nicht eingesetzt', detail: w.note });
    return;
  }
  for (const a of w.attempts) {
    if (a.applied > 0) {
      const parts = ['Aus der Einmalzahlung (z. B. Lebensversicherung).'];
      if (a.paidOff) parts.push('Der Kredit ist damit vollständig getilgt.');
      if (a.fee > 0) parts.push(`Vorfälligkeitsentschädigung ${eur(a.fee)}.`);
      else parts.push('Ohne Vorfälligkeitsentschädigung.');
      if (w.interestSaved > 0.5 && w.attempts.filter((x) => x.applied > 0).length === 1) {
        parts.push(`Spart ${eur(w.interestSaved)} Zinsen im Betrachtungszeitraum.`);
      }
      if (a.reason) parts.push(a.reason);
      timeline.push({ month: w.month, scenario, level: 'important', title: `Sondertilgung ${eur(a.applied)} auf ${a.loan}`, detail: parts.join(' '), amount: a.applied + a.fee });
    } else {
      timeline.push({ month: w.month, scenario, level: 'warning', title: `Sondertilgung auf ${a.loan} nicht möglich`, detail: a.reason });
    }
  }
  if (w.interestSaved > 0.5 && w.attempts.filter((x) => x.applied > 0).length > 1) {
    timeline.push({ month: w.month, scenario, level: 'info', title: `Sondertilgung spart ${eur(w.interestSaved)} Zinsen`, detail: 'Summe über alle getilgten Kredite im Betrachtungszeitraum.' });
  }
  if (w.unused > 0.5) {
    timeline.push({
      month: w.month,
      scenario,
      level: w.used > 0 ? 'info' : 'warning',
      title: `${eur(w.unused)} der Einmalzahlung nicht eingesetzt`,
      detail: w.used > 0 ? 'Alle Kredite sind getilgt bzw. eine weitere Sondertilgung ist nach den Bedingungen nicht möglich.' : 'Nach den Kreditbedingungen ist keine Sondertilgung möglich.',
    });
  }
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

/**
 * If the gas cooker (Gasherd) stays, the calculator evaluates the "induction" alternative (F17.4):
 * saving over the period (like the key figures, incl. opportunity interest (Opportunitätszins)), best variant in each case.
 * @param run result of `runAll` for the same inputs – only the alternative still has to be simulated
 */
export function cookingSwitchSaving(inp: Inputs, run: RunResult): number | null {
  const s = energySplit(inp);
  if (s.cookingFuel <= 0 || inp.oldHeating.cookingAfter !== 'gas' || run.kfw.installMonth === null) return null;
  const alt = runAll({ ...inp, oldHeating: { ...inp.oldHeating, cookingAfter: 'electric' } });
  const cost = (r: RunResult) => (r.best === 'tax' ? r.tax.totalCost : r.kfw.totalCost);
  return cost(run) - cost(alt);
}

function cookingSwitchHint(inp: Inputs, run: RunResult): KeyEvent | null {
  const saving = cookingSwitchSaving(inp, run);
  if (saving === null) return null;
  const s = energySplit(inp);
  const gasCt = inp.prices.gasPriceCt;
  const gasYear = (s.cookingFuel * gasCt) / 100;
  const elYear = (s.cookingFuel * inp.prices.cookingElecFactor * inp.heatPump.householdPriceCt) / 100;
  const detail =
    `Mit Gasherd bleibt der Gasanschluss: Grundpreis ${eur(inp.prices.gasBaseFee)} und Gas fürs Kochen ca. ${eur(gasYear)} pro Jahr (heutige Preise). ` +
    `Mit Induktion ca. ${eur(elYear)} Strom pro Jahr, einmalig ${eur(inp.oldHeating.cookingSwitchCost)} für das Kochfeld. ` +
    'Gerechnet über den Betrachtungszeitraum wie die Kennzahlen; Umstellen unter „Kochen nach dem Umstieg“.';
  return saving > 0
    ? hint('important', `Kochen mit Strom statt Gas spart ca. ${eur(saving)}`, detail)
    : hint('info', `Kochen mit Strom statt Gas würde ca. ${eur(-saving)} mehr kosten`, detail);
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

  // Climate speed bonus (Klimageschwindigkeitsbonus)
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

  // Base funding (Grundförderung) / value-added bonus (Wertschöpfungs-Bonus) (guideline (Richtlinie) no. 8.4.1 c, 8.4.6)
  if (k.grundRate < p.grundRate) {
    out.push(
      k.wsbRate > 0
        ? hint('info', `Grundförderung ${pct(k.grundRate)} + Wertschöpfungs-Bonus ${pct(k.wsbRate)}`, `Gilt für Anträge ab ${M(tryParseMonth(p.grundRateNewFrom)!)} und Wärmepumpen mit Ursprung in der EU. Nachweis des Ursprungs nach noch ausstehender Detailregelung.`)
        : hint('warning', `Nur ${pct(k.grundRate)} Grundförderung`, `Für Anträge ab ${M(tryParseMonth(p.grundRateNewFrom)!)} gibt es den Wertschöpfungs-Bonus von ${pct(p.wsbRate)} nur für Wärmepumpen mit Ursprung in der EU.`),
    );
  }

  // Income bonus (Einkommensbonus)
  if (b.ownerOccupied) {
    const shift = b.hasChild ? p.incomeChildShift : 0;
    const income = incomeRangeValue(b.incomeRange);
    const rate = incomeBonusRate(income, b.hasChild, p);
    if (rate > 0) {
      out.push(hint('important', `Einkommensbonus ${pct(rate)}`, `Einkommensbereich ${incomeRangeLabel(b.incomeRange)}. Nachweis über die Steuerbescheide des 2. und 3. Jahres vor Antragstellung.`));
    } else {
      out.push(hint('info', 'Kein Einkommensbonus', `Grenze ${eur(p.incomeLimit3 + shift)} zu versteuerndes Haushaltseinkommen, gewählter Bereich: ${incomeRangeLabel(b.incomeRange)}.`));
    }
  }

  // Cap on eligible costs (Höchstbetrag förderfähiger Kosten)
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

  // Loan variant
  const kfwLoan = run.kfw.loans.find((l) => l.name.startsWith('KfW'));
  const loanIncome = incomeRangeValue(b.incomeRange);
  if (kfwLoan && kfwLoanVariant(b.ownerOccupied, b.units, loanIncome, p) === '359') {
    out.push(
      hint(
        'info',
        'KfW-Kredit 359 statt zinsverbilligtem 358',
        loanIncome > p.loan358IncomeLimit
          ? `Einkommensbereich ${incomeRangeLabel(b.incomeRange)}, Grenze ${eur(p.loan358IncomeLimit)}.`
          : 'Zinsverbilligung nur für selbstgenutzte Ein-Wohneinheit-Gebäude.',
      ),
    );
  }

  // Tax bonus (Steuerbonus)
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

/** Reason why no climate speed bonus (Klimageschwindigkeitsbonus) is granted – including a check whether it could be reached later. */
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
  const installed = parseMonth(o.installedMonth);
  const reach = installed + Math.ceil(p.kgbMinGasAge * 12);
  const oldEnd = start + Math.round(o.remainingLifeYears * 12);
  const ageAtApp = (app - installed) / 12;
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

/**
 * F10.6: Start month (Start der Betrachtung) in the future. All prices and costs count as values of the start month and
 * only increase from then on – "today's" values entered there lack the increase up to the start, gas and oil prices
 * additionally the higher CO2 share (the CO2 share of the start year is deducted from the entered price).
 */
export function futureStartHint(inp: Inputs, start: number, today: Date): KeyEvent | null {
  const now = parseMonth(monthFromDate(today));
  if (start <= now) return null;
  const fossil = inp.oldHeating.fuel === 'oil' ? 'Heizölpreis' : 'Gaspreis';
  return {
    month: null,
    scenario: 'all',
    level: 'warning',
    title: `Start der Betrachtung liegt in der Zukunft (${M(start)})`,
    detail:
      `Alle Preise und Kosten gelten als Werte von ${M(start)} und steigen erst ab dann: ${fossil}, Strompreise, Investition, Wartung und Ersatzkessel. ` +
      `Stehen dort heutige Werte, fehlt die Preissteigerung bis ${M(start)} – beim ${fossil} zusätzlich der bis dahin höhere CO₂-Anteil. ` +
      'Alter und Restlebensdauer der Heizung zählen ebenfalls ab diesem Monat. ' +
      'Für einen späteren Umstieg besser den Start auf den aktuellen Monat setzen und nur die „Geplante Inbetriebnahme“ verschieben.',
  };
}
