import { tryParseMonth, yearOf } from './dates';
import type { TaxParams, TaxResult } from './types';

export interface TaxRequest {
  /** Eligible expenses (begünstigte Aufwendungen) (€). */
  cost: number;
  /** Completion month of the measure (absolute). */
  completionMonth: number;
  ownerOccupied: boolean;
  /** Building age at completion (years). */
  buildingAgeAtCompletion: number;
  /** Annual income tax liability (Einkommensteuerschuld); 0 = unlimited. */
  incomeTax: number;
}

const round2 = (x: number) => Math.round(x * 100) / 100;

/** Tax reduction (Steuerermäßigung) under § 35c EStG (7 % / 7 % / 6 %). */
export function taxBonus(req: TaxRequest, p: TaxParams): TaxResult {
  const notes: string[] = [];
  const completionYear = yearOf(req.completionMonth);
  let eligible = true;
  if (!req.ownerOccupied) {
    eligible = false;
    notes.push('Steuerbonus nur bei selbstgenutztem Wohneigentum.');
  }
  if (req.buildingAgeAtCompletion < p.minBuildingAge) {
    eligible = false;
    notes.push(`Steuerbonus erst ab Gebäudealter ${p.minBuildingAge} Jahre.`);
  }
  const deadline = tryParseMonth(p.deadline);
  if (deadline !== null && req.completionMonth > deadline) {
    eligible = false;
    notes.push(`Steuerbonus nur für Maßnahmen mit Abschluss bis ${p.deadline}.`);
  }
  if (!eligible) return { eligible, completionYear, total: 0, yearly: [], notes };

  const base = Math.max(0, Math.min(req.cost, p.maxCost));
  const rates = [p.rateYear1, p.rateYear2, p.rateYear3];
  let remaining = p.maxBonus;
  let limitedByTax = false;
  const yearly = rates.map((r, i) => {
    let amount = Math.min(base * r, remaining);
    if (req.incomeTax > 0 && amount > req.incomeTax) {
      amount = req.incomeTax;
      limitedByTax = true;
    }
    remaining -= amount;
    return { year: completionYear + i, amount: round2(amount) };
  });
  if (limitedByTax) notes.push('Steuerbonus durch Einkommensteuerschuld begrenzt (kein Vor-/Rücktrag).');
  const total = round2(yearly.reduce((s, y) => s + y.amount, 0));
  return { eligible, completionYear, total, yearly, notes };
}
