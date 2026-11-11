import { describe, expect, it } from 'vitest';
import { parseMonth } from '../src/core/dates';
import { taxBonus, type TaxRequest } from '../src/core/tax';
import { defaults } from './helpers';

const P = () => defaults().tax;
const req = (over: Partial<TaxRequest> = {}): TaxRequest => ({
  cost: 30000,
  completionMonth: parseMonth('2027-05'),
  ownerOccupied: true,
  buildingAgeAtCompletion: 40,
  incomeTax: 0,
  ...over,
});

describe('F5.2 Steuerbonus § 35c', () => {
  it('7/7/6 % auf Abschlussjahr und zwei Folgejahre', () => {
    const r = taxBonus(req(), P());
    expect(r.eligible).toBe(true);
    expect(r.yearly).toEqual([
      { year: 2027, amount: 2100 },
      { year: 2028, amount: 2100 },
      { year: 2029, amount: 1800 },
    ]);
    expect(r.total).toBe(6000);
  });

  it('Kosten max. 200.000 € → max. 40.000 €', () => {
    expect(taxBonus(req({ cost: 300000 }), P()).total).toBe(40000);
  });

  it('begrenzt durch Einkommensteuerschuld', () => {
    const r = taxBonus(req({ incomeTax: 1500 }), P());
    expect(r.yearly.map((y) => y.amount)).toEqual([1500, 1500, 1500]);
    expect(r.notes.join()).toMatch(/Einkommensteuer/);
  });

  it('nicht bei Vermietung, jungem Gebäude oder Abschluss nach Frist', () => {
    expect(taxBonus(req({ ownerOccupied: false }), P()).eligible).toBe(false);
    expect(taxBonus(req({ buildingAgeAtCompletion: 9 }), P()).eligible).toBe(false);
    expect(taxBonus(req({ completionMonth: parseMonth('2029-12') }), P()).eligible).toBe(true);
    const late = taxBonus(req({ completionMonth: parseMonth('2030-01') }), P());
    expect(late.eligible).toBe(false);
    expect(late.total).toBe(0);
  });
});
