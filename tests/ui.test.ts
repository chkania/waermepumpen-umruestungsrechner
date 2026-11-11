// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { SECTIONS, getPath } from '../src/ui/fields';
import { mountApp, STORAGE_KEY } from '../src/ui/app';
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
});
