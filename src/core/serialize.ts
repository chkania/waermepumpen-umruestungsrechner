import type { Inputs } from './types';

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Mischt einen (teilweisen, evtl. fremden) Datenstand in die Defaults.
 * Nur bekannte Schlüssel mit passendem Typ werden übernommen (F9.3).
 */
export function mergeInputs(defaults: Inputs, data: unknown): Inputs {
  return mergeObj(defaults as unknown as Obj, data) as unknown as Inputs;
}

function mergeObj(base: Obj, data: unknown): Obj {
  const out: Obj = {};
  const src = isObj(data) ? data : {};
  for (const [k, def] of Object.entries(base)) {
    const v = src[k];
    if (isObj(def)) out[k] = mergeObj(def, v);
    else if (typeof def === 'number') out[k] = typeof v === 'number' && Number.isFinite(v) ? v : def;
    else if (v !== undefined && typeof v === typeof def) out[k] = v;
    else out[k] = def;
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
export function decodeHash(defaults: Inputs, hash: string): Inputs | null {
  const m = /[#&]s=([A-Za-z0-9_-]+)/.exec(hash);
  if (!m) return null;
  try {
    const data = JSON.parse(fromBase64Url(m[1]));
    if (!isObj(data)) return null;
    return mergeInputs(defaults, data);
  } catch {
    return null;
  }
}

export function exportJson(inputs: Inputs): string {
  return JSON.stringify(inputs, null, 2);
}

/** Import einer JSON-Datei; wirft bei ungültigem Inhalt (F9.3). */
export function importJson(defaults: Inputs, text: string): Inputs {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Die Datei enthält kein gültiges JSON.');
  }
  if (!isObj(data) || data.version !== 1) {
    throw new Error('Die Datei ist kein Datensatz dieses Rechners (version 1).');
  }
  return mergeInputs(defaults, data);
}
