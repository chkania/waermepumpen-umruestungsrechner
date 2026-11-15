import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { createDefaults } from '../src/core/defaults';
import { DEFAULT_SOURCES } from '../src/core/sources';
import { SECTIONS } from '../src/ui/fields';
import Anthropic from '@anthropic-ai/sdk';
import { checkGroups, errorText, isFatalApiError, MAX_SOURCE_CHARS, MODEL } from '../scripts/assumptions-agent/check';
import { fetchSource } from '../scripts/assumptions-agent/fetch-source';
import {
  ANSWER_SCHEMA,
  buildReport,
  buildTask,
  collectItems,
  formatValue,
  groupBySource,
  htmlToText,
  parseAnswer,
  quoteInText,
  type SourceGroup,
} from '../scripts/assumptions-agent/lib';
import { REVIEW_KINDS } from '../scripts/assumptions-lib';
import { TODAY } from './helpers';

const items = collectItems(SECTIONS, DEFAULT_SOURCES, createDefaults(TODAY));
const group = (paths: string[], url = 'https://example.org/q'): SourceGroup => ({
  url,
  items: paths.map((p) => ({ ...items.find((i) => i.path === p)!, url })),
});
const answer = (results: object[]) => JSON.stringify({ results });

describe('F22.3 Vorprüfung der Annahmen – Auswahl und Darstellung', () => {
  it('prüft genau die zeitkritischen Standardwerte mit Quell-Link aus sources.ts', () => {
    expect(items.length).toBeGreaterThan(30);
    for (const it of items) {
      expect(REVIEW_KINDS).toContain(it.kind);
      expect(it.url).toMatch(/^https:\/\//);
    }
    const paths = items.map((i) => i.path);
    expect(paths).toContain('funding.grundRate');
    expect(paths).toContain('tax.maxBonus');
    expect(new Set(paths).size).toBe(paths.length);
    expect(collectItems(SECTIONS, DEFAULT_SOURCES, createDefaults(TODAY), 'tax.').every((i) => i.path.startsWith('tax.'))).toBe(true);
  });

  it('zeigt Werte wie das Formular (Prozent als Anteil, deutsche Zahlen, Einheit)', () => {
    expect(items.find((i) => i.path === 'funding.grundRate')!.value).toBe('30 %');
    expect(items.find((i) => i.path === 'tax.maxBonus')!.value).toBe('40.000 €');
    expect(formatValue({ path: 'x', label: 'x', type: 'percent', unit: '%-Pkt.' }, 0.04, {})).toBe('4 %-Pkt.');
    expect(formatValue({ path: 'x', label: 'x', type: 'checkbox' }, true, {})).toBe('ja');
    expect(formatValue({ path: 'x', label: 'x', type: 'number', unit: () => 'ct/kWh' }, 12.23, {})).toBe('12,23 ct/kWh');
  });

  it('fasst Werte je Quelle zusammen (eine Anfrage pro Quelle)', () => {
    const groups = groupBySource(items);
    expect(groups.reduce((n, g) => n + g.items.length, 0)).toBe(items.length);
    expect(new Set(groups.map((g) => g.url)).size).toBe(groups.length);
    const task = buildTask(group(['funding.grundRate', 'funding.maxRate']));
    expect(task).toContain('path: funding.grundRate');
    expect(task).toContain('Standardwert im Rechner: 30 %');
  });

  it('macht aus HTML lesbaren Text ohne Skripte und Tags', () => {
    const html = '<html><head><style>p{}</style><script>var x="<b>";</script></head><body><h1>KfW&nbsp;458</h1><p>Grundförderung &amp; Bonus: 30&#160;%</p><!-- x --></body></html>';
    expect(htmlToText(html)).toBe('KfW 458\nGrundförderung & Bonus: 30 %');
    // soft hyphens and zero-width joiners (as on the KfW pages) disappear, so quotes match
    expect(htmlToText('<p>Kredit&shy;betrag \u00adbis&zwj; &zwnj;90.000 Euro</p>')).toBe('Kreditbetrag bis 90.000 Euro');
  });
});

describe('F22.3 Vorprüfung der Annahmen – Antwort und Beleg', () => {
  it('Antwortschema verlangt für jeden Wert Urteil, Quellwert, Zitat und Hinweis', () => {
    expect(ANSWER_SCHEMA.properties.results.items.required).toEqual(['path', 'verdict', 'sourceValue', 'quote', 'note']);
    expect(ANSWER_SCHEMA.properties.results.items.additionalProperties).toBe(false);
  });

  it('wertet die Antwort aus; fehlende oder unbekannte Werte gehen nicht verloren', () => {
    const g = group(['funding.grundRate', 'funding.maxRate']);
    const findings = parseAnswer(
      answer([
        { path: 'funding.grundRate', verdict: 'bestaetigt', sourceValue: '30 %', quote: 'Grundförderung von 30 Prozent', note: '' },
        { path: 'unbekannt', verdict: 'abweichung', sourceValue: '', quote: '', note: '' },
      ]),
      g,
    );
    expect(findings.map((f) => [f.path, f.verdict])).toEqual([
      ['funding.grundRate', 'bestaetigt'],
      ['funding.maxRate', 'unklar'],
    ]);
    expect(() => parseAnswer('kein json', g)).toThrow(/kein gültiges JSON/);
    expect(() => parseAnswer('{}', g)).toThrow(/results/);
  });

  it('Zitat muss wörtlich in der Quelle stehen (Schreibweise von Anführungszeichen und Leerraum egal)', () => {
    const text = 'Die Grundförderung beträgt   30 Prozent der „förderfähigen Kosten“.';
    expect(quoteInText('Grundförderung beträgt 30 Prozent der "förderfähigen Kosten"', text)).toBe(true);
    expect(quoteInText('Grundförderung beträgt 35 Prozent', text)).toBe(false);
    expect(quoteInText('30', text)).toBe(false); // too short to be evidence
  });
});

describe('F22.3 Vorprüfung der Annahmen – Ablauf und Bericht', () => {
  const g = group(['funding.grundRate', 'funding.maxRate'], 'https://example.org/kfw');
  const sourceText = 'Grundförderung: 30 Prozent. Höchstfördersatz: 75 Prozent.';

  it('Ablauf: Abweichung mit Beleg, erfundenes Zitat wird zu „unklar“, nicht abrufbare Quelle wird gemeldet', async () => {
    const ask = vi.fn(async () =>
      answer([
        { path: 'funding.grundRate', verdict: 'bestaetigt', sourceValue: '30 %', quote: 'Grundförderung: 30 Prozent', note: '' },
        { path: 'funding.maxRate', verdict: 'abweichung', sourceValue: '75 %', quote: 'Höchstfördersatz: 80 Prozent', note: '' },
      ]),
    );
    const bad = group(['tax.maxBonus'], 'https://example.org/offline');
    const { checked, failed } = await checkGroups([g, bad], {
      fetchSource: async (url) => {
        if (url.includes('offline')) throw new Error('nicht abrufbar (HTTP 503)');
        return { kind: 'text', text: sourceText };
      },
      ask,
    });
    expect(ask).toHaveBeenCalledTimes(1);
    expect(checked.map((c) => [c.path, c.finding.verdict, c.quoteVerified])).toEqual([
      ['funding.grundRate', 'bestaetigt', true],
      ['funding.maxRate', 'unklar', false],
    ]);
    expect(checked[1].finding.note).toMatch(/Zitat nicht in der Quelle gefunden/);
    expect(failed).toEqual([{ url: 'https://example.org/offline', items: bad.items, stage: 'download', error: 'nicht abrufbar (HTTP 503)' }]);

    const report = buildReport({ date: '2026-11-15', model: MODEL, lastReview: '2026-11-11', checked, failed });
    expect(report).toContain('**0** Abweichung(en) · **1** unklar · **1** nicht abrufbar · **0** Prüfung fehlgeschlagen · **1** bestätigt');
    expect(report).toContain('## Unklar (bitte von Hand prüfen)');
    expect(report).toContain('## Quelle nicht abrufbar');
    expect(report.indexOf('## Unklar')).toBeLessThan(report.indexOf('## Bestätigt'));
    expect(report).toContain('Der Bericht ändert nichts.');
  });

  it('PDF-Quellen: kein Zitatabgleich möglich; zu große Seiten werden gemeldet statt gekürzt', async () => {
    const ask = async () =>
      answer([
        { path: 'funding.grundRate', verdict: 'abweichung', sourceValue: '15 %', quote: 'Grundförderung 15 %', note: 'ab 2027' },
        { path: 'funding.maxRate', verdict: 'bestaetigt', sourceValue: '70 %', quote: 'Höchstsatz 70 %', note: '' },
      ]);
    const pdf = await checkGroups([g], { fetchSource: async () => ({ kind: 'pdf', base64: 'JVBERi0=' }), ask });
    expect(pdf.checked.map((c) => [c.finding.verdict, c.quoteVerified])).toEqual([
      ['abweichung', null],
      ['bestaetigt', null],
    ]);
    const report = buildReport({ date: '2026-11-15', model: MODEL, lastReview: '2026-11-11', checked: pdf.checked, failed: [] });
    expect(report).toMatch(/## Abweichungen[\s\S]*Grundförderung[\s\S]*„Grundförderung 15 %“ ab 2027/);

    const big = await checkGroups([g], { fetchSource: async () => ({ kind: 'text', text: 'x'.repeat(MAX_SOURCE_CHARS + 1) }), ask });
    expect(big.failed[0].error).toMatch(/Quelle zu groß/);
  });

  it('API-Fehler: Anmeldung/Guthaben bricht den Lauf ab, andere Fehler stehen getrennt von Download-Fehlern', async () => {
    const apiError = (status: number, message: string) =>
      Anthropic.APIError.generate(status, { type: 'error', error: { type: 'invalid_request_error', message } }, undefined, new Headers());
    const credit = apiError(400, 'Your credit balance is too low to access the Anthropic API.');
    const other = apiError(400, 'prompt is too long');
    expect(isFatalApiError(credit)).toBe(true);
    expect(isFatalApiError(apiError(401, 'invalid x-api-key'))).toBe(true);
    expect(isFatalApiError(other)).toBe(false);
    expect(errorText(other)).toBe('Claude-API 400: prompt is too long');

    const fetchOk = async () => ({ kind: 'text' as const, text: sourceText });
    const ask = vi.fn(async () => {
      throw credit;
    });
    await expect(checkGroups([g, g], { fetchSource: fetchOk, ask, isFatal: isFatalApiError })).rejects.toBe(credit);
    expect(ask).toHaveBeenCalledTimes(1);

    const res = await checkGroups([g], { fetchSource: fetchOk, ask: async () => { throw other; }, isFatal: isFatalApiError });
    expect(res.failed).toEqual([{ url: g.url, items: g.items, stage: 'check', error: 'Claude-API 400: prompt is too long' }]);
    const report = buildReport({ date: '2026-11-15', model: MODEL, lastReview: '2026-11-11', checked: [], failed: res.failed });
    expect(report).toContain('## Prüfung fehlgeschlagen');
    expect(report).not.toContain('## Quelle nicht abrufbar');
  });

  it('Download: HTML wird Text, PDF bleibt binär, Wiederholung nur bei Server-Fehlern', async () => {
    const res = (status: number, body: string, type: string) => new Response(body, { status, headers: { 'content-type': type } });
    const sleep = vi.fn(async () => undefined);
    const html = vi.fn(async () => res(200, '<p>Hallo&nbsp;Welt</p>', 'text/html; charset=utf-8'));
    expect(await fetchSource('https://example.org/', { fetchImpl: html as typeof fetch, sleep })).toEqual({ kind: 'text', text: 'Hallo Welt' });
    const pdf = vi.fn(async () => res(200, '%PDF', 'application/pdf'));
    expect(await fetchSource('https://example.org/a', { fetchImpl: pdf as typeof fetch, sleep })).toEqual({ kind: 'pdf', base64: 'JVBERg==' });

    let calls = 0;
    const flaky = vi.fn(async () => (++calls < 3 ? res(503, '', 'text/plain') : res(200, 'ok', 'text/plain')));
    expect(await fetchSource('https://example.org/b', { fetchImpl: flaky as typeof fetch, sleep })).toEqual({ kind: 'text', text: 'ok' });
    expect(sleep).toHaveBeenCalledTimes(2);

    const missing = vi.fn(async () => res(404, '', 'text/plain'));
    await expect(fetchSource('https://example.org/c', { fetchImpl: missing as typeof fetch, sleep })).rejects.toThrow('nicht abrufbar (HTTP 404)');
    expect(missing).toHaveBeenCalledTimes(1);
  });

  it('nur Bericht: das Werkzeug schreibt keine Quelldateien und nutzt ein aktuelles Modell', () => {
    const cli = readFileSync('scripts/verify-assumptions.ts', 'utf8');
    expect(cli).not.toMatch(/writeFileSync\([^)]*src\//);
    expect(cli).toMatch(/reports\/annahmen-/);
    expect(MODEL).toBe('claude-opus-5-5');
    expect(readFileSync('.gitignore', 'utf8')).toMatch(/^reports\/$/m);
    expect(readFileSync('.gitignore', 'utf8')).toMatch(/^\.env\.local$/m);
  });
});
