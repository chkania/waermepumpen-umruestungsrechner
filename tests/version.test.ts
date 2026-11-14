import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { exportJson, importJson } from '../src/core/serialize';
import { APP_VERSION } from '../src/version';
import { defaults } from './helpers';

const read = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

describe('N9 Versionierung', () => {
  it('Semantic Versioning, Quelle package.json', () => {
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    expect(APP_VERSION).toBe(JSON.parse(read('package.json')).version);
  });

  it('CHANGELOG: aktuelle Version als neueste Version mit Datum, kein „Unveröffentlicht“ (Trunk-Based)', () => {
    const log = read('CHANGELOG.md');
    const versions = [...log.matchAll(/^## (\d+\.\d+\.\d+) – (\d{4}-\d{2}-\d{2})$/gm)].map((m) => m[1]);
    expect(log).not.toMatch(/^## Unveröffentlicht/m);
    // nach dem Einleitungstext folgt direkt die neueste Version
    expect(log.match(/^## .*$/m)![0]).toBe(`## ${APP_VERSION} – ${log.match(/^## \S+ – (\S+)$/m)![1]}`);
    expect(versions[0]).toBe(APP_VERSION);
    // absteigend sortiert, keine doppelten Versionen
    const num = (v: string) => v.split('.').reduce((a, x) => a * 1000 + Number(x), 0);
    expect(versions.map(num)).toEqual([...versions.map(num)].sort((a, b) => b - a));
    expect(new Set(versions).size).toBe(versions.length);
  });

  it('Export enthält die Programmversion, Import ignoriert sie', () => {
    const text = exportJson(defaults());
    expect(JSON.parse(text).appVersion).toBe(APP_VERSION);
    expect(importJson(defaults(), text)).toEqual(defaults());
  });
});
