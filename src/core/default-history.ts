/**
 * History of changed default values (F22.4). Stored inputs and exported files contain every value,
 * so a new default would never reach them. Each entry records the previous defaults of one update;
 * on load the calculator offers the new default for every field that still holds the previous one.
 *
 * Changing a default in defaults.ts → add an entry here (date = day of the change, YYYY-MM-DD,
 * previous value in the internal format, e.g. 0.075 for 7.5 %). Never edit older entries.
 */
import type { Inputs } from './types';

export type DefaultValue = number | string | boolean;

export interface DefaultChange {
  /** Day of the change (YYYY-MM-DD); later entries come last. */
  date: string;
  /** Previous default per field path. */
  previous: Readonly<Record<string, DefaultValue>>;
}

export const DEFAULT_CHANGES: readonly DefaultChange[] = [
  {
    date: '2026-11-18',
    previous: { 'oldHeating.maintenance': 200, 'oldHeating.replacementCost': 12000, 'financing.bankRate': 0.075 },
  },
];

/** Version of the defaults a saved data set was created with (stored as `defaultsAsOf`). */
export const DEFAULTS_AS_OF = DEFAULT_CHANGES[DEFAULT_CHANGES.length - 1].date;

export interface OutdatedDefault {
  path: string;
  previous: DefaultValue;
  current: DefaultValue;
}

/** Reads `defaultsAsOf` from raw saved data; '' (older than every entry) if missing or invalid. */
export function savedDefaultsAsOf(data: unknown): string {
  const v = typeof data === 'object' && data !== null ? (data as Record<string, unknown>).defaultsAsOf : undefined;
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : '';
}

function readPath(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((o, k) => (typeof o === 'object' && o !== null ? (o as Record<string, unknown>)[k] : undefined), obj);
}

function same(a: unknown, b: unknown): boolean {
  return typeof a === 'number' && typeof b === 'number' ? Math.abs(a - b) < 1e-9 : a === b;
}

/**
 * Fields that still hold the default that was valid when the data was saved, although the default
 * has changed since. For each field the first change after `savedAsOf` decides (the value the user saw then).
 */
export function outdatedDefaults(inputs: Inputs, defaults: Inputs, savedAsOf: string, changes: readonly DefaultChange[] = DEFAULT_CHANGES): OutdatedDefault[] {
  const seen = new Set<string>();
  const out: OutdatedDefault[] = [];
  for (const change of changes) {
    if (change.date <= savedAsOf) continue;
    for (const [path, previous] of Object.entries(change.previous)) {
      if (seen.has(path)) continue;
      seen.add(path);
      const value = readPath(inputs, path);
      const current = readPath(defaults, path) as DefaultValue;
      if (same(value, previous) && !same(value, current)) out.push({ path, previous, current });
    }
  }
  return out;
}

/** Sets the new defaults; skips fields the user has changed in the meantime. */
export function applyNewDefaults(inputs: Inputs, outdated: readonly OutdatedDefault[]): void {
  for (const { path, previous, current } of outdated) {
    const keys = path.split('.');
    const parent = readPath(inputs, keys.slice(0, -1).join('.')) as Record<string, unknown> | undefined;
    if (parent && same(parent[keys[keys.length - 1]], previous)) parent[keys[keys.length - 1]] = current;
  }
}
