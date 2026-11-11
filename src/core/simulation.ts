import { HEAT_PROFILE } from './defaults';
import { formatMonthDe, monthOf, parseMonth, yearOf } from './dates';
import { kfwLoanVariant, kfwSubsidy } from './funding';
import { loanSchedule, type LoanSpec } from './loan';
import { annualHeatDemand, createPriceModel } from './prices';
import { taxBonus } from './tax';
import type {
  CostBreakdown,
  Inputs,
  LoanInfo,
  MonthRow,
  ScenarioKind,
  ScenarioResult,
  YearRow,
} from './types';

const LABELS: Record<ScenarioKind, string> = {
  ref: 'Ohne Wärmepumpe (Referenz)',
  kfw: 'Wärmepumpe mit KfW-Zuschuss',
  tax: 'Wärmepumpe mit Steuerbonus',
};

const COST_KEYS: (keyof CostBreakdown)[] = [
  'energy',
  'fixed',
  'maintenance',
  'investment',
  'loanPayout',
  'interest',
  'principal',
  'subsidy',
  'taxBonus',
  'residual',
  'total',
];

function emptyBreakdown(): CostBreakdown {
  return {
    energy: 0,
    fixed: 0,
    maintenance: 0,
    investment: 0,
    loanPayout: 0,
    interest: 0,
    principal: 0,
    subsidy: 0,
    taxBonus: 0,
    residual: 0,
    total: 0,
  };
}

interface Asset {
  cost: number;
  install: number;
  lifeMonths: number;
}

/**
 * Simuliert ein Szenario monatlich.
 * @param installOverride absoluter Installationsmonat (überschreibt inputs.heatPump.installMonth)
 */
export function simulate(inp: Inputs, kind: ScenarioKind, installOverride?: number): ScenarioResult {
  const warnings: string[] = [];
  const start = parseMonth(inp.general.startMonth);
  const H = Math.max(1, Math.round(inp.general.horizonYears * 12));
  const end = start + H;
  const pm = createPriceModel(inp);
  const heat = annualHeatDemand(inp);
  const o = inp.oldHeating;
  const hp = inp.heatPump;
  const fin = inp.financing;
  const fuel = o.fuel;
  const growth = (rate: number, monthsFromStart: number) => Math.pow(1 + rate, monthsFromStart / 12);
  let feasible = true;

  let install: number | null = null;
  if (kind !== 'ref') {
    install = installOverride ?? parseMonth(hp.installMonth);
    if (install < start) {
      warnings.push('Installationszeitpunkt liegt vor dem Startmonat – auf Startmonat gesetzt.');
      install = start;
    }
    if (install >= end) {
      warnings.push('Installationszeitpunkt liegt außerhalb des Betrachtungszeitraums.');
      install = null;
      feasible = false;
    }
  }

  // Ersatzkessel (Referenz bzw. WP-Szenario, falls Altanlage vor Installation ausfällt)
  const oldEnd = start + Math.max(0, Math.round(o.remainingLifeYears * 12));
  const fossilEnd = install ?? end;
  const replLife = Math.max(1, Math.round(o.replacementLifeYears * 12));
  const replacements: number[] = [];
  for (let b = oldEnd; b < fossilEnd; b += replLife) replacements.push(b);
  if (kind !== 'ref' && replacements.length > 0) {
    warnings.push(
      `Die Altanlage erreicht ihr Lebensende (${formatMonthDe(oldEnd)}) vor der Installation der Wärmepumpe – ein Ersatzkessel ist eingerechnet.`,
    );
  }

  const rows: MonthRow[] = [];
  for (let m = 0; m < H; m++) {
    rows.push({ month: start + m, heatKWh: 0, system: 'old', ...emptyBreakdown() });
  }
  const assets: Asset[] = [];

  const boilerPurchases: { month: number; cost: number }[] = [];
  for (const b of replacements) {
    const cost = o.replacementCost * growth(inp.general.investIncrease, b - start);
    rows[b - start].investment += cost;
    boilerPurchases.push({ month: b, cost });
    assets.push({ cost, install: b, lifeMonths: replLife });
  }

  // Laufende Kosten
  for (const r of rows) {
    const abs = r.month;
    const year = yearOf(abs);
    const m = abs - start;
    const heatM = heat * HEAT_PROFILE[monthOf(abs) - 1];
    r.heatKWh = heatM;
    const maintGrowth = growth(inp.general.costIncrease, m);
    if (install !== null && abs >= install) {
      r.system = 'wp';
      const elec = heatM / hp.jaz;
      const gridCt = pm.elecCt(year);
      r.energy = (elec * (1 - hp.pvShare) * gridCt + elec * hp.pvShare * hp.feedInCt) / 100;
      const elecGrowth = Math.pow(1 + hp.elecIncrease, Math.max(0, year - pm.startYear));
      r.fixed = ((hp.separateTariff ? hp.meterFee * elecGrowth : 0) - hp.para14aReduction) / 12;
      r.maintenance = (hp.maintenance * maintGrowth) / 12;
    } else {
      const isNew = abs >= oldEnd;
      r.system = isNew ? 'new' : 'old';
      const eff = isNew ? o.replacementEfficiency : o.efficiency;
      const fuelKWh = heatM / eff;
      const ct = pm.fuelCt(fuel, year) + (isNew ? pm.bioSurchargeCt(year) : 0);
      r.energy = (fuelKWh * ct) / 100;
      r.fixed = fuel === 'gas' ? pm.gasBaseFee(year) / 12 : 0;
      r.maintenance = (o.maintenance * maintGrowth) / 12;
    }
  }

  const loans: LoanInfo[] = [];
  let kfwRes: ScenarioResult['kfw'];
  let taxRes: ScenarioResult['tax'];

  if (install !== null) {
    const iIdx = install - start;
    const wpGross = hp.investment * growth(inp.general.investIncrease, iIdx);
    const extra = hp.extraCost * growth(inp.general.investIncrease, iIdx);
    const eligibleGross = wpGross * hp.eligibleShare;
    const total = wpGross + extra;
    rows[iIdx].investment += total;
    assets.push({ cost: wpGross, install, lifeMonths: Math.max(1, Math.round(hp.lifeYears * 12)) });

    const addLoan = (name: string, spec: LoanSpec) => {
      if (spec.principal <= 0) return;
      rows[spec.startMonth - start].loanPayout -= spec.principal;
      const sched = loanSchedule(spec);
      let interest = 0;
      let balanceAtEnd = spec.principal;
      let payoffMonth: number | null = null;
      for (const p of sched) {
        if (p.month >= end) break;
        const row = rows[p.month - start];
        row.interest += p.interest;
        row.principal += p.principal;
        interest += p.interest;
        balanceAtEnd = p.balance;
        if (p.balance <= 0.005) payoffMonth = p.month;
      }
      if (balanceAtEnd > 0.005) {
        rows[H - 1].principal += balanceAtEnd;
        warnings.push(
          `${name}: Restschuld von ${Math.round(balanceAtEnd).toLocaleString('de-DE')} € am Ende des Betrachtungszeitraums als Ablösung eingerechnet.`,
        );
      }
      const lastPayment = sched.length ? sched[sched.length - 1].month : spec.startMonth;
      const fixEnd = spec.fixMonths > 0 ? spec.startMonth + spec.fixMonths : null;
      loans.push({
        name,
        principal: spec.principal,
        rate: spec.rate,
        totalInterest: interest,
        startMonth: spec.startMonth,
        repaymentStartMonth: spec.graceMonths > 0 ? spec.startMonth + spec.graceMonths + 1 : null,
        fixEndMonth: fixEnd !== null && fixEnd < lastPayment ? fixEnd : null,
        followUpRate: spec.followUpRate,
        payoffMonth,
        balanceAtEnd: balanceAtEnd > 0.005 ? balanceAtEnd : 0,
      });
    };

    if (kind === 'kfw') {
      const appMonth = install - inp.heatPump.leadMonths;
      const lastRepl = replacements.filter((b) => b <= appMonth).pop();
      const oldAge =
        lastRepl !== undefined ? (appMonth - lastRepl) / 12 : o.ageYears + (appMonth - start) / 12;
      kfwRes = kfwSubsidy(
        {
          eligibleCost: eligibleGross,
          appMonth,
          fuel,
          oldHeatingAge: oldAge,
          ownerOccupied: inp.building.ownerOccupied,
          units: inp.building.units,
          householdIncome: inp.building.householdIncome,
          hasChild: inp.building.hasChild,
        },
        inp.funding,
      );
      warnings.push(...kfwRes.notes);
      const subsidyMonth = install + Math.max(0, Math.round(fin.subsidyDelayMonths));
      if (subsidyMonth < end) rows[subsidyMonth - start].subsidy -= kfwRes.subsidy;

      const equity = Math.min(Math.max(0, fin.kfwEquity), total);
      const need = total - equity;
      const variant = kfwLoanVariant(
        inp.building.ownerOccupied,
        inp.building.units,
        inp.building.householdIncome,
        inp.funding,
      );
      const kfwMax = inp.funding.loanMaxPerUnit * Math.max(1, inp.building.units);
      const kfwLoan = Math.max(0, Math.min(need, kfwMax, eligibleGross));
      const bankLoan = need - kfwLoan;
      if (need > kfwLoan + 0.005) {
        warnings.push(
          `Finanzierungsbedarf über KfW-Kredit hinaus (${Math.round(bankLoan).toLocaleString('de-DE')} €) wird über den Bankkredit gerechnet.`,
        );
      }
      addLoan(`KfW-Kredit ${variant}`, {
        principal: kfwLoan,
        startMonth: install,
        rate: variant === '358' ? fin.kfwRate358 : fin.kfwRate359,
        termMonths: Math.round(fin.kfwTermYears * 12),
        graceMonths: Math.round(fin.kfwGraceYears * 12),
        fixMonths: Math.round(fin.kfwFixYears * 12),
        followUpRate: fin.followUpRate,
        extraRepayments:
          fin.subsidyAsSpecialRepayment && subsidyMonth < end
            ? [{ month: subsidyMonth, amount: kfwRes.subsidy }]
            : [],
      });
      addLoan('Bankkredit', bankSpec(bankLoan, install, inp));
    } else {
      const ageAtCompletion = inp.building.buildingAgeYears + (install - start) / 12;
      taxRes = taxBonus(
        {
          cost: eligibleGross,
          completionMonth: install,
          ownerOccupied: inp.building.ownerOccupied,
          buildingAgeAtCompletion: ageAtCompletion,
          incomeTax: inp.building.incomeTax,
        },
        inp.tax,
      );
      warnings.push(...taxRes.notes);
      if (!taxRes.eligible) feasible = false;
      const refundMonth = Math.min(12, Math.max(1, Math.round(fin.taxRefundMonth)));
      for (const y of taxRes.yearly) {
        const month = (y.year + 1) * 12 + (refundMonth - 1);
        if (month >= start && month < end) rows[month - start].taxBonus -= y.amount;
      }
      const equity = Math.min(Math.max(0, fin.taxEquity), total);
      addLoan('Bankkredit', bankSpec(total - equity, install, inp));
    }
  }

  // Restwerte
  if (inp.general.residualValue) {
    for (const a of assets) {
      const remaining = a.install + a.lifeMonths - end;
      if (remaining > 0) rows[H - 1].residual -= (a.cost * Math.min(remaining, a.lifeMonths)) / a.lifeMonths;
    }
  }

  // Summen und Aufzinsung
  const q = Math.pow(1 + inp.general.opportunityRate, 1 / 12) - 1;
  const cumulative: number[] = [];
  let cum = 0;
  let nominal = 0;
  for (const r of rows) {
    r.total =
      r.energy +
      r.fixed +
      r.maintenance +
      r.investment +
      r.loanPayout +
      r.interest +
      r.principal +
      r.subsidy +
      r.taxBonus +
      r.residual;
    nominal += r.total;
    cum = cum * (1 + q) + r.total;
    cumulative.push(cum);
  }

  const years = aggregateYears(rows, cumulative);

  return {
    kind,
    label: LABELS[kind],
    feasible,
    installMonth: install,
    months: rows,
    years,
    cumulative,
    totalCost: cum,
    nominalCost: nominal,
    warnings,
    kfw: kfwRes,
    tax: taxRes,
    loans,
    boilerPurchases,
  };
}

function bankSpec(principal: number, install: number, inp: Inputs): LoanSpec {
  const f = inp.financing;
  return {
    principal: Math.max(0, principal),
    startMonth: install,
    rate: f.bankRate,
    termMonths: Math.round(f.bankTermYears * 12),
    graceMonths: Math.round(f.bankGraceYears * 12),
    fixMonths: 0,
    followUpRate: f.bankRate,
  };
}

export function aggregateYears(rows: MonthRow[], cumulative: number[]): YearRow[] {
  const map = new Map<number, YearRow>();
  rows.forEach((r, i) => {
    const y = yearOf(r.month);
    let yr = map.get(y);
    if (!yr) {
      yr = { year: y, cumulative: 0, ...emptyBreakdown() };
      map.set(y, yr);
    }
    for (const k of COST_KEYS) yr[k] += r[k];
    yr.cumulative = cumulative[i];
  });
  return [...map.values()];
}

/**
 * Amortisationszeitpunkt: erster Monat, ab dem die kumulierten Kosten des WP-Szenarios
 * bis zum Ende dauerhaft ≤ Referenz sind. null = keine Amortisation im Zeitraum.
 */
export function breakEven(ref: ScenarioResult, wp: ScenarioResult): number | null {
  const n = Math.min(ref.cumulative.length, wp.cumulative.length);
  let lastWorse = -1;
  for (let i = 0; i < n; i++) if (wp.cumulative[i] > ref.cumulative[i] + 1e-6) lastWorse = i;
  if (lastWorse === n - 1) return null;
  return ref.months[lastWorse + 1].month;
}

export interface PriceRow {
  year: number;
  co2Price: number;
  fuelCt: number;
  elecCt: number;
  /** Kosten je kWh Nutzwärme (ct): fossil = Brennstoff / Nutzungsgrad, WP = Strom / JAZ. */
  heatCtFossil: number;
  heatCtWp: number;
}

export function priceRows(inp: Inputs): PriceRow[] {
  const pm = createPriceModel(inp);
  const out: PriceRow[] = [];
  const n = Math.ceil(inp.general.horizonYears) + 1;
  for (let i = 0; i < n; i++) {
    const year = pm.startYear + i;
    const fuelCt = pm.fuelCt(inp.oldHeating.fuel, year);
    const elecCt = pm.elecCt(year);
    const hp = inp.heatPump;
    out.push({
      year,
      co2Price: pm.co2Price(year),
      fuelCt,
      elecCt,
      heatCtFossil: fuelCt / inp.oldHeating.efficiency,
      heatCtWp: ((1 - hp.pvShare) * elecCt + hp.pvShare * hp.feedInCt) / hp.jaz,
    });
  }
  return out;
}

export interface RunResult {
  ref: ScenarioResult;
  kfw: ScenarioResult;
  tax: ScenarioResult;
  breakEvenKfw: number | null;
  breakEvenTax: number | null;
  best: 'kfw' | 'tax';
}

export function runAll(inp: Inputs): RunResult {
  const ref = simulate(inp, 'ref');
  const kfw = simulate(inp, 'kfw');
  const tax = simulate(inp, 'tax');
  const best = tax.feasible && tax.totalCost < kfw.totalCost ? 'tax' : 'kfw';
  return {
    ref,
    kfw,
    tax,
    breakEvenKfw: kfw.feasible ? breakEven(ref, kfw) : null,
    breakEvenTax: tax.feasible ? breakEven(ref, tax) : null,
    best,
  };
}
