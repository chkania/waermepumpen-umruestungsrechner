import type { Inputs } from './types';
import { cleanScenarioName, exportJson } from './serialize';

/**
 * Saved scenarios in the browser (F37): named input sets in localStorage. This module only holds the pure
 * functions for reading, checking and changing the list; the app reads the storage anew before every write (F37.1).
 * Only inputs are saved, never results (F37.14).
 */

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

/** localStorage key of the saved scenarios (F37.2). */
export const SCENARIOS_KEY = 'wp-investitionsrechner:szenarien';
/** Version of the list format `{ version, entries }` (F37.2, F37.11). */
export const SCENARIO_LIST_VERSION = 1;

/**
 * Parses the stored list. Unreadable (F37.11): invalid JSON, not an object, another version or `entries` not a list.
 * `null` (nothing stored yet) is an empty, readable list.
 */
export function parseScenarioFile(raw: string | null): { readable: true; entries: unknown[] } | { readable: false } {
  if (raw === null) return { readable: true, entries: [] };
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { readable: false };
  }
  if (!isObj(data) || data.version !== SCENARIO_LIST_VERSION || !Array.isArray(data.entries)) return { readable: false };
  return { readable: true, entries: data.entries };
}

/** Text of the stored list (F37.2). */
export function serializeScenarioFile(entries: unknown[]): string {
  return JSON.stringify({ version: SCENARIO_LIST_VERSION, entries });
}

/** One entry as the dialog shows it (F37.5, F37.12). `index` is its position in the stored list. */
export interface ScenarioView {
  index: number;
  /** Cleaned name; '' when missing or invalid. */
  name: string;
  /** ISO time of the last change; null when missing or invalid (then "Stand unbekannt", F37.12). */
  savedAt: string | null;
  /** The inputs (export format) when the entry can be used, otherwise null. */
  inputs: Obj | null;
  /** Readable (F37.12): an object with a name and inputs of version 1. Only "Löschen" works otherwise. */
  readable: boolean;
}

/** Reads one stored entry defensively; whatever is wrong makes it unreadable instead of failing. */
export function viewScenario(raw: unknown, index: number): ScenarioView {
  const o: Obj = isObj(raw) ? raw : {};
  const name = cleanScenarioName(o.name);
  const savedAt = typeof o.savedAt === 'string' && !Number.isNaN(Date.parse(o.savedAt)) ? o.savedAt : null;
  const inputs = isObj(o.inputs) && o.inputs.version === 1 ? o.inputs : null;
  return { index, name, savedAt, inputs, readable: isObj(raw) && name !== '' && inputs !== null };
}

/** Views of all entries, sorted by name in German order (F37.5); the stored order stays as it is. */
export function scenarioViews(entries: unknown[]): ScenarioView[] {
  return entries.map((e, i) => viewScenario(e, i)).sort((a, b) => a.name.localeCompare(b.name, 'de'));
}

/** Position of the first entry with exactly this name (F37.4: names are compared exactly); -1 if there is none. */
export function findScenario(entries: unknown[], name: string): number {
  return entries.findIndex((e, i) => viewScenario(e, i).name === name);
}

/** A stored entry for the current inputs (F37.2): name, time of the change and the inputs in the export format. */
export function scenarioEntry(inputs: Inputs, name: string, defaultsAsOf: string, savedAt: Date): Obj {
  // The name of the entry is also the name in the saved inputs (F37.2)
  const copy = structuredClone(inputs);
  copy.scenario.name = name;
  return { name, savedAt: savedAt.toISOString(), inputs: JSON.parse(exportJson(copy, defaultsAsOf)) as Obj };
}

/** Saves under the name: an entry with the same name is overwritten (F37.4), otherwise one is appended. */
export function putScenario(entries: unknown[], name: string, entry: Obj): unknown[] {
  const i = findScenario(entries, name);
  return i < 0 ? [...entries, entry] : setScenarioAt(entries, i, entry);
}

/** Replaces the entry at this position (F37.7). */
export function setScenarioAt(entries: unknown[], index: number, entry: Obj): unknown[] {
  return entries.map((e, i) => (i === index ? entry : e));
}

/** Removes the entry at this position (F37.8). */
export function removeScenarioAt(entries: unknown[], index: number): unknown[] {
  return entries.filter((_, i) => i !== index);
}

/** "Stand TT.MM.JJJJ hh:mm" in local time (F37.5), or "Stand unbekannt" (F37.12). */
export function formatSavedAt(savedAt: string | null): string {
  if (savedAt === null) return 'Stand unbekannt';
  const d = new Date(savedAt);
  const p = (n: number) => String(n).padStart(2, '0');
  return `Stand ${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
