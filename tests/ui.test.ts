// @vitest-environment happy-dom
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SECTIONS, getPath } from '../src/ui/fields';
import { INTRO_KEY, LEGACY_DESIGN_KEY, mountApp, PRIVACY_ACK_KEY, STORAGE_KEY, THEME_KEY } from '../src/ui/app';
import { decodeHash, encodeHash } from '../src/core/serialize';
import { APP_VERSION } from '../src/version';
import { defaults, TODAY } from './helpers';

class MemoryStorage implements Storage {
  private m = new Map<string, string>();
  get length() { return this.m.size; }
  clear() { this.m.clear(); }
  getItem(k: string) { return this.m.get(k) ?? null; }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  removeItem(k: string) { this.m.delete(k); }
  setItem(k: string, v: string) { this.m.set(k, String(v)); }
}
const store = new MemoryStorage();

function mount() {
  document.body.innerHTML = '<div id="app"></div>';
  const root = document.getElementById('app')!;
  const app = mountApp(root, { storage: store, today: TODAY, debounceMs: 0 });
  return { root, app };
}

function setValue(root: HTMLElement, path: string, value: string) {
  const el = root.querySelector<HTMLInputElement | HTMLSelectElement>(`[data-path="${path}"]`)!;
  el.value = value;
  el.dispatchEvent(new Event('change', { bubbles: true }));
  return el;
}

describe('UI (Smoke-Test)', () => {
  beforeEach(() => {
    store.clear();
    history.replaceState(null, '', '/');
  });

  it('jedes Feld der Feldliste existiert in den Inputs (Konsistenz)', () => {
    const d = defaults();
    for (const s of SECTIONS) for (const f of s.fields) expect(getPath(d, f.path), f.path).not.toBeUndefined();
  });

  it('rendert Kennzahlen, Förderdetails und Tabellen', () => {
    const { root } = mount();
    const kpis = root.querySelector('#kpis')!.textContent!;
    expect(kpis).toContain('Ohne Wärmepumpe');
    expect(kpis).toMatch(/12\.880/);
    expect(root.querySelector('#details')!.textContent).toContain('Klimageschwindigkeitsbonus');
    expect(root.querySelectorAll('#install-table > table > tbody > tr')).toHaveLength(9);
    // F7.3 explanation of the cheapest point in time
    const why = root.querySelector('#install-table .best-why')!;
    const bestMonth = root.querySelector('#install-table tr.best td')!.textContent!.replace('günstigster', '').trim();
    expect(why.querySelector('h3')!.textContent).toBe(`Warum ist ${bestMonth} am günstigsten?`);
    expect(why.textContent).toContain('Jahresheizbedarfs');
    expect(why.querySelector('tr.sum')).not.toBeNull();
    expect(root.querySelectorAll('#year-table tbody tr').length).toBe(21); // 2026 … 2046
    // F19 invitation to contribute and repository link
    const contribute = root.querySelector('.contribute')!;
    expect(contribute.querySelector('h2')!.textContent).toBe('Mitmachen');
    expect(contribute.querySelector('a[href$="/issues/new?template=bug_report.yml"]')!.textContent).toBe('Melde ihn');
    expect(contribute.querySelector('a[href$="/issues/new?template=feature_request.yml"]')!.textContent).toBe('Schlag sie vor');
    expect(contribute.querySelector('a[href$="/CONTRIBUTING.md"]')).not.toBeNull();
    // F19.4 voluntary support: plain links, new tab, no embedded widgets/images
    expect(contribute.querySelector<HTMLAnchorElement>('a[href="https://buymeacoffee.com/chkania"]')!.textContent).toBe('Buy me a coffee');
    const paypal = contribute.querySelector<HTMLAnchorElement>('a[href="https://paypal.me/ChristophKania"]')!;
    expect(paypal.textContent).toBe('PayPal');
    expect(paypal.target).toBe('_blank');
    expect(contribute.querySelector('img, iframe, script')).toBeNull();
    // F19.4 toolbar button opens a dialog with the same links
    const support = root.querySelector<HTMLDialogElement>('#support')!;
    expect(support.open).toBe(false);
    root.querySelector<HTMLButtonElement>('#btn-support')!.click();
    expect(support.open).toBe(true);
    expect([...support.querySelectorAll<HTMLAnchorElement>('a.share-btn')].map((a) => [a.textContent, a.getAttribute('href'), a.target])).toEqual([
      ['Buy me a coffee', 'https://buymeacoffee.com/chkania', '_blank'],
      ['PayPal', 'https://paypal.me/ChristophKania', '_blank'],
    ]);
    expect(support.querySelector('img, iframe, script')).toBeNull();
    // F19.5 SEPA transfer: GiroCode generated locally, account details, copy button
    expect(support.querySelector('.support-qr svg[role="img"]')!.getAttribute('aria-label')).toContain('GiroCode');
    expect(support.querySelector('#support-iban')!.textContent).toBe('DE62 5002 4024 0752 9433 31');
    expect(support.textContent).toContain('Christoph Kania');
    support.close();
    const repo = root.querySelector<HTMLAnchorElement>('.disclaimer.license a[href^="https://github.com/chkania/"]')!;
    expect(repo.textContent).toBe('Quellcode auf GitHub');
    expect(repo.rel).toBe('noopener');
  });

  it('Eingabe ändert Ergebnis und wird gespeichert (F9.1)', () => {
    const { root, app } = mount();
    const before = app.lastResult()!.run.kfw.totalCost;
    setValue(root, 'heatPump.jaz', '4');
    expect(app.getInputs().heatPump.jaz).toBe(4);
    expect(app.lastResult()!.run.kfw.totalCost).toBeLessThan(before);
    expect(JSON.parse(store.getItem(STORAGE_KEY)!).heatPump.jaz).toBe(4);
  });

  it('Prozentfelder werden als Anteil gespeichert', () => {
    const { root, app } = mount();
    expect(root.querySelector<HTMLInputElement>('[data-path="oldHeating.efficiency"]')!.value).toBe('90');
    setValue(root, 'oldHeating.efficiency', '85');
    expect(app.getInputs().oldHeating.efficiency).toBe(0.85);
  });

  it('ungültige Eingabe wird markiert und nicht übernommen', () => {
    const { root, app } = mount();
    const el = setValue(root, 'heatPump.installMonth', '2027-13');
    expect(el.classList.contains('invalid')).toBe(true);
    expect(app.getInputs().heatPump.installMonth).toBe('2027-05');
  });

  it('Wechsel auf Heizöl rechnet Verbrauch um und blendet Felder um', () => {
    const { root, app } = mount();
    setValue(root, 'oldHeating.fuel', 'oil');
    expect(app.getInputs().oldHeating.consumption).toBe(2000);
    expect(root.querySelector<HTMLElement>('[data-field="prices.oilPriceEur"]')!.hidden).toBe(false);
    expect(root.querySelector<HTMLElement>('[data-field="prices.gasPriceCt"]')!.hidden).toBe(true);
    expect(root.querySelector('[data-field="oldHeating.consumption"] .unit')!.textContent).toBe('Liter');
  });

  it('gespeicherter Stand wird beim Laden wiederhergestellt', () => {
    const i = defaults();
    i.heatPump.investment = 25000;
    store.setItem(STORAGE_KEY, JSON.stringify(i));
    const { app, root } = mount();
    expect(app.getInputs().heatPump.investment).toBe(25000);
    expect(root.querySelector<HTMLInputElement>('[data-path="heatPump.investment"]')!.value).toBe('25000');
  });

  it('Jahrestabelle wechselt das Szenario', () => {
    const { root } = mount();
    const sel = root.querySelector<HTMLSelectElement>('#table-kind')!;
    sel.value = 'tax';
    sel.dispatchEvent(new Event('change'));
    expect(root.querySelector('#year-table thead')!.textContent).toContain('Steuer');
  });

  it('Zurücksetzen (F9.4) stellt Defaults her', () => {
    const { root, app } = mount();
    setValue(root, 'heatPump.jaz', '4.5');
    root.querySelector<HTMLButtonElement>('#btn-reset')!.click();
    // F9.8 first a warning, only the confirmation resets
    expect(app.getInputs().heatPump.jaz).toBe(4.5);
    expect(root.querySelector('#privacy-title')!.textContent).toBe('Alle Eingaben zurücksetzen?');
    root.querySelector<HTMLButtonElement>('#privacy-ok')!.click();
    expect(app.getInputs()).toEqual(defaults());
  });

  it('F10 zeigt wichtige Ereignisse, Hinweise und Ereignis-Spalte', () => {
    const i = defaults();
    i.oldHeating.ageYears = 16;
    store.setItem(STORAGE_KEY, JSON.stringify(i));
    const { root } = mount();
    const events = root.querySelector('#events')!.textContent!;
    expect(events).toContain('Klimageschwindigkeitsbonus nicht erreichbar');
    expect(events).toContain('Kauf eines neuen Kessels');
    expect(events).toContain('Letzte Steuererstattung');
    expect(root.querySelector('#events .hint.level-warning')).not.toBeNull();
    const sel = root.querySelector<HTMLSelectElement>('#table-kind')!;
    sel.value = 'ref';
    sel.dispatchEvent(new Event('change'));
    expect(root.querySelector('#year-table')!.textContent).toContain('Nov: Kauf eines neuen Kessels');
  });

  it('F10.6 Hinweis, wenn der Start der Betrachtung in der Zukunft liegt (Datum aus der App)', () => {
    const { root } = mount();
    const events = () => root.querySelector('#events')!.textContent!;
    expect(events()).not.toContain('Start der Betrachtung liegt in der Zukunft');
    setValue(root, 'general.startMonth', '2030-05');
    expect(events()).toContain('Start der Betrachtung liegt in der Zukunft (05/2030)');
  });

  it('Förderhinweise werden nicht doppelt als Warnung angezeigt', () => {
    const i = defaults();
    i.oldHeating.ageYears = 16;
    store.setItem(STORAGE_KEY, JSON.stringify(i));
    const { root } = mount();
    expect(root.querySelector('#warnings')!.textContent).not.toMatch(/Klimageschwindigkeitsbonus|Ersatzkessel/);
  });

  it('F11 Info-Button öffnet Herkunfts-Popover mit Standardwert, Escape schließt', () => {
    const { root } = mount();
    const btn = root.querySelector<HTMLButtonElement>('[data-field="oldHeating.replacementCost"] .info-btn')!;
    const pop = document.getElementById(btn.getAttribute('aria-controls')!)!;
    expect(pop.hidden).toBe(true);
    // N14: content is only created on first opening
    expect(pop.childElementCount).toBe(0);
    expect(root.querySelectorAll('.src-pop .src-head')).toHaveLength(0);
    btn.click();
    expect(pop.hidden).toBe(false);
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    expect(pop.textContent).toContain('Marktdaten');
    expect(pop.textContent).toContain('12.000 €');
    // only one popover at a time
    root.querySelector<HTMLButtonElement>('[data-field="funding.kgbRate"] .info-btn')!.click();
    expect(pop.hidden).toBe(true);
    const kgb = root.querySelector('[data-field="funding.kgbRate"] .src-pop')!;
    expect(kgb.textContent).toContain('16 %');
    const links = [...kgb.querySelectorAll('a')].map((a) => a.getAttribute('href'));
    expect(links.some((h) => h!.includes('bundesanzeiger.de'))).toBe(true);
    expect(links.some((h) => h!.includes('6000005131_M_458.pdf'))).toBe(true);
    expect(kgb.textContent).toContain('Nr. 8.4.4');
    root.querySelector<HTMLButtonElement>('[data-field="building.hasChild"] .info-btn')!.click();
    expect((kgb as HTMLElement).hidden).toBe(true);
    const child = root.querySelector<HTMLElement>('[data-field="building.hasChild"] .src-pop')!;
    expect(child.textContent).toContain('Nr. 8.4.5');
    expect(child.textContent).toContain('Kindergeldberechtigung');
    // reopening keeps the content (not rendered twice)
    btn.click();
    btn.click();
    expect(pop.querySelectorAll('.src-head')).toHaveLength(1);
    btn.click();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(pop.hidden).toBe(true);
    expect(child.hidden).toBe(true);
  });

  it('F13 Tarifvergleich wird angezeigt und reagiert auf Eingaben', () => {
    const { root } = mount();
    const card = () => root.querySelector('#tariff')!.textContent!;
    expect(card()).toContain('Mit Wärmepumpentarif');
    expect(card()).toContain('Ohne (Haushaltsstrom)');
    expect(root.querySelectorAll('#tariff tbody tr').length).toBeGreaterThan(10);
    expect(root.querySelector('[data-field="heatPump.householdPriceCt"]')!.hasAttribute('hidden')).toBe(false);
    setValue(root, 'heatPump.householdPriceCt', '20');
    expect(card()).toMatch(/ein eigener Zähler lohnt sich nicht/);
  });

  it('F13.6 Wallbox-Hinweis im Tarifvergleich', () => {
    const { root } = mount();
    const el = root.querySelector<HTMLInputElement>('[data-path="heatPump.existing14aOnHousehold"]')!;
    el.checked = true;
    el.dispatchEvent(new Event('change', { bubbles: true }));
    expect(root.querySelector('#tariff')!.textContent).toMatch(/nur einmal je Zähler/);
    expect(root.querySelector('#tariff')!.textContent).toMatch(/§ 14a schon für andere Einrichtung genutzt/);
  });

  it('F26 JAZ-Schätzung unter dem Feld, folgt den Heizflächen, Übernehmen setzt die Mitte', () => {
    const { root, app } = mount();
    const box = () => root.querySelector('#jaz-estimate')!.textContent!.replace(/\s+/g, ' ');
    expect(box()).toContain('JAZ 2,9–3,5');
    expect(box()).toContain('Vorlauf ca. 50 °C');
    const emitter = root.querySelector<HTMLSelectElement>('[data-path="heatPump.emitter"]')!;
    emitter.value = 'floor';
    emitter.dispatchEvent(new Event('change', { bubbles: true }));
    app.recalc();
    expect(box()).toContain('JAZ 3,6–4,2');
    expect(box()).toContain('liegt unter der Schätzung');
    root.querySelector<HTMLButtonElement>('[data-jaz-apply]')!.click();
    expect(app.getInputs().heatPump.jaz).toBe(3.9);
    expect(root.querySelector<HTMLInputElement>('[data-path="heatPump.jaz"]')!.value).toBe('3.9');
    expect(root.querySelector('[data-jaz-apply]')!.getAttribute('aria-pressed')).toBe('true');
    // optimistic value → warning below the field
    const jaz = root.querySelector<HTMLInputElement>('[data-path="heatPump.jaz"]')!;
    jaz.value = '5';
    jaz.dispatchEvent(new Event('change', { bubbles: true }));
    app.recalc();
    expect(box()).toContain('Achtung: Ihr Wert 5,0 liegt über der Schätzung');
  });

  it('F25 Kennzahl CO₂-Einsparung mit beiden Summen', () => {
    const { root, app } = mount();
    const r = app.lastResult()!.run;
    const best = r.best === 'tax' ? r.tax : r.kfw;
    const text = root.querySelector('#kpis')!.textContent!.replace(/\s+/g, ' ');
    expect(r.ref.co2Tons).toBeGreaterThan(best.co2Tons);
    expect(text).toContain('CO₂-Einsparung');
    const t = (x: number) => x.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    expect(text).toContain(`${t(r.ref.co2Tons - best.co2Tons)} t`);
    expect(text).toContain(`ohne WP ${t(r.ref.co2Tons)} t, mit WP ${t(best.co2Tons)} t`);
  });

  it('F24 alle Eingabeabschnitte auf- und zuklappen', () => {
    const { root } = mount();
    const sections = [...root.querySelectorAll<HTMLDetailsElement>('#inputs details.section')];
    expect(sections.length).toBeGreaterThan(3);
    root.querySelector<HTMLButtonElement>('[data-sections="open"]')!.click();
    expect(sections.every((d) => d.open)).toBe(true);
    root.querySelector<HTMLButtonElement>('[data-sections="close"]')!.click();
    expect(sections.some((d) => d.open)).toBe(false);
  });

  it('F14 nur modernes Design: kein Umschalter, frühere Wahl „Klassisch“ wird gelöscht', () => {
    store.setItem(LEGACY_DESIGN_KEY, 'classic');
    const { root } = mount();
    expect(document.documentElement.dataset.design).toBe('modern');
    expect(root.querySelector('[data-design-choice]')).toBeNull();
    expect(root.textContent).not.toContain('Klassisch');
    expect(store.getItem(LEGACY_DESIGN_KEY)).toBeNull();
  });

  it('F14.2 alle Seiten setzen das moderne Design fest', () => {
    for (const f of readdirSync(process.cwd()).filter((n) => n.endsWith('.html'))) {
      const html = readFileSync(`${process.cwd()}/${f}`, 'utf8');
      expect(html, f).toContain('<html lang="de" data-design="modern">');
      expect(html, f).not.toContain('wp-investitionsrechner:design');
    }
  });

  it('F14.5 Hell/Dunkel/Auto übersteuert die Browser-Einstellung und wird gespeichert', () => {
    const { root, app } = mount();
    expect(app.getTheme()).toBe('auto');
    expect(['light', 'dark']).toContain(document.documentElement.dataset.theme);
    root.querySelector<HTMLButtonElement>('[data-theme-choice="dark"]')!.click();
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(store.getItem(THEME_KEY)).toBe('dark');
    root.querySelector<HTMLButtonElement>('[data-theme-choice="light"]')!.click();
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(root.querySelector('[data-theme-choice="light"]')!.getAttribute('aria-pressed')).toBe('true');
    expect(mount().app.getTheme()).toBe('light');
    expect(JSON.stringify(app.getInputs())).not.toMatch(/"light"|"dark"/);
    store.setItem(THEME_KEY, 'quatsch');
    expect(mount().app.getTheme()).toBe('auto');
  });

  it('F16 Bezeichnung und Bemerkungen: gespeichert, angezeigt, ohne Neuberechnung', () => {
    const { root, app } = mount();
    const heading = root.querySelector<HTMLElement>('#scenario-name')!;
    expect(heading.hidden).toBe(true);
    const before = app.lastResult();
    const name = root.querySelector<HTMLInputElement>('[data-path="scenario.name"]')!;
    name.value = 'Angebot A';
    name.dispatchEvent(new Event('input', { bubbles: true }));
    const notes = root.querySelector<HTMLTextAreaElement>('textarea[data-path="scenario.notes"]')!;
    notes.value = 'Zeile 1\nZeile 2';
    notes.dispatchEvent(new Event('input', { bubbles: true }));
    expect(heading.hidden).toBe(false);
    expect(heading.textContent).toBe('Angebot A');
    expect(document.title).toContain('Angebot A');
    expect(app.lastResult()).toBe(before); // no recalculation
    expect(JSON.parse(store.getItem(STORAGE_KEY)!).scenario).toEqual({ name: 'Angebot A', notes: 'Zeile 1\nZeile 2' });
    // no origin popover for free-text fields
    expect(name.closest('.field')!.querySelector('.info-btn')).toBeNull();
    // restored on load
    const again = mount();
    expect(again.root.querySelector<HTMLTextAreaElement>('textarea[data-path="scenario.notes"]')!.value).toBe('Zeile 1\nZeile 2');
  });

  it('F9.5 Formular: Werte außerhalb der Grenzen werden markiert und nicht übernommen', () => {
    const { root, app } = mount();
    const el = setValue(root, 'general.horizonYears', '1000');
    expect(el.classList.contains('invalid')).toBe(true);
    expect(app.getInputs().general.horizonYears).toBe(20);
    expect(setValue(root, 'heatPump.installMonth', '1800-01').classList.contains('invalid')).toBe(true);
  });

  it('F9.5 ungültige Werte im Link werden ersetzt und gemeldet', () => {
    history.replaceState(null, '', '/' + encodeHash(defaults(), { ...defaults(), financing: { ...defaults().financing, kfwTermYears: 1e6 } }));
    const { root, app } = mount();
    expect(app.getInputs().financing.kfwTermYears).toBe(50);
    const notice = root.querySelector<HTMLElement>('#notice')!;
    expect(notice.hidden).toBe(false);
    expect(notice.textContent).toContain('Laufzeit KfW-Kredit');
    notice.querySelector<HTMLButtonElement>('[data-notice="dismiss"]')!.click();
    expect(notice.hidden).toBe(true);
  });

  it('F9.6 geteilter Link überschreibt eigene Eingaben nicht ohne Zustimmung', () => {
    const own = defaults();
    own.heatPump.investment = 25000;
    store.setItem(STORAGE_KEY, JSON.stringify(own));
    const shared = defaults();
    shared.heatPump.investment = 40000;
    history.replaceState(null, '', '/' + encodeHash(defaults(), shared));
    const { root, app } = mount();
    expect(app.getInputs().heatPump.investment).toBe(40000);
    const notice = root.querySelector<HTMLElement>('#notice')!;
    expect(notice.textContent).toContain('Geteiltes Szenario');
    setValue(root, 'heatPump.jaz', '4');
    expect(JSON.parse(store.getItem(STORAGE_KEY)!).heatPump.investment).toBe(25000); // own data unchanged
    expect(location.hash).toMatch(/^#z=/); // change affects the link
    // load own inputs
    notice.querySelector<HTMLButtonElement>('[data-notice="own"]')!.click();
    expect(app.getInputs().heatPump.investment).toBe(25000);
    expect(location.hash).toBe('');
    expect(notice.hidden).toBe(true);
  });

  it('F9.6 geteiltes Szenario übernehmen speichert es', () => {
    store.setItem(STORAGE_KEY, JSON.stringify(defaults()));
    const shared = defaults();
    shared.heatPump.investment = 40000;
    history.replaceState(null, '', '/' + encodeHash(defaults(), shared));
    const { root } = mount();
    root.querySelector<HTMLButtonElement>('[data-notice="adopt"]')!.click();
    expect(JSON.parse(store.getItem(STORAGE_KEY)!).heatPump.investment).toBe(40000);
    expect(root.querySelector<HTMLElement>('#notice')!.hidden).toBe(true);
  });

  it('F9.6 Link ohne eigene gespeicherte Eingaben: kein Hinweis, wird gespeichert', () => {
    const shared = defaults();
    shared.heatPump.investment = 40000;
    history.replaceState(null, '', '/' + encodeHash(defaults(), shared));
    const { root } = mount();
    expect(root.querySelector<HTMLElement>('#notice')!.hidden).toBe(true);
    setValue(root, 'heatPump.jaz', '4');
    expect(JSON.parse(store.getItem(STORAGE_KEY)!).heatPump.investment).toBe(40000);
  });

  it('N7 ungültige Eingabe: Fehlertext, aria-invalid, verknüpft mit dem Feld', () => {
    const { root } = mount();
    const el = setValue(root, 'general.horizonYears', '1000');
    expect(el.getAttribute('aria-invalid')).toBe('true');
    const err = root.querySelector<HTMLElement>(`#${el.id}-err`)!;
    expect(err.hidden).toBe(false);
    expect(err.textContent).toContain('1 bis 50');
    expect(el.getAttribute('aria-describedby')).toContain(`${el.id}-err`);
    setValue(root, 'general.horizonYears', '25');
    expect(el.hasAttribute('aria-invalid')).toBe(false);
    expect(err.hidden).toBe(true);
    // percentage fields in percent
    expect(setValue(root, 'heatPump.eligibleShare', '150').closest('.field')!.textContent).toContain('0 bis 100 %');
  });

  it('N7 Diagramme: Textalternative, Datentabellen, Reiter mit Pfeiltasten', () => {
    const { root } = mount();
    const canvas = root.querySelector('canvas[data-chart="prices"]')!;
    expect(canvas.getAttribute('role')).toBe('img');
    expect(canvas.getAttribute('aria-label')).toContain('Preisentwicklung');
    const prices = root.querySelector('[data-chart-table="prices"] table')!;
    expect(prices.querySelector('caption')!.textContent).toContain('Preisentwicklung');
    expect(prices.querySelectorAll('tbody tr').length).toBe(21);
    expect(root.querySelectorAll('[data-chart-table="install"] tbody tr')).toHaveLength(9);
    const tabs = [...root.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
    expect(tabs[0].getAttribute('aria-controls')).toBe('panel-cumulative');
    expect(root.querySelector('#panel-cumulative')!.getAttribute('role')).toBe('tabpanel');
    expect(tabs.map((t) => t.tabIndex)).toEqual([0, -1, -1, -1, -1, -1]);
    tabs[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(tabs[1].getAttribute('aria-selected')).toBe('true');
    expect(tabs.map((t) => t.tabIndex)).toEqual([-1, 0, -1, -1, -1, -1]);
    expect(root.querySelector<HTMLElement>('#panel-annual')!.hidden).toBe(false);
    tabs[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    expect(tabs[5].getAttribute('aria-selected')).toBe('true');
    tabs[5].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');
  });

  it('F28 PV-Deckung unter den PV-Feldern nur mit PV-Anlage', () => {
    const { root, app } = mount();
    const box = root.querySelector<HTMLElement>('#pv-estimate')!;
    expect(box.hidden).toBe(true);
    setValue(root, 'heatPump.pvKwp', '8');
    app.recalc();
    expect(box.hidden).toBe(false);
    const text = box.textContent!.replace(/\s+/g, ' ');
    expect(text).toMatch(/PV deckt rechnerisch \d+ % des Wärmepumpenstroms/);
    expect(text).toMatch(/Winter \(Dez–Feb\): \d+ %/);
    expect(box.querySelectorAll('tbody tr')).toHaveLength(12);
    expect(root.querySelector<HTMLElement>('[data-field="heatPump.batteryKwh"]')!.hidden).toBe(false);
  });

  it('F19.3 Kasten „Über diesen Rechner“ vor „Mitmachen“', () => {
    const { root } = mount();
    const about = root.querySelector('.about')!;
    expect(about.querySelector('h2')!.textContent).toBe('Über diesen Rechner');
    expect(about.textContent).toContain('rein privates Hobbyprojekt');
    expect(about.textContent).toContain('kein Fachmann');
    expect(about.nextElementSibling!.querySelector('h2')!.textContent).toBe('Mitmachen');
    // prominent links: header and introduction; jumping keeps the URL hash (shared links)
    const links = root.querySelectorAll<HTMLAnchorElement>('[data-about-link]');
    expect(links).toHaveLength(2);
    expect(root.querySelector('.brand [data-about-link]')!.textContent).toBe('Über diesen Rechner');
    const intro = root.querySelector<HTMLDialogElement>('#intro')!;
    intro.setAttribute('open', '');
    const introLink = intro.querySelector<HTMLAnchorElement>('[data-about-link]')!;
    expect(introLink.textContent).toBe('Wie und warum er entstanden ist');
    history.replaceState(null, '', '/#z=abc');
    introLink.click();
    expect(intro.open).toBe(false);
    expect(store.getItem(INTRO_KEY)).toBe('1');
    expect(document.activeElement?.id).toBe('about-title');
    expect(about.classList.contains('is-highlighted')).toBe(true);
    expect(location.hash).toBe('#z=abc');
    history.replaceState(null, '', '/');
  });

  it('F31 Varianten vergleichen: aktuelle Eingaben und Dateien, Tabelle, Unterschiede, höchstens drei', async () => {
    const { root, app } = mount();
    root.querySelector<HTMLButtonElement>('#btn-variants')!.click();
    root.querySelector<HTMLButtonElement>('#var-current')!.click();
    expect(app.getVariants()).toEqual(['Aktuelle Eingaben']);
    expect(root.querySelector('#var-result')!.textContent).toContain('mindestens eine weitere Variante');
    // load two export files at once
    const exp = (name: string, month: string) => {
      const i = app.getInputs();
      const d = structuredClone(i);
      d.scenario.name = name;
      d.heatPump.installMonth = month;
      return new File([JSON.stringify({ ...d, version: 1 })], `${name}.json`, { type: 'application/json' });
    };
    const input = root.querySelector<HTMLInputElement>('#var-file-input')!;
    Object.defineProperty(input, 'files', { value: [exp('jetzt', '2027-01'), exp('2028', '2028-05')], configurable: true });
    input.dispatchEvent(new Event('change'));
    await new Promise((r) => setTimeout(r, 20));
    expect(app.getVariants()).toEqual(['Aktuelle Eingaben', 'jetzt', '2028']);
    const result = root.querySelector('#var-result')!;
    expect(result.querySelectorAll('.variants-table')[0].querySelectorAll('thead th')).toHaveLength(4);
    expect(result.textContent).toContain('Unterschiede in den Eingaben');
    expect(result.textContent).toContain('05/2028');
    // the current inputs are in the comparison only once
    root.querySelector<HTMLButtonElement>('#var-current')!.click();
    expect(app.getVariants()).toHaveLength(3);
    expect(root.querySelector('#var-status')!.textContent).toContain('schon im Vergleich');
    // a fourth one is refused
    root.querySelector<HTMLButtonElement>('[data-var-freeze="0"]')!.click();
    expect(app.getVariants()[0]).toMatch(/^Stand \d{2}:\d{2} Uhr$/);
    root.querySelector<HTMLButtonElement>('#var-current')!.click();
    expect(app.getVariants()).toHaveLength(3);
    expect(root.querySelector('#var-status')!.textContent).toContain('Höchstens 3 Varianten');
    // remove
    root.querySelector<HTMLButtonElement>('[data-var-remove="0"]')!.click();
    expect(app.getVariants()).toEqual(['jetzt', '2028']);
    // F9.8 taking over a variant: warning in the app's own dialog, only the confirmation replaces the inputs
    const before = app.getInputs().heatPump.installMonth;
    root.querySelector<HTMLButtonElement>('[data-var-open="1"]')!.click();
    const confirmDlg = root.querySelector<HTMLDialogElement>('#privacy-confirm')!;
    expect(confirmDlg.open).toBe(true);
    expect(root.querySelector('#privacy-text')!.textContent).toContain('durch „2028“ ersetzt');
    root.querySelector<HTMLButtonElement>('#privacy-cancel')!.click();
    expect(app.getInputs().heatPump.installMonth).toBe(before);
    root.querySelector<HTMLButtonElement>('[data-var-open="1"]')!.click();
    expect(root.querySelector('#privacy-ok')!.textContent).toBe('Übernehmen');
    root.querySelector<HTMLButtonElement>('#privacy-ok')!.click();
    expect(app.getInputs().heatPump.installMonth).toBe('2028-05');
    expect(root.querySelector<HTMLDialogElement>('#variants')?.open ?? false).toBe(false);
  });

  it('F31.3 Aktuelle Eingaben folgen dem Rechner, bis der Stand festgehalten wird', () => {
    const { root, app } = mount();
    const open = () => root.querySelector<HTMLButtonElement>('#btn-variants')!.click();
    const jazRow = () => [...root.querySelectorAll('#var-result .variants-table')[0].querySelectorAll('tbody tr')].find((r) => r.textContent!.includes('Jahresarbeitszahl'))!;
    const setValue = (id: string, value: string) => {
      const el = root.querySelector<HTMLInputElement>(id)!;
      el.value = value;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    };
    open();
    root.querySelector<HTMLButtonElement>('#var-current')!.click();
    expect(root.querySelector('#var-list')!.textContent).toContain('folgt dem Rechner');
    // changed afterwards in the calculator: the column shows the new values and the new name
    setValue('#f-heatPump-jaz', '4.4');
    setValue('#f-scenario-name', 'Angebot B');
    open();
    expect(app.getVariants()).toEqual(['Angebot B']);
    expect(jazRow().textContent).toContain('4,4');
    // frozen: stays as it is, the current inputs can be added again
    root.querySelector<HTMLButtonElement>('[data-var-freeze="0"]')!.click();
    expect(root.querySelector('[data-var-freeze]')).toBeNull();
    setValue('#f-heatPump-jaz', '3.1');
    open();
    root.querySelector<HTMLButtonElement>('#var-current')!.click();
    expect(app.getVariants()).toEqual(['Angebot B', 'Angebot B (2)']);
    const cells = [...jazRow().querySelectorAll('td')].map((c) => c.textContent);
    expect(cells).toEqual(['4,4', '3,1']);
  });

  it('F30 Bericht: wird aufgebaut, druckt hell und stellt das Design danach wieder her', () => {
    const { app } = mount();
    document.documentElement.dataset.theme = 'dark';
    const report = app.buildReport()!;
    expect(report.id).toBe('report');
    expect(report.parentElement).toBe(document.body);
    expect(report.querySelector('h1')!.textContent).toContain('Bericht');
    expect(report.querySelector('.report-details')!.textContent).toContain('KfW-Zuschuss (458)');
    expect(report.querySelectorAll('[data-report-chart]')).toHaveLength(3);
    expect(report.classList.contains('is-rendering')).toBe(false);
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(document.title).toMatch(/^Wärmepumpen-Bericht – \d{4}-\d{2}-\d{2}$/);
    window.dispatchEvent(new Event('afterprint'));
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.title).not.toContain('Bericht');
    // a second build reuses the element
    app.buildReport();
    expect(document.querySelectorAll('#report')).toHaveLength(1);
    window.dispatchEvent(new Event('afterprint'));
  });

  it('F29 Energie je Monat: Reiter, Tabelle mit 12 Monaten + Jahr, Zusammenfassung', () => {
    const { root, app } = mount();
    expect(root.querySelector('canvas[data-chart="energy"]')!.getAttribute('aria-label')).toContain('Energie je Monat');
    const table = root.querySelector('[data-chart-table="energy"] table')!;
    expect(table.querySelectorAll('tbody tr')).toHaveLength(13);
    const head = () => [...root.querySelectorAll('[data-chart-table="energy"] thead th')].map((th) => th.textContent);
    expect(head()).toEqual(['Monat', 'Bedarf Heizen', 'Bedarf Warmwasser', 'Bedarf gesamt', 'Gas – Altanlage', 'Strom – Wärmepumpe']);
    const note = () => root.querySelector('[data-chart-note="energy"]')!.textContent!;
    expect(note()).toMatch(/Bedarf [\d.]+ kWh für Heizen und Warmwasser\./);
    expect(note()).toMatch(/kWh Strom/);
    // cooking with gas that stays on gas after the switch
    root.querySelector<HTMLInputElement>('[data-path="oldHeating.cookingWithGas"]')!.click();
    setValue(root, 'oldHeating.cookingAfter', 'gas');
    app.recalc();
    expect(head()).toEqual(['Monat', 'Bedarf Heizen', 'Bedarf Warmwasser', 'Bedarf Kochen', 'Bedarf gesamt', 'Gas – Altanlage', 'Strom – Wärmepumpe', 'Gas zum Kochen – mit Wärmepumpe']);
    expect(note()).toMatch(/Heizen, Warmwasser und Kochen.*kWh Gas zum Kochen/);
  });

  it('F27 Einflussgrößen: Reiter, Tabelle sortiert nach Spanne, Zusammenfassung', () => {
    const { root, app } = mount();
    const canvas = root.querySelector('canvas[data-chart="sensitivity"]')!;
    expect(canvas.getAttribute('role')).toBe('img');
    expect(canvas.getAttribute('aria-label')).toContain('Einflussgrößen');
    const rows = [...root.querySelectorAll('[data-chart-table="sensitivity"] tbody tr')];
    const sens = app.lastResult()!.sens;
    expect(rows).toHaveLength(sens.items.length);
    expect(rows[0].querySelector('th')!.textContent).toBe(`${sens.items[0].label} (±20 %)`);
    const note = root.querySelector('[data-chart-note="sensitivity"]')!.textContent!;
    expect(note).toContain(`Am stärksten wirkt ${sens.items[0].label}`);
  });

  it('F12.6 Finanzierungskarte zeigt Sondertilgung mit Termin und Zinsersparnis', () => {
    const { root } = mount();
    setValue(root, 'financing.windfallAmount', '10000');
    setValue(root, 'financing.windfallRepayMonth', '2032-11');
    const card = root.querySelector('#details')!.textContent!;
    expect(card).toContain('Sondertilgung 11/2032');
    expect(card).toContain('verfügbar ab 11/2031');
    expect(card).toContain('Zinsersparnis');
  });

  it('F18 Einordnung des Hauses reagiert auf Fläche und Sanierung; Kochfelder nur bei Gas', () => {
    const { root } = mount();
    const card = () => root.querySelector('#house')!.textContent!.replace(/\s+/g, ' ');
    expect(card()).toContain('143 kWh/(m²·a)');
    expect(root.querySelector('.eff-scale [aria-current]')!.textContent).toBe('E');
    setValue(root, 'building.heatedArea', '200');
    expect(card()).toContain('100 kWh/(m²·a)');
    expect(root.querySelector('.eff-scale [aria-current]')!.textContent).toBe('D');
    const scope = root.querySelector<HTMLElement>('[data-field="building.renovationScope"]')!;
    expect(scope.hidden).toBe(true);
    setValue(root, 'building.renovationYear', '2010');
    expect(scope.hidden).toBe(false);
    expect(card()).toContain('teilsaniert');
    const cooking = root.querySelector<HTMLElement>('[data-field="oldHeating.cookingWithGas"]')!;
    expect(cooking.hidden).toBe(false);
    setValue(root, 'oldHeating.fuel', 'oil');
    expect(cooking.hidden).toBe(true);
  });

  it('N9 Version im Kopf, verlinkt auf den Changelog', () => {
    const { root } = mount();
    const v = root.querySelector<HTMLAnchorElement>('#app-version')!;
    expect(v.textContent).toBe(`Version ${APP_VERSION}`);
    expect(v.getAttribute('href')).toBe('./changelog.html');
    // same tab: the changelog page leads back to the calculator, inputs are saved
    expect(root.querySelectorAll('a[href="./changelog.html"][target]')).toHaveLength(0);
  });

  it('F15 Hilfe-Link öffnet das Benutzerhandbuch im selben Tab', () => {
    const { root } = mount();
    const a = root.querySelector<HTMLAnchorElement>('#btn-help')!;
    expect(a.getAttribute('href')).toBe('./hilfe.html');
    expect(a.hasAttribute('target')).toBe(false);
  });

  it('F32.1 Link „Rechenweg“ in der Fußzeile folgt den Eingaben', () => {
    const { root } = mount();
    setValue(root, 'heatPump.jaz', '4.2');
    const href = root.querySelector<HTMLAnchorElement>('#link-derivation')!.getAttribute('href')!;
    expect(decodeHash(defaults(), href.slice(href.indexOf('#')))!.heatPump.jaz).toBe(4.2);
  });

  it('F15.4 eigene Seiten (Hilfe, Impressum, Datenschutz, Lizenzen, Changelog) öffnen im selben Tab, fremde Seiten in neuem', () => {
    const { root } = mount();
    const links = [...root.querySelectorAll<HTMLAnchorElement>('a[href]')];
    const own = links.filter((a) => /^\.\/[a-z-]+\.html/.test(a.getAttribute('href')!));
    expect(own.map((a) => a.getAttribute('href'))).toEqual(
      expect.arrayContaining(['./hilfe.html', './impressum.html', './datenschutz.html', './lizenz.html', './lizenzen-drittanbieter.html', './changelog.html']),
    );
    // F32: the derivation page opens in the same tab (like the other own pages) and carries the current inputs
    const derivation = own.filter((a) => a.getAttribute('href')!.startsWith('./rechenweg.html'));
    expect(derivation).toHaveLength(1);
    expect(derivation[0].hasAttribute('target')).toBe(false);
    expect(derivation[0].getAttribute('href')).toMatch(/^\.\/rechenweg\.html#z=/);
    for (const a of own.filter((x) => !derivation.includes(x))) expect(a.hasAttribute('target'), a.getAttribute('href')!).toBe(false);
    const external = links.filter((a) => /^https:/.test(a.getAttribute('href')!));
    expect(external.length).toBeGreaterThan(0);
    for (const a of external) {
      expect(a.target, a.href).toBe('_blank');
      expect(a.rel, a.href).toContain('noopener');
    }
  });
});

describe('F20 Einführung beim ersten Besuch', () => {
  beforeEach(() => {
    store.clear();
    history.replaceState(null, '', '/');
  });

  it('erscheint beim ersten Besuch mit Zweck, Bedienung und Link zur Hilfe', () => {
    const { root } = mount();
    const intro = root.querySelector<HTMLDialogElement>('#intro')!;
    expect(intro.open).toBe(true);
    expect(intro.getAttribute('aria-labelledby')).toBe('intro-title');
    expect(intro.textContent).toContain('Lohnt sich der Umstieg');
    expect(intro.querySelectorAll('.intro-steps li')).toHaveLength(3);
    expect(intro.querySelector('a[href="./hilfe.html"]')).not.toBeNull();
  });

  it('nach dem Schließen nicht mehr automatisch, aber über „Einführung“ wieder erreichbar', () => {
    let { root } = mount();
    // „Los geht’s“ submits the dialog form
    root.querySelector<HTMLFormElement>('#intro form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    expect(store.getItem(INTRO_KEY)).toBe('1');
    ({ root } = mount());
    const intro = root.querySelector<HTMLDialogElement>('#intro')!;
    expect(intro.open).toBe(false);
    root.querySelector<HTMLButtonElement>('#btn-intro')!.click();
    expect(intro.open).toBe(true);
  });

  it('nicht automatisch für wiederkehrende Nutzer mit gespeicherten Eingaben', () => {
    store.setItem(STORAGE_KEY, JSON.stringify(defaults()));
    const { root } = mount();
    expect(root.querySelector<HTMLDialogElement>('#intro')!.open).toBe(false);
  });

  it('Esc und Klick neben den Dialog merken sich das Schließen ebenfalls', () => {
    let { root } = mount();
    root.querySelector('#intro')!.dispatchEvent(new Event('cancel', { cancelable: true }));
    expect(store.getItem(INTRO_KEY)).toBe('1');
    store.clear();
    ({ root } = mount());
    const intro = root.querySelector<HTMLDialogElement>('#intro')!;
    intro.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(store.getItem(INTRO_KEY)).toBe('1');
    expect(intro.open).toBe(false);
  });
});

describe('F21 Weiterempfehlen-Dialog', () => {
  beforeEach(() => {
    store.clear();
    store.setItem(INTRO_KEY, '1');
    history.replaceState(null, '', '/');
  });

  it('öffnet sich mit WhatsApp, Threema, E-Mail, Link und Andere – ohne eigene Eingaben in den Links', () => {
    const { root } = mount();
    history.replaceState(null, '', encodeHash(defaults(), { ...defaults(), scenario: { name: 'Geheim', notes: '' } }));
    root.querySelector<HTMLButtonElement>('#btn-recommend')!.click();
    const dlg = root.querySelector<HTMLDialogElement>('#recommend')!;
    expect(dlg.open).toBe(true);
    expect([...dlg.querySelectorAll('.share-btn')].map((b) => b.textContent)).toEqual(['WhatsApp', 'Threema', 'E-Mail', 'Link kopieren', 'Andere']);
    const hrefs = [...dlg.querySelectorAll<HTMLAnchorElement>('a.share-btn')].map((a) => a.getAttribute('href')!);
    expect(hrefs[0]).toMatch(/^whatsapp:\/\/send\?text=/);
    expect(hrefs[1]).toMatch(/^https:\/\/threema\.id\/compose\?text=/);
    expect(hrefs[2]).toMatch(/^mailto:\?subject=/);
    for (const h of hrefs) expect(h).not.toContain('s%3D');
    expect(dlg.textContent).not.toMatch(/Facebook|Twitter/);
  });

  it('Kopieren blockiert: Text erscheint markiert zum manuellen Kopieren', async () => {
    const { root } = mount();
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: () => Promise.reject(new Error('denied')) } });
    root.querySelector<HTMLButtonElement>('#btn-recommend')!.click();
    root.querySelector<HTMLButtonElement>('#rec-copy')!.click();
    await new Promise((r) => setTimeout(r, 0));
    const fallback = root.querySelector<HTMLTextAreaElement>('#rec-fallback')!;
    expect(fallback.hidden).toBe(false);
    expect(fallback.value).toMatch(/^http:\/\/localhost:3000\/$/);
    expect(root.querySelector('#rec-status')!.textContent).toContain('markiert');
  });

  it('F19.5 IBAN kopieren: ohne Leerzeichen in die Zwischenablage, sonst markiert', async () => {
    const { root } = mount();
    let copied = '';
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (t: string) => void (copied = t) } });
    root.querySelector<HTMLButtonElement>('#btn-support')!.click();
    root.querySelector<HTMLButtonElement>('#support-copy-iban')!.click();
    await new Promise((r) => setTimeout(r, 0));
    expect(copied).toBe('DE62500240240752943331');
    expect(root.querySelector('#support-status')!.textContent).toBe('IBAN kopiert.');
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: () => Promise.reject(new Error('denied')) } });
    root.querySelector<HTMLButtonElement>('#support-copy-iban')!.click();
    await new Promise((r) => setTimeout(r, 0));
    expect(root.querySelector('#support-status')!.textContent).toContain('markiert');
  });
});

describe('F17.3 / F26.4 Hinweise in den Eingaben', () => {
  beforeEach(() => {
    store.clear();
    store.setItem(INTRO_KEY, '1');
  });
  const note = (root: HTMLElement, path: string) => root.querySelector(`[data-field="${path}"] .field-note`)!.textContent;

  it('zeigt den absoluten Verbrauch für Warmwasser und Kochen unter dem Anteil', () => {
    const { root } = mount();
    setValue(root, 'oldHeating.consumption', '20000');
    setValue(root, 'oldHeating.dhwShare', '15');
    expect(note(root, 'oldHeating.dhwShare')).toBe('Aus Ihrem Verbrauch: ≈ 3.000 kWh Gas im Jahr für Warmwasser.');
    const cooking = root.querySelector<HTMLInputElement>('[data-path="oldHeating.cookingWithGas"]')!;
    cooking.checked = true;
    cooking.dispatchEvent(new Event('change', { bubbles: true }));
    setValue(root, 'oldHeating.cookingShare', '2');
    expect(note(root, 'oldHeating.cookingShare')).toBe('Aus Ihrem Verbrauch: ≈ 400 kWh Gas im Jahr fürs Kochen.');
    // the hot-water amount follows the consumption
    setValue(root, 'oldHeating.consumption', '10000');
    expect(note(root, 'oldHeating.dhwShare')).toBe('Aus Ihrem Verbrauch: ≈ 1.500 kWh Gas im Jahr für Warmwasser.');
    // oil: litres and kWh
    const fuel = root.querySelector<HTMLSelectElement>('[data-path="oldHeating.fuel"]')!;
    fuel.value = 'oil';
    fuel.dispatchEvent(new Event('change', { bubbles: true }));
    setValue(root, 'oldHeating.consumption', '2000');
    expect(note(root, 'oldHeating.dhwShare')).toBe('Aus Ihrem Verbrauch: ≈ 300 l Heizöl (3.000 kWh) im Jahr für Warmwasser.');
  });

  it('weist auf die JAZ hin, wenn eine Eingabe die Schätzung verschiebt; Übernehmen oder JAZ-Eingabe beendet den Hinweis', () => {
    const { root } = mount();
    const check = () => root.querySelector('.jaz-check');
    // a change without effect on the estimate: no notice
    setValue(root, 'heatPump.maintenance', '250');
    expect(check()).toBeNull();
    setValue(root, 'heatPump.emitter', 'floor');
    const c = check()!;
    expect(c.previousElementSibling!.getAttribute('data-field')).toBe('heatPump.emitter');
    expect(c.textContent).toMatch(/JAZ-Schätzung hat sich geändert: jetzt .* \(vorher .*\)/);
    expect(c.querySelector('[data-jaz-goto]')).not.toBeNull();
    expect(root.querySelector('#jaz-estimate')!.textContent).toContain('durch Ihre Änderung bei „');
    // back to the original value: estimate as before, notice disappears
    setValue(root, 'heatPump.emitter', 'radiators');
    expect(check()).toBeNull();
    setValue(root, 'oldHeating.consumption', '35000');
    expect(check()!.previousElementSibling!.getAttribute('data-field')).toBe('oldHeating.consumption');
    // entering the SPF ends the notice
    setValue(root, 'heatPump.jaz', '3');
    expect(check()).toBeNull();
    setValue(root, 'heatPump.source', 'ground');
    expect(check()).not.toBeNull();
    root.querySelector<HTMLButtonElement>('[data-jaz-apply]')!.click();
    expect(check()).toBeNull();
  });
});

describe('F9.7 Hinweis auf persönliche Daten vor Teilen und Export', () => {
  let copied: string[];
  let downloads: string[];
  beforeEach(() => {
    store.clear();
    store.setItem(INTRO_KEY, '1');
    history.replaceState(null, '', '/');
    copied = [];
    downloads = [];
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (t: string) => void copied.push(t) } });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      if (this.download) downloads.push(this.download);
    });
  });
  afterEach(() => vi.restoreAllMocks());
  const flush = () => new Promise((r) => setTimeout(r, 0));
  const dlg = (root: HTMLElement) => root.querySelector<HTMLDialogElement>('#privacy-confirm')!;

  it('„Link mit Werten teilen“ fragt erst nach und kopiert erst nach Bestätigung', async () => {
    const { root } = mount();
    root.querySelector<HTMLButtonElement>('#btn-share')!.click();
    expect(dlg(root).open).toBe(true);
    expect(root.querySelector('#privacy-title')!.textContent).toBe('Link mit Ihren Eingaben teilen?');
    expect(root.querySelector('#privacy-text')!.textContent).toContain('Haushaltseinkommen');
    expect(root.querySelector('#privacy-ok')!.textContent).toBe('Link kopieren');
    await flush();
    expect(copied).toEqual([]);
    root.querySelector<HTMLButtonElement>('#privacy-ok')!.click();
    await flush();
    expect(dlg(root).open).toBe(false);
    expect(copied).toHaveLength(1);
    expect(copied[0]).toMatch(/#z=/);
  });

  it('Abbrechen: nichts wird kopiert oder gespeichert', async () => {
    const { root } = mount();
    root.querySelector<HTMLButtonElement>('#btn-share')!.click();
    root.querySelector<HTMLButtonElement>('#privacy-cancel')!.click();
    root.querySelector<HTMLButtonElement>('#btn-export')!.click();
    root.querySelector<HTMLButtonElement>('#privacy-cancel')!.click();
    await flush();
    expect(dlg(root).open).toBe(false);
    expect(copied).toEqual([]);
    expect(downloads).toEqual([]);
    expect(location.hash).toBe('');
  });

  it('Export fragt erst nach und speichert nach Bestätigung die Datei', () => {
    const { root } = mount();
    root.querySelector<HTMLButtonElement>('#btn-export')!.click();
    expect(root.querySelector('#privacy-title')!.textContent).toBe('Eingaben als Datei speichern?');
    expect(root.querySelector('#privacy-ok')!.textContent).toBe('Datei speichern');
    expect(downloads).toEqual([]);
    root.querySelector<HTMLButtonElement>('#privacy-ok')!.click();
    expect(downloads).toHaveLength(1);
    expect(downloads[0]).toMatch(/\.json$/);
  });

  it('F9.8 Import und Zurücksetzen warnen vor dem Überschreiben; die Warnung lässt sich nicht abschalten', () => {
    store.setItem(PRIVACY_ACK_KEY, '1'); // switched-off personal data notice does not affect the overwrite warning
    const { root, app } = mount();
    const picker = vi.spyOn(root.querySelector<HTMLInputElement>('#file-import')!, 'click').mockImplementation(() => undefined);
    root.querySelector<HTMLButtonElement>('#btn-import')!.click();
    expect(dlg(root).open).toBe(true);
    expect(root.querySelector('#privacy-title')!.textContent).toBe('Eingaben aus einer Datei laden?');
    expect(root.querySelector('#privacy-text')!.textContent).toContain('ersetzt alle aktuellen Eingaben');
    expect(root.querySelector<HTMLElement>('.privacy-skip')!.hidden).toBe(true);
    expect(picker).not.toHaveBeenCalled();
    root.querySelector<HTMLButtonElement>('#privacy-ok')!.click();
    expect(picker).toHaveBeenCalledTimes(1);

    setValue(root, 'heatPump.jaz', '4.5');
    root.querySelector<HTMLButtonElement>('#btn-reset')!.click();
    expect(root.querySelector('#privacy-ok')!.textContent).toBe('Zurücksetzen');
    root.querySelector<HTMLButtonElement>('#privacy-cancel')!.click();
    expect(app.getInputs().heatPump.jaz).toBe(4.5);
    expect(dlg(root).open).toBe(false);
  });

  it('„Diesen Hinweis nicht mehr anzeigen“ wird gemerkt', async () => {
    const { root } = mount();
    root.querySelector<HTMLButtonElement>('#btn-export')!.click();
    root.querySelector<HTMLInputElement>('#privacy-skip')!.checked = true;
    root.querySelector<HTMLButtonElement>('#privacy-ok')!.click();
    expect(store.getItem(PRIVACY_ACK_KEY)).toBe('1');
    root.querySelector<HTMLButtonElement>('#btn-share')!.click();
    expect(dlg(root).open).toBe(false);
    await flush();
    expect(copied).toHaveLength(1);
  });
});

describe('F22 Hinweis auf veraltete Annahmen', () => {
  beforeEach(() => {
    store.clear();
    store.setItem(INTRO_KEY, '1');
    history.replaceState(null, '', '/');
  });
  const mountAt = (today: Date) => {
    document.body.innerHTML = '<div id="app"></div>';
    const root = document.getElementById('app')!;
    mountApp(root, { storage: store, today, debounceMs: 0 });
    return root;
  };

  it('erscheint erst ab 6 Monaten nach der letzten Prüfung und lässt sich ausblenden', () => {
    expect(mountAt(TODAY).querySelector('.notice-stale')).toBeNull();
    const root = mountAt(new Date(2027, 5, 1));
    const stale = root.querySelector('.notice-stale')!;
    expect(stale.textContent).toContain('Annahmen möglicherweise veraltet');
    expect(stale.textContent).toContain('11.11.2026');
    expect(stale.querySelector('a[href$="template=bug_report.yml"]')).not.toBeNull();
    stale.querySelector<HTMLButtonElement>('[data-notice="stale"]')!.click();
    expect(root.querySelector('.notice-stale')).toBeNull();
  });
});

describe('F20.3 Dialoge öffnen oben, der Fokus liegt auf der Überschrift', () => {
  beforeEach(() => {
    store.clear();
    history.replaceState(null, '', '/');
  });

  it('Einführung: Überschrift hat den Fokus, kein Button am Ende wird automatisch fokussiert', () => {
    const { root } = mount();
    root.querySelector<HTMLButtonElement>('#btn-intro')!.click();
    const dlg = root.querySelector<HTMLDialogElement>('#intro')!;
    expect(dlg.open).toBe(true);
    expect(document.activeElement?.id).toBe('intro-title');
    expect(dlg.querySelector('[autofocus]')).toBeNull();
  });

  it('Bestätigung vor dem Übernehmen einer Variante: Überschrift hat den Fokus', () => {
    const { root } = mount();
    root.querySelector<HTMLButtonElement>('#btn-variants')!.click();
    root.querySelector<HTMLButtonElement>('#var-current')!.click();
    root.querySelector<HTMLButtonElement>('[data-var-freeze="0"]')!.click();
    root.querySelector<HTMLButtonElement>('[data-var-open="0"]')!.click();
    const dlg = root.querySelector<HTMLDialogElement>('#privacy-confirm')!;
    expect(dlg.open).toBe(true);
    expect(document.activeElement?.id).toBe('privacy-title');
    expect(dlg.querySelector('[autofocus]')).toBeNull();
  });
});

describe('F20.3 Fokusrahmen der Überschrift nur bei Tastaturbedienung', () => {
  it('die Überschrift bekommt den Rahmen nur, wenn der Fokus sichtbar sein soll (keyboard), nicht nach einem Tippen', () => {
    const css = readFileSync(join(process.cwd(), 'src/style.css'), 'utf8');
    expect(css).toContain(":focus:not(:focus-visible)");
    expect(css).toMatch(/\.intro h2\[tabindex='-1'\]:focus:not\(:focus-visible\) \{ outline-color: transparent; \}/);
  });
});
