// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { compareInstallTimes } from '../src/core/compare';
import { keyEvents } from '../src/core/events';
import { createSimContext, runAll } from '../src/core/simulation';
import { sensitivity } from '../src/core/sensitivity';
import { DEFAULT_SOURCES, OFFICIAL_REFS } from '../src/core/sources';
import { sourcePopHtml } from '../src/ui/app';
import { safeHref } from '../src/ui/format';
import { qrSvg } from '../src/ui/qr';
import { reportHtml } from '../src/ui/report';
import { defaults, TODAY } from './helpers';

describe('Review: gemeinsamer SimContext', () => {
  it('vorberechneter Kontext ändert kein Ergebnis', () => {
    const i = defaults();
    expect(runAll(i, createSimContext(i))).toEqual(runAll(i));
  });

  it('Vergleich und Sensitivität liefern mit Basis-Lauf dieselben Ergebnisse', () => {
    const i = defaults();
    const run = runAll(i);
    expect(compareInstallTimes(i, run)).toEqual(compareInstallTimes(i));
    expect(sensitivity(i, run)).toEqual(sensitivity(i));
    expect(keyEvents(i, run)).toEqual(keyEvents(i, runAll(i)));
  });
});

describe('Review: sichere externe Links und Maskierung', () => {
  it('safeHref erlaubt nur http(s) und maskiert Attribute', () => {
    expect(safeHref('https://example.com/?a=1&b=2')).toBe('https://example.com/?a=1&amp;b=2');
    expect(safeHref('http://example.com/')).toBe('http://example.com/');
    expect(safeHref('javascript:alert(1)')).toBe('#');
    expect(safeHref('data:text/html,<script>alert(1)</script>')).toBe('#');
    expect(safeHref('kein-link')).toBe('#');
  });

  it('Quellen-Popover maskiert URL und Stand und blockt fremde Schemata', () => {
    const path = 'prices.gasPriceCt';
    const original = DEFAULT_SOURCES[path];
    try {
      DEFAULT_SOURCES[path] = { ...original, url: 'javascript:alert(1)', asOf: '"><img src=x>' };
      const html = sourcePopHtml(path, defaults());
      expect(html).not.toContain('javascript:');
      expect(html).toContain('href="#"');
      expect(html).toContain('Stand &quot;&gt;&lt;img src=x&gt;');
    } finally {
      DEFAULT_SOURCES[path] = original;
    }
  });

  it('offizielle Quellen maskieren Label und URL', () => {
    const path = 'prices.co2Path';
    const original = OFFICIAL_REFS[path];
    try {
      OFFICIAL_REFS[path] = [{ label: '<b>Quelle</b>', url: 'javascript:alert(1)' }];
      const html = sourcePopHtml(path, defaults());
      expect(html).not.toContain('<b>Quelle</b>');
      expect(html).toContain('&lt;b&gt;Quelle&lt;/b&gt;');
      expect(html).not.toContain('javascript:');
      expect(html).toContain('href="#"');
    } finally {
      OFFICIAL_REFS[path] = original;
    }
  });

  it('QR-Code maskiert den aria-label', () => {
    const svg = qrSvg('https://example.invalid/#s=abc', 'QR "Test" <x>')!;
    expect(svg).toContain('aria-label="QR &quot;Test&quot; &lt;x&gt;"');
    expect(svg).not.toContain('<x>');
  });
});

describe('Review: Berichtsfuß ohne Zeitzonenverschiebung', () => {
  it('nennt das Prüfdatum als 11.11.2026', () => {
    const i = defaults();
    const run = runAll(i);
    const html = reportHtml({
      inputs: i,
      defaults: defaults(),
      run,
      cmp: compareInstallTimes(i),
      events: keyEvents(i, run),
      today: TODAY,
      url: 'https://example.invalid/',
      detailsHtml: '',
    });
    expect(html).toContain('geprüft am 11.11.2026');
    expect(html).not.toContain('10.11.2026');
  });
});
