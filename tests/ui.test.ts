// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { SECTIONS, getPath } from '../src/ui/fields';
import { DESIGN_KEY, mountApp, STORAGE_KEY, THEME_KEY } from '../src/ui/app';
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

  it('F15 Hilfe-Link öffnet das Benutzerhandbuch in neuem Tab', () => {
    const { root } = mount();
    const a = root.querySelector<HTMLAnchorElement>('#btn-help')!;
    expect(a.getAttribute('href')).toBe('./hilfe.html');
    expect(a.target).toBe('_blank');
  });
});
