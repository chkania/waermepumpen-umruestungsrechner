import type { Inputs } from './types';
import { deflateSync, Inflate } from 'fflate';
import { APP_VERSION } from '../version';
import { checkValue, type InputIssue } from './validate';

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Merges a (partial, possibly foreign) data set into the defaults.
 * Only known keys with a matching type are adopted (F9.3); values are validated and
 * clamped or replaced by the default if necessary (F9.5). Findings end up in `issues`.
 */
export function mergeInputs(defaults: Inputs, data: unknown, issues: InputIssue[] = []): Inputs {
  return mergeObj(defaults as unknown as Obj, migrate(defaults, data, issues), '', issues) as unknown as Inputs;
}

/**
 * Migrates older data sets: building age (years) → construction year (F17);
 * fixed PV share (PV-Anteil) → notice, because PV is now calculated from the PV system (F28).
 */
function migrate(defaults: Inputs, data: unknown, issues: InputIssue[]): unknown {
  if (isObj(data) && isObj(data.heatPump)) {
    const share = data.heatPump.pvShare;
    if (typeof share === 'number' && share > 0 && data.heatPump.pvKwp === undefined) {
      issues.push({
        path: 'heatPump.pvKwp',
        reason: `der feste PV-Anteil (${Math.round(share * 100)} %) wird nicht mehr verwendet – bitte Leistung der PV-Anlage eintragen; bis dahin ohne PV gerechnet`,
      });
    }
  }
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

/** Only the differences from the defaults (for short links). */
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

function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

/** Upper limit for the unpacked link content – protects against "zip bombs" in manipulated links. */
export const MAX_LINK_JSON_BYTES = 256 * 1024;

/** Inflates raw DEFLATE data, aborting as soon as the output exceeds the limit. */
function inflateLimited(data: Uint8Array): Uint8Array {
  const chunks: Uint8Array[] = [];
  let total = 0;
  const inflater = new Inflate((chunk) => {
    total += chunk.length;
    if (total > MAX_LINK_JSON_BYTES) throw new Error('Link-Inhalt zu groß');
    chunks.push(chunk);
  });
  inflater.push(data, true);
  const out = new Uint8Array(total);
  let pos = 0;
  for (const c of chunks) {
    out.set(c, pos);
    pos += c.length;
  }
  return out;
}

/**
 * Creates the URL hash "#z=…" (F9.2): differences from the defaults as JSON, compressed (raw DEFLATE) and
 * Base64URL-encoded – about half as long as the former uncompressed "#s=…" (short enough for a QR code, F30.3).
 */
export function encodeHash(defaults: Inputs, inputs: Inputs): string {
  const json = new TextEncoder().encode(JSON.stringify(diffInputs(defaults, inputs)));
  return '#z=' + bytesToBase64Url(deflateSync(json, { level: 9 }));
}

/** Reads a URL hash ("#z=…" compressed or older "#s=…" uncompressed); null for missing/invalid content. */
export function decodeHash(defaults: Inputs, hash: string, issues: InputIssue[] = []): Inputs | null {
  const m = /[#&]([sz])=([A-Za-z0-9_-]+)/.exec(hash);
  if (!m) return null;
  try {
    const raw = base64UrlToBytes(m[2]);
    if (m[1] === 's' && raw.length > MAX_LINK_JSON_BYTES) return null;
    const data = JSON.parse(new TextDecoder().decode(m[1] === 'z' ? inflateLimited(raw) : raw));
    if (!isObj(data)) return null;
    return mergeInputs(defaults, data, issues);
  } catch {
    return null;
  }
}

/** File-name-safe part of the scenario name (umlauts transliterated, max. 60 characters). */
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

/** Export file name: waermepumpe-rechner[-name]-YYYY-MM.json (F16.2). */
export function exportFileName(inputs: Inputs, now: Date): string {
  const slug = fileSlug(inputs.scenario?.name ?? '');
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  return `waermepumpe-rechner-${slug ? slug + '-' : ''}${month}.json`;
}

export function exportJson(inputs: Inputs): string {
  // App version for traceability (N9); ignored on import
  const { version, ...rest } = inputs;
  return JSON.stringify({ version, appVersion: APP_VERSION, ...rest }, null, 2);
}

/** Imports a JSON file; throws on invalid content (F9.3). */
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
