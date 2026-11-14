import { runAll, type RunResult } from './simulation';
import type { Inputs } from './types';

/**
 * Comparing variants (F31): two or three data sets (e.g. "Angebot A" and "Angebot B", or "jetzt" and "2028")
 * calculated side by side. Each variant is calculated completely on its own (own reference, own best way).
 */

export const MAX_VARIANTS = 3;

export interface Variant {
  name: string;
  inputs: Inputs;
}

export interface VariantResult {
  name: string;
  inputs: Inputs;
  run: RunResult;
  best: 'kfw' | 'tax';
  /** Total cost of the best heat pump way (€). */
  bestCost: number;
  /** Saving with a heat pump compared with the variant's own reference (€). */
  saving: number;
  breakEven: number | null;
  co2Saved: number;
}

export function variantResult(v: Variant): VariantResult {
  const run = runAll(v.inputs);
  const best = run.best;
  const s = best === 'tax' ? run.tax : run.kfw;
  return {
    name: v.name,
    inputs: v.inputs,
    run,
    best,
    bestCost: s.totalCost,
    saving: run.ref.totalCost - s.totalCost,
    breakEven: best === 'tax' ? run.breakEvenTax : run.breakEvenKfw,
    co2Saved: run.ref.co2Tons - s.co2Tons,
  };
}

/** Unique display name: scenario name, otherwise the fallback (e.g. file name); duplicates get " (2)", " (3)". */
export function variantName(inputs: Inputs, fallback: string, taken: string[]): string {
  const base = inputs.scenario.name.trim() || fallback.trim() || 'Variante';
  let name = base;
  for (let n = 2; taken.includes(name); n++) name = `${base} (${n})`;
  return name;
}
