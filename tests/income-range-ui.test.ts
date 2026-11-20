// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { INCOME_RANGES } from '../src/core/income-range';
import { mountApp, STORAGE_KEY } from '../src/ui/app';
import { defaults, TODAY } from './helpers';

class MemoryStorage implements Storage {
  private m = new Map<string, string>();
  get length() {
    return this.m.size;
  }
  clear() {
    this.m.clear();
  }
  getItem(k: string) {
    return this.m.get(k) ?? null;
  }
  key(i: number) {
    return [...this.m.keys()][i] ?? null;
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
  setItem(k: string, v: string) {
    this.m.set(k, String(v));
  }
}
const store = new MemoryStorage();

function mount() {
  document.body.innerHTML = '<div id="app"></div>';
  const root = document.getElementById('app')!;
  const app = mountApp(root, { storage: store, today: TODAY, debounceMs: 0 });
  return { root, app };
}

const select = (root: HTMLElement) => root.querySelector<HTMLSelectElement>('select[data-path="building.incomeRange"]')!;

describe('F5.1 Haushaltseinkommen als Auswahl im Formular', () => {
  beforeEach(() => {
    store.clear();
    history.replaceState(null, '', '/');
  });

  it('F5.1 Auswahl mit den sechs Bereichen, Standard vorgewählt, sichtbare Beschriftung', () => {
    const { root } = mount();
    const sel = select(root);
    expect(sel.tagName).toBe('SELECT');
    expect([...sel.options].map((o) => [o.value, o.textContent])).toEqual(INCOME_RANGES.map((r) => [r.code, r.label]));
    expect(sel.value).toBe('50001-60000');
    expect(root.querySelector(`label[for="${sel.id}"]`)?.textContent).toBe('Zu versteuerndes Haushaltseinkommen');
    expect(root.querySelector('input[data-path="building.householdIncome"]')).toBeNull();
  });

  it('F5.1 Hilfetext ist mit dem Feld verknüpft (N7)', () => {
    const { root } = mount();
    const sel = select(root);
    expect(sel.getAttribute('aria-describedby')?.split(' ')).toContain(`${sel.id}-help`);
    expect(root.querySelector(`#${sel.id}-help`)?.textContent).toContain(
      'Durchschnitt des 2. und 3. Jahres vor Antragstellung laut Steuerbescheid. Grenzen einschließlich. Maßgeblich für Einkommensbonus und KfW 358.',
    );
  });

  it('F5.1 Änderung der Auswahl wirkt auf die Eingaben und die Rechnung', () => {
    const { root, app } = mount();
    const sel = select(root);
    sel.value = '90001+';
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    expect(app.getInputs().building.incomeRange).toBe('90001+');
  });

  it('F9.5 gespeicherter Altwert 45.000 wird ohne Meldung als Bereich 40.001–50.000 angezeigt', () => {
    const i = defaults() as unknown as { building: Record<string, unknown> };
    delete i.building.incomeRange;
    i.building.householdIncome = 45000;
    store.setItem(STORAGE_KEY, JSON.stringify(i));
    const { root, app } = mount();
    expect(app.getInputs().building.incomeRange).toBe('40001-50000');
    expect(select(root).value).toBe('40001-50000');
    expect(root.querySelector('.notice-issues')?.textContent ?? '').not.toContain('Haushaltseinkommen');
  });

  it('F9.5 gespeicherter negativer Altwert wird mit Meldung dem ersten Bereich zugeordnet', () => {
    const i = defaults() as unknown as { building: Record<string, unknown> };
    delete i.building.incomeRange;
    i.building.householdIncome = -5000;
    store.setItem(STORAGE_KEY, JSON.stringify(i));
    const { root, app } = mount();
    expect(app.getInputs().building.incomeRange).toBe('0-30000');
    const box = root.querySelector('.notice-issues')!.textContent!;
    expect(box).toContain('Haushaltseinkommen');
    expect(box).toContain('unter 0, dem ersten Bereich zugeordnet');
  });
});
