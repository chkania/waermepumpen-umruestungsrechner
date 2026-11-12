import type { Inputs } from './types';
import { APP_VERSION } from '../version';
import { checkValue, type InputIssue } from './validate';

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Mischt einen (teilweisen, evtl. fremden) Datenstand in die Defaults.
 * Nur bekannte Schlüssel mit passendem Typ werden übernommen (F9.3); Werte werden geprüft und
 * ggf. begrenzt bzw. durch den Standardwert ersetzt (F9.5). Befunde landen in `issues`.
 */
export function mergeInputs(defaults: Inputs, data: unknown, issues: InputIssue[] = []): Inputs {
  return mergeObj(defaults as unknown as Obj, migrate(defaults, data), '', issues) as unknown as Inputs;
}

/** Ältere Datenstände übernehmen: Gebäudealter (Jahre) → Baujahr (F17). */
function migrate(defaults: Inputs, data: unknown): unknown {
  if (!isObj(data) || !isObj(data.building)) return data;
  const b = data.building;
  if (typeof b.buildingAgeYears !== 'number' || b.constructionYear !== undefined || !Number.isFinite(b.buildingAgeYears)) return data;
  const g = isObj(data.general) ? data.general : {};
  const m = /^(\d{4})-/.exec(typeof g.startMonth === 'string' ? g.startMonth : defaults.general.startMonth);
  const startYear = m ? Number(m[1]) : Number(defaults.general.startMonth.slice(0, 4));
  return { ...data, building: { ...b, constructionYear: Math.round(startYear - b.buildingAgeYears) } };
}

function mergeObj(base: Obj, data: unknown, prefix: string, issues: InputIssue[]): Obj {
  const out: Obj = {};
  const src = isObj(data) ? data : {};
  for (const [k, def] of Object.entries(base)) {
    const path = prefix ? `${prefix}.${k}` : k;
    const v = Object.prototype.hasOwnProperty.call(src, k) ? src[k] : undefined;
    if (isObj(def)) {
      out[k] = mergeObj(def, v, path, issues);
      continue;
    }
    const typeOk = typeof def === 'number' ? typeof v === 'number' && Number.isFinite(v) : v !== undefined && typeof v === typeof def;
    if (!typeOk) {
      if (v !== undefined) issues.push({ path, reason: 'ungültiger Wert, Standardwert verwendet' });
      out[k] = def;
      continue;
    }
    if (path === 'version') {
      out[k] = def;
      continue;
    }
    const r = checkValue(path, v, def);
    if (r.issue) issues.push(r.issue);
    out[k] = r.value;
  }
  return out;
}

/** Nur die Abweichungen gegenüber den Defaults (für kurze Links). */
export function diffInputs(defaults: Inputs, inputs: Inputs): Obj {
  return diffObj(defaults as unknown as Obj, inputs as unknown as Obj);
}

function diffObj(base: Obj, cur: Obj): Obj {
  const out: Obj = {};
  for (const [k, def] of Object.entries(base)) {
    const v = cur[k];
    if (isObj(def) && isObj(v)) {
      const d = diffObj(def, v);
      if (Object.keys(d).length > 0) out[k] = d;
    } else if (v !== def) {
      out[k] = v;
    }
  }
  return out;
}

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): string {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** Erzeugt den URL-Hash "#s=…" (F9.2). */
export function encodeHash(defaults: Inputs, inputs: Inputs): string {
  return '#s=' + toBase64Url(JSON.stringify(diffInputs(defaults, inputs)));
}

/** Liest einen URL-Hash; null bei fehlendem/ungültigem Inhalt. */
export function decodeHash(defaults: Inputs, hash: string, issues: InputIssue[] = []): Inputs | null {
  const m = /[#&]s=([A-Za-z0-9_-]+)/.exec(hash);
  if (!m) return null;
  try {
    const data = JSON.parse(fromBase64Url(m[1]));
    if (!isObj(data)) return null;
    return mergeInputs(defaults, data, issues);
  } catch {
    return null;
  }
}

/** Dateinamen-tauglicher Teil aus der Szenario-Bezeichnung (Umlaute umschreiben, max. 60 Zeichen). */
export function fileSlug(text: string): string {
  return text
    .normalize('NFC')
    .replace(/Ä/g, 'Ae').replace(/Ö/g, 'Oe').replace(/Ü/g, 'Ue')
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');
}

/** Dateiname des Exports: waermepumpe-rechner[-bezeichnung]-JJJJ-MM.json (F16.2). */
export function exportFileName(inputs: Inputs, now: Date): string {
  const slug = fileSlug(inputs.scenario?.name ?? '');
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  return `waermepumpe-rechner-${slug ? slug + '-' : ''}${month}.json`;
}

export function exportJson(inputs: Inputs): string {
  // Programmversion zur Nachvollziehbarkeit (N9); beim Import ignoriert
  const { version, ...rest } = inputs;
  return JSON.stringify({ version, appVersion: APP_VERSION, ...rest }, null, 2);
}

/** Import einer JSON-Datei; wirft bei ungültigem Inhalt (F9.3). */
export function importJson(defaults: Inputs, text: string, issues: InputIssue[] = []): Inputs {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Die Datei enthält kein gültiges JSON.');
  }
  if (!isObj(data) || data.version !== 1) {
    throw new Error('Die Datei ist kein Datensatz dieses Rechners (version 1).');
  }
  return mergeInputs(defaults, data, issues);
}
