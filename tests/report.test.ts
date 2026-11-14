import { describe, expect, it } from 'vitest';
import { compareInstallTimes } from '../src/core/compare';
import { keyEvents } from '../src/core/events';
import { runAll } from '../src/core/simulation';
import type { Inputs } from '../src/core/types';
import { SECTIONS } from '../src/ui/fields';
import { fieldText, REPORT_CHARTS, reportHtml } from '../src/ui/report';
import { defaults, TODAY } from './helpers';

/** F30 printable report. */
const report = (mut?: (i: Inputs) => void) => {
  const i = defaults();
  mut?.(i);
  const run = runAll(i);
  return reportHtml({
    inputs: i,
    defaults: defaults(),
    run,
    cmp: compareInstallTimes(i),
    events: keyEvents(i, run),
    today: TODAY,
    url: 'https://example.invalid/',
    detailsHtml: '<div class="card"><h3>KfW-Zuschuss (458)</h3></div>',
  });
};
const field = (path: string) => SECTIONS.flatMap((s) => s.fields).find((f) => f.path === path)!;

describe('F30 Bericht', () => {
  it('enthält alle Abschnitte, Diagramm-Platzhalter, Haftungshinweis und Adresse ohne Eingaben', () => {
    const html = report();
    for (const h of ['Ergebnis', 'Haus und Wärmepumpe', 'Diagramme', 'Förderung und Finanzierung', 'Wichtige Ereignisse und Hinweise', 'Eingaben']) {
      expect(html, h).toContain(`<h2>${h}</h2>`);
    }
    for (const [id] of REPORT_CHARTS) expect(html).toContain(`data-report-chart="${id}"`);
    expect(html).toContain('Stand 11.11.2026');
    // logo (F23) in the header, decorative
    expect(html).toMatch(/<header class="report-head">\s*<svg class="report-logo"[^>]*aria-hidden="true"/);
    expect(html).toContain('Ersparnis mit WP');
    expect(html).toContain('CO₂-Einsparung');
    expect(html).toContain('KfW-Zuschuss (458)');
    expect(html).toContain('ohne Gewähr');
    expect(html).toContain('https://example.invalid/');
    expect(html).not.toContain('<h2>Bemerkungen</h2>');
  });

  it('Bezeichnung und Bemerkungen werden maskiert', () => {
    const html = report((i) => {
      i.scenario.name = 'Angebot <A>';
      i.scenario.notes = 'Firma "X" & Söhne';
    });
    expect(html).toContain('<strong>Angebot &lt;A&gt;</strong>');
    expect(html).toContain('Firma &quot;X&quot; &amp; Söhne');
    expect(html).not.toContain('<A>');
  });

  it('Eingaben: sichtbare Felder; Experten-Abschnitte nur mit Abweichungen', () => {
    expect(report()).not.toContain('<h3>Experten');
    const changed = report((i) => (i.general.vat = 0.07));
    expect(changed).toMatch(/<h3>Experten: Steuerbonus § 35c &amp; Konstanten<\/h3><dl><dt>Mehrwertsteuer<\/dt><dd>7 %<\/dd><\/dl>/);
    // hidden fields (no PV) do not appear
    expect(report()).not.toContain('Batteriespeicher');
    expect(report((i) => (i.heatPump.pvKwp = 8))).toContain('Batteriespeicher');
  });

  it('Feldwerte: Zahl mit Einheit, Prozent, ja/nein, Auswahl, Monat', () => {
    const i = defaults();
    expect(fieldText(field('heatPump.investment'), i)).toBe('32.000 €');
    expect(fieldText(field('heatPump.eligibleShare'), i)).toBe('100 %');
    expect(fieldText(field('heatPump.euOrigin'), i)).toMatch(/^(ja|nein)$/);
    expect(fieldText(field('oldHeating.fuel'), i)).toBe('Erdgas');
    expect(fieldText(field('heatPump.installMonth'), i)).toMatch(/^\d{2}\/\d{4}$/);
    // years without thousands separator
    i.building.constructionYear = 1950;
    expect(fieldText(field('building.constructionYear'), i)).toBe('1950');
    i.building.heatedArea = 1200;
    expect(fieldText(field('building.heatedArea'), i)).toBe('1.200 m²');
  });
});
