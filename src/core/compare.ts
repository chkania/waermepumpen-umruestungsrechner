import { parseMonth } from './dates';
import { simulate } from './simulation';
import type { Inputs } from './types';

export interface InstallComparisonRow {
  installMonth: number;
  kfwTotal: number;
  kfwSubsidy: number;
  taxTotal: number;
  taxFeasible: boolean;
  taxBonus: number;
  best: 'kfw' | 'tax';
  bestTotal: number;
  /** Ersparnis gegenüber Referenz (positiv = günstiger als ohne WP). */
  savingVsRef: number;
  /** Mehrkosten gegenüber dem frühesten Zeitpunkt (positiv = Warten kostet). */
  extraVsFirst: number;
  warnings: string[];
}

export interface InstallComparison {
  refTotal: number;
  rows: InstallComparisonRow[];
  bestIndex: number;
}

/** Vergleicht Installationszeitpunkte ab Startmonat in festen Schritten (F7). */
export function compareInstallTimes(inp: Inputs): InstallComparison {
  const start = parseMonth(inp.general.startMonth);
  const end = start + Math.round(inp.general.horizonYears * 12);
  const step = Math.max(1, Math.round(inp.compare.stepMonths));
  const count = Math.max(1, Math.round(inp.compare.count));
  const ref = simulate(inp, 'ref');
  const rows: InstallComparisonRow[] = [];
  for (let i = 0; i < count; i++) {
    const month = start + i * step;
    if (month >= end) break;
    const kfw = simulate(inp, 'kfw', month);
    const tax = simulate(inp, 'tax', month);
    const best = tax.feasible && tax.totalCost < kfw.totalCost ? 'tax' : 'kfw';
    const bestTotal = best === 'tax' ? tax.totalCost : kfw.totalCost;
    rows.push({
      installMonth: month,
      kfwTotal: kfw.totalCost,
      kfwSubsidy: kfw.kfw?.subsidy ?? 0,
      taxTotal: tax.totalCost,
      taxFeasible: tax.feasible,
      taxBonus: tax.tax?.total ?? 0,
      best,
      bestTotal,
      savingVsRef: ref.totalCost - bestTotal,
      extraVsFirst: 0,
      warnings: [...new Set([...kfw.warnings, ...(best === 'tax' ? tax.warnings : [])])],
    });
  }
  const first = rows[0]?.bestTotal ?? 0;
  let bestIndex = 0;
  rows.forEach((r, i) => {
    r.extraVsFirst = r.bestTotal - first;
    if (r.bestTotal < rows[bestIndex].bestTotal) bestIndex = i;
  });
  return { refTotal: ref.totalCost, rows, bestIndex };
}
