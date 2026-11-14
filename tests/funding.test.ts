import { describe, expect, it } from 'vitest';
import { parseMonth } from '../src/core/dates';
import {
  cap1At,
  capTotalAt,
  grundRateAt,
  incomeBonusRate,
  kfwLoanVariant,
  kfwSubsidy,
  kgbRateAt,
  type KfwRequest,
} from '../src/core/funding';
import { defaults } from './helpers';

const P = () => defaults().funding;
const M = parseMonth;

function req(over: Partial<KfwRequest> = {}): KfwRequest {
  return {
    eligibleCost: 32000,
    appMonth: M('2026-12'),
    fuel: 'gas',
    oldHeatingAge: 22,
    ownerOccupied: true,
    units: 1,
    householdIncome: 60000,
    hasChild: false,
    ...over,
  };
}

describe('F5.1 Klimageschwindigkeitsbonus – Degression', () => {
  it.each([
    ['2026-11', 0.16],
    ['2027-01', 0.16],
    ['2027-02', 0.12],
    ['2027-07', 0.12],
    ['2027-08', 0.08],
    ['2028-01', 0.08],
    ['2028-02', 0.04],
    ['2028-07', 0.04],
    ['2028-08', 0],
    ['2030-01', 0],
  ])('Antrag %s → %s', (m, rate) => {
    expect(kgbRateAt(M(m), P())).toBeCloseTo(rate, 10);
  });

  it('nur bei Gasheizung ≥ 20 Jahre oder Öl', () => {
    expect(kfwSubsidy(req({ oldHeatingAge: 19 }), P()).kgbRate).toBe(0);
    expect(kfwSubsidy(req({ oldHeatingAge: 20 }), P()).kgbRate).toBe(0.16);
    expect(kfwSubsidy(req({ fuel: 'oil', oldHeatingAge: 5 }), P()).kgbRate).toBe(0.16);
  });

  it('nicht für Vermieter (keine Selbstnutzung)', () => {
    const r = kfwSubsidy(req({ ownerOccupied: false, householdIncome: 20000 }), P());
    expect(r.kgbRate).toBe(0);
    expect(r.incomeRate).toBe(0);
    expect(r.subsidy).toBe(0.3 * 28000);
  });
});

describe('F5.1 Förderfähige Kosten', () => {
  it.each([
    ['2027-01', 28000],
    ['2027-02', 27250],
    ['2027-08', 26500],
    ['2028-02', 25750],
  ])('1. WE bei Antrag %s → %s €', (m, cap) => {
    expect(cap1At(M(m), P())).toBe(cap);
  });

  it('Untergrenze 22.000 € ab 08/2030 (Richtlinie Nr. 8.3.1 a)', () => {
    expect(cap1At(M('2030-07'), P())).toBe(22750);
    expect(cap1At(M('2030-08'), P())).toBe(22000);
    expect(cap1At(M('2035-02'), P())).toBe(22000);
  });

  it('Mehrfamilienhaus: 1. WE + 5×15.000 + Rest×8.000', () => {
    expect(capTotalAt(M('2026-12'), 7, P())).toBe(28000 + 5 * 15000 + 8000); // 111,000 (KfW example)
    expect(capTotalAt(M('2026-12'), 2, P())).toBe(43000);
  });
});

describe('F5.1 Einkommensbonus', () => {
  it.each([
    [30000, false, 0.4],
    [30001, false, 0.3],
    [40000, false, 0.3],
    [50000, false, 0.1],
    [50001, false, 0],
    [40000, true, 0.4],
    [60000, true, 0.1],
    [60001, true, 0],
  ])('zvE %s, Kind %s → %s', (inc, child, rate) => {
    expect(incomeBonusRate(inc, child, P())).toBe(rate);
  });
});

describe('F5.1 Zuschuss gesamt', () => {
  it('Default: 30 % + 16 % auf 28.000 € = 12.880 €', () => {
    const r = kfwSubsidy(req(), P());
    expect(r.ownerUnitRate).toBeCloseTo(0.46, 10);
    expect(r.eligibleCosts).toBe(28000);
    expect(r.subsidy).toBe(12880);
  });

  it('Höchstsatz 70 % (30+16+30 = 76 → 70)', () => {
    const r = kfwSubsidy(req({ householdIncome: 35000 }), P());
    expect(r.ownerUnitRate).toBe(0.7);
    expect(r.subsidy).toBe(19600);
  });

  it('Höchstsatz 80 % bei Einkommensbonus 40 %', () => {
    const r = kfwSubsidy(req({ householdIncome: 25000 }), P());
    expect(r.ownerUnitRate).toBe(0.8);
    expect(r.subsidy).toBe(22400);
  });

  it('Kosten unter Höchstbetrag werden voll angesetzt', () => {
    expect(kfwSubsidy(req({ eligibleCost: 20000 }), P()).subsidy).toBe(9200);
  });

  it('Boni nur auf den Anteil der selbstgenutzten WE', () => {
    const r = kfwSubsidy(req({ units: 2, eligibleCost: 50000 }), P());
    // Costs 43,000 (cap), 21,500 per unit → 0.3×21,500 + 0.46×21,500
    expect(r.subsidy).toBeCloseTo(0.3 * 21500 + 0.46 * 21500, 2);
  });

  it('ab Q1/2027: 15 % Grundförderung + 15 % Wertschöpfungs-Bonus nur bei EU-Ursprung (Nr. 8.4.1 c, 8.4.6)', () => {
    const p = P();
    expect(grundRateAt(M('2026-12'), p)).toBe(0.3);
    expect(grundRateAt(M('2027-01'), p)).toBe(0.15);
    // Landlord (Vermieter), no bonuses: EU heat pump still 30 %, non-EU only 15 %
    const eu = kfwSubsidy(req({ appMonth: M('2027-03'), ownerOccupied: false, eligibleCost: 20000 }), p);
    expect(eu.wsbRate).toBe(0.15);
    expect(eu.subsidy).toBe(6000);
    const nonEu = kfwSubsidy(req({ appMonth: M('2027-03'), ownerOccupied: false, eligibleCost: 20000, euOrigin: false }), p);
    expect(nonEu.wsbRate).toBe(0);
    expect(nonEu.subsidy).toBe(3000);
    expect(nonEu.notes.join()).toMatch(/EU-Ursprung/);
    // before the cut-off date (Stichtag) the origin does not matter
    expect(kfwSubsidy(req({ euOrigin: false }), p).subsidy).toBe(12880);
  });
});

describe('F6.2 Kreditvariante', () => {
  it('358 nur selbstgenutzt, 1 WE, zvE ≤ 90.000', () => {
    expect(kfwLoanVariant(true, 1, 90000, P())).toBe('358');
    expect(kfwLoanVariant(true, 1, 90001, P())).toBe('359');
    expect(kfwLoanVariant(false, 1, 50000, P())).toBe('359');
    expect(kfwLoanVariant(true, 3, 50000, P())).toBe('359');
  });
});
