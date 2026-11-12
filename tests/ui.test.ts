// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { SECTIONS, getPath } from '../src/ui/fields';
import { DESIGN_KEY, mountApp, STORAGE_KEY, THEME_KEY } from '../src/ui/app';
import { encodeHash } from '../src/core/serialize';
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
    expect(root.querySelectorAll('#install-table tbody tr')).toHaveLength(9);
    expect(root.querySelectorAll('#year-table tbody tr').length).toBe(21); // 2026 … 2046
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
    window.confirm = () => true;
    root.querySelector<HTMLButtonElement>('#btn-reset')!.click();
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
    btn.click();
    expect(pop.hidden).toBe(false);
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    expect(pop.textContent).toContain('Marktdaten');
    expect(pop.textContent).toContain('12.000 €');
    // nur ein Popover gleichzeitig
    root.querySelector<HTMLButtonElement>('[data-field="funding.kgbRate"] .info-btn')!.click();
    expect(pop.hidden).toBe(true);
    const kgb = root.querySelector('[data-field="funding.kgbRate"] .src-pop')!;
    expect(kgb.textContent).toContain('16 %');
    const links = [...kgb.querySelectorAll('a')].map((a) => a.getAttribute('href'));
    expect(links.some((h) => h!.includes('bundesanzeiger.de'))).toBe(true);
    expect(links.some((h) => h!.includes('6000005131_M_458.pdf'))).toBe(true);
    expect(kgb.textContent).toContain('Nr. 8.4.4');
    const child = root.querySelector('[data-field="building.hasChild"] .src-pop')!;
    expect(child.textContent).toContain('Nr. 8.4.5');
    expect(child.textContent).toContain('Kindergeldberechtigung');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect((kgb as HTMLElement).hidden).toBe(true);
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

  it('F14 Design-Umschalter: Default modern, Wechsel setzt Attribut und wird gespeichert', () => {
    const { root, app } = mount();
    expect(app.getDesign()).toBe('modern');
    expect(document.documentElement.dataset.design).toBe('modern');
    const classic = root.querySelector<HTMLButtonElement>('[data-design-choice="classic"]')!;
    classic.click();
    expect(document.documentElement.dataset.design).toBe('classic');
    expect(classic.getAttribute('aria-pressed')).toBe('true');
    expect(store.getItem(DESIGN_KEY)).toBe('classic');
    // Design ist Ansichtseinstellung, nicht Teil der Eingaben
    expect(JSON.stringify(app.getInputs())).not.toContain('classic');
    // beim nächsten Laden wiederhergestellt
    const again = mount();
    expect(again.app.getDesign()).toBe('classic');
    store.setItem(DESIGN_KEY, 'unsinn');
    expect(mount().app.getDesign()).toBe('modern');
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
    expect(app.lastResult()).toBe(before); // keine Neuberechnung
    expect(JSON.parse(store.getItem(STORAGE_KEY)!).scenario).toEqual({ name: 'Angebot A', notes: 'Zeile 1\nZeile 2' });
    // kein Herkunfts-Popover für Freitextfelder
    expect(name.closest('.field')!.querySelector('.info-btn')).toBeNull();
    // wird beim Laden wiederhergestellt
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
    expect(JSON.parse(store.getItem(STORAGE_KEY)!).heatPump.investment).toBe(25000); // eigene Daten unverändert
    expect(location.hash).toMatch(/^#s=/); // Änderung wirkt auf den Link
    // eigene Eingaben laden
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
    // Prozentfelder in Prozent
    expect(setValue(root, 'heatPump.pvShare', '150').closest('.field')!.textContent).toContain('0 bis 100 %');
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
    expect(tabs.map((t) => t.tabIndex)).toEqual([0, -1, -1, -1]);
    tabs[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(tabs[1].getAttribute('aria-selected')).toBe('true');
    expect(tabs.map((t) => t.tabIndex)).toEqual([-1, 0, -1, -1]);
    expect(root.querySelector<HTMLElement>('#panel-annual')!.hidden).toBe(false);
    tabs[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    expect(tabs[3].getAttribute('aria-selected')).toBe('true');
    tabs[3].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');
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

  it('F15 Hilfe-Link öffnet das Benutzerhandbuch in neuem Tab', () => {
    const { root } = mount();
    const a = root.querySelector<HTMLAnchorElement>('#btn-help')!;
    expect(a.getAttribute('href')).toBe('./hilfe.html');
    expect(a.target).toBe('_blank');
  });
});
