// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { compareInstallTimes } from '../src/core/compare';
import { keyEvents, type KeyEvent } from '../src/core/events';
import { runAll } from '../src/core/simulation';
import { DEFAULT_SOURCES, OFFICIAL_REFS } from '../src/core/sources';
import type { Inputs } from '../src/core/types';
import { sensitivity } from '../src/core/sensitivity';
import { agentMarkdown } from '../src/ui/agent-export';
import { derivationHtml } from '../src/ui/derivation';
import { fieldText, reportHtml } from '../src/ui/report';
import { SECTIONS } from '../src/ui/fields';
import { defaults, pinned, TODAY } from './helpers';

const events = (i: Inputs): KeyEvent[] => keyEvents(i, runAll(i)).hints;
const withRange = (code: string, hasChild = false): Inputs => {
  const i = pinned();
  i.building.ownerOccupied = true;
  i.building.incomeRange = code;
  i.building.hasChild = hasChild;
  return i;
};
const field = (path: string) => SECTIONS.flatMap((s) => s.fields).find((f) => f.path === path)!;

describe('F10.4 Hinweise zum Einkommensbereich', () => {
  it('F10.4 mit Bonus: Titel „Einkommensbonus 40 %“ und Text mit dem Bereich', () => {
    const h = events(withRange('0-30000')).find((e) => e.title === 'Einkommensbonus 40 %');
    expect(h?.detail).toBe('Einkommensbereich bis 30.000 €. Nachweis über die Steuerbescheide des 2. und 3. Jahres vor Antragstellung.');
  });

  it('F10.4 ohne Bonus: Titel „Kein Einkommensbonus“ mit Grenze und gewähltem Bereich', () => {
    const h = events(withRange('50001-60000')).find((e) => e.title === 'Kein Einkommensbonus');
    expect(h?.detail).toBe('Grenze 50.000 € zu versteuerndes Haushaltseinkommen, gewählter Bereich: über 50.000 bis 60.000 €.');
  });

  it('F10.4 ohne Bonus mit Kind: Grenze um 10.000 € erhöht (60.001–90.000 € erhält mit Kind keinen Bonus)', () => {
    const h = events(withRange('60001-90000', true)).find((e) => e.title === 'Kein Einkommensbonus');
    expect(h?.detail).toBe('Grenze 60.000 € zu versteuerndes Haushaltseinkommen, gewählter Bereich: über 60.000 bis 90.000 €.');
  });

  it('F10.4 KfW 359 aus Einkommensgründen: Bereich und Grenze 90.000 €', () => {
    const h = events(withRange('90001+')).find((e) => e.title === 'KfW-Kredit 359 statt zinsverbilligtem 358');
    expect(h?.detail).toBe('Einkommensbereich über 90.000 €, Grenze 90.000 €.');
  });

  it('F10.4 KfW 359 aus anderen Gründen (mehrere Wohneinheiten) bleibt ohne Einkommensangabe', () => {
    const i = withRange('60001-90000');
    i.building.units = 2;
    const h = events(i).find((e) => e.title === 'KfW-Kredit 359 statt zinsverbilligtem 358');
    expect(h?.detail).toBe('Zinsverbilligung nur für selbstgenutzte Ein-Wohneinheit-Gebäude.');
  });
});

describe('F32 Rechenweg und F35 KI-Export zeigen den Bereich', () => {
  it('F32 Einkommensbonus-Zeile zeigt die Bezeichnung, bei Kind mit „, mit Kind“', () => {
    const plain = derivationHtml(withRange('40001-50000'), 'hash').html;
    expect(plain).toContain('zu versteuerndes Haushaltseinkommen über 40.000 bis 50.000 €');
    expect(plain).not.toContain(', mit Kind');
    const child = derivationHtml(withRange('40001-50000', true), 'hash').html;
    expect(child).toContain('zu versteuerndes Haushaltseinkommen über 40.000 bis 50.000 €, mit Kind');
  });

  it('F32 Kredit-Abschnitt nutzt den Rechenwert für die Kreditvariante, der Text nennt kein Einkommen', () => {
    const html = derivationHtml(withRange('90001+'), 'hash').html;
    const loanText = html.split('Kreditbedarf = Investition')[1].split('</p>')[0];
    expect(loanText).toContain('KfW-Ergänzungskredit 359');
    expect(loanText).not.toContain('Einkommen');
  });

  it('F35 Agenten-Hinweis heißt „Haushaltseinkommen (Einkommensbereich)“', () => {
    const i = defaults();
    const run = runAll(i);
    const md = agentMarkdown({
      inputs: i,
      defaults: defaults(),
      run,
      cmp: compareInstallTimes(i, run),
      events: keyEvents(i, run, TODAY),
      sens: sensitivity(i, run),
      today: TODAY,
      url: 'https://example.invalid/',
      shareUrl: 'https://short.invalid/',
    });
    expect(md).toContain('Haushaltseinkommen (Einkommensbereich) und Steuerschuld sollten eigene Werte sein.');
    expect(md).toContain('"incomeRange": "50001-60000"');
    expect(md).not.toContain('householdIncome');
  });

  it('F35 generische Feldausgabe zeigt Code und Bezeichnung des Bereichs', () => {
    const i = withRange('30001-40000');
    expect(fieldText(field('building.incomeRange'), i)).toContain('über 30.000 bis 40.000 €');
  });
});

describe('F30 Bericht zeigt die Bezeichnung des Bereichs', () => {
  it('F30 Eingabenliste nennt die Bezeichnung statt des Codes', () => {
    const i = withRange('60001-90000');
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
    expect(html).toContain('<dt>Zu versteuerndes Haushaltseinkommen</dt><dd>über 60.000 bis 90.000 €</dd>');
  });
});

describe('F11 Herkunftstext des Einkommensbereichs', () => {
  it('F11 Schlüssel building.incomeRange in DEFAULT_SOURCES und OFFICIAL_REFS, Fundstellen bleiben', () => {
    expect(DEFAULT_SOURCES['building.householdIncome']).toBeUndefined();
    expect(DEFAULT_SOURCES['building.incomeRange'].kind).toBe('beispiel');
    expect(DEFAULT_SOURCES['building.incomeRange'].text).toBe(
      'Beispielbereich (ohne Einkommensbonus). Maßgeblich ist der Durchschnitt der zu versteuernden Einkommen des 2. und 3. Jahres vor Antragseingang (Antrag 2026 → 2023 und 2024) aller im Haushalt gemeldeten Eigentümer und deren Partner; Minderjährige zählen nicht. Nachweis nur per Einkommensteuerbescheid. Bitte den Bereich wählen, der zu Ihrem Durchschnitt passt.',
    );
    expect(OFFICIAL_REFS['building.incomeRange'].length).toBe(3);
  });
});
