import { describe, expect, it } from 'vitest';
import { cleanDocuments, DOCUMENT_TITLE_MAX, DOCUMENT_URL_MAX, MAX_DOCUMENTS } from '../src/core/validate';
import { decodeHash, encodeHash } from '../src/core/serialize';
import { documentsHtml } from '../src/ui/report';
import { defaults } from './helpers';

describe('F16.4 Prüfung der Links zu Unterlagen', () => {
  it('übernimmt https- und http-Adressen mit Titel', () => {
    const issues: { path: string; reason: string }[] = [];
    const out = cleanDocuments([{ title: ' Angebot ', url: ' https://example.invalid/angebot.pdf ' }, { title: '', url: 'http://example.invalid/' }], issues);
    expect(out).toEqual([
      { title: 'Angebot', url: 'https://example.invalid/angebot.pdf' },
      { title: '', url: 'http://example.invalid/' },
    ]);
    expect(issues).toEqual([]);
  });

  it('verwirft andere Schemata, ungültige Einträge und zu lange Adressen mit Hinweis', () => {
    const issues: { path: string; reason: string }[] = [];
    const out = cleanDocuments(
      [
        { title: 'x', url: 'javascript:alert(1)' },
        { title: 'y', url: 'data:text/html,hi' },
        { title: 'z' },
        'kein Objekt',
        { title: 'lang', url: `https://example.invalid/${'a'.repeat(DOCUMENT_URL_MAX)}` },
        { title: 'ok', url: 'https://example.invalid/ok' },
      ],
      issues,
    );
    expect(out).toEqual([{ title: 'ok', url: 'https://example.invalid/ok' }]);
    expect(issues.length).toBe(5);
  });

  it('begrenzt auf fünf Einträge und kürzt lange Titel', () => {
    const issues: { path: string; reason: string }[] = [];
    const many = Array.from({ length: 7 }, (_, i) => ({ title: 'T'.repeat(DOCUMENT_TITLE_MAX + 5), url: `https://example.invalid/${i}` }));
    const out = cleanDocuments(many, issues);
    expect(out.length).toBe(MAX_DOCUMENTS);
    expect(out[0].title.length).toBe(DOCUMENT_TITLE_MAX);
    expect(issues.some((i) => i.reason.includes('begrenzt'))).toBe(true);
  });

  it('fehlende Liste ist leer, eine Zeichenkette wird verworfen', () => {
    expect(cleanDocuments(undefined)).toEqual([]);
    const issues: { path: string; reason: string }[] = [];
    expect(cleanDocuments('https://example.invalid/', issues)).toEqual([]);
    expect(issues.length).toBe(1);
  });
});

describe('F16.4 Links reisen mit den Eingaben (Link, Export)', () => {
  it('Unterlagen stehen im Link und kommen beim Öffnen wieder', () => {
    const d = defaults();
    const i = defaults();
    i.scenario.documents = [{ title: 'Angebot', url: 'https://example.invalid/a.pdf' }];
    const back = decodeHash(defaults(), encodeHash(d, i));
    expect(back!.scenario.documents).toEqual([{ title: 'Angebot', url: 'https://example.invalid/a.pdf' }]);
  });

  it('ohne Unterlagen steht nichts im Link (kein Mehraufwand bei Standardwerten)', () => {
    const d = defaults();
    expect(encodeHash(d, defaults())).toBe(encodeHash(d, d));
    const withDocs = defaults();
    withDocs.scenario.documents = [{ title: '', url: 'https://example.invalid/' }];
    expect(encodeHash(d, withDocs).length).toBeGreaterThan(encodeHash(d, defaults()).length);
  });

  it('fremde Einträge aus einem Link werden geprüft', () => {
    const d = defaults();
    const i = defaults();
    i.scenario.documents = [{ title: 'x', url: 'https://example.invalid/' }];
    const issues: { path: string; reason: string }[] = [];
    const back = decodeHash(d, encodeHash(d, i), issues);
    expect(back!.scenario.documents.length).toBe(1);
  });
});

describe('F16.4 Bericht: Liste mit anklickbarer Adresse und QR-Code je Link', () => {
  it('jeder Link mit Titel, anklickbarer Adresse und QR-Code', () => {
    const html = documentsHtml([
      { title: 'Angebot', url: 'https://example.invalid/a.pdf' },
      { title: 'Datenblatt', url: 'https://example.invalid/b.pdf' },
    ]);
    expect(html).toContain('<h2>Unterlagen und Links</h2>');
    expect((html.match(/<a class="report-doc-link" href="https:\/\/example\.invalid\/[ab]\.pdf">/g) ?? []).length).toBe(2);
    expect((html.match(/<figure class="report-doc-qr"><svg class="qr"/g) ?? []).length).toBe(2);
    expect(html).toContain('<strong>Angebot</strong>');
  });

  it('ohne Unterlagen kein Abschnitt', () => {
    expect(documentsHtml([])).toBe('');
  });

  it('Titel und Adresse werden maskiert', () => {
    const html = documentsHtml([{ title: '<img src=x onerror=1>', url: 'https://example.invalid/?a=<b>&c' }]);
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
    expect(html).toContain('&lt;b&gt;');
  });

  it('zu lange Adresse: Hinweis statt QR-Code, Link bleibt', () => {
    // longer than the QR code can hold (about 2,950 bytes at the lowest error correction)
    const long = `https://example.invalid/${'x'.repeat(3100)}`;
    const html = documentsHtml([{ title: 'lang', url: long }]);
    expect(html).toContain('Adresse zu lang für einen QR-Code');
    expect(html).toContain('class="report-doc-link"');
  });
});
