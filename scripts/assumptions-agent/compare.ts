/**
 * Compare & Impact Assessment: Vergleiche alte vs. neue Werte
 * und bewerte die Auswirkungen
 */

export interface ComparisonResult {
  oldValue: unknown;
  newValue: unknown;
  changed: boolean;
  type: 'number' | 'string' | 'date' | 'boolean' | 'unknown';
}

export type Impact = 'critical' | 'major' | 'minor' | 'none';

/**
 * Vergleiche zwei Werte und erkenne Änderungen
 */
export function compare(
  oldValue: unknown,
  newValue: unknown
): ComparisonResult {
  let type: 'number' | 'string' | 'date' | 'boolean' | 'unknown' = 'unknown';

  if (typeof oldValue === 'number' || typeof newValue === 'number') {
    type = 'number';
  } else if (typeof oldValue === 'boolean' || typeof newValue === 'boolean') {
    type = 'boolean';
  } else if (typeof oldValue === 'string' || typeof newValue === 'string') {
    // Prüfe, ob es ein Datum ist
    const isOldDate = typeof oldValue === 'string' && /^\d{4}-\d{2}(-\d{2})?$/.test(oldValue);
    const isNewDate = typeof newValue === 'string' && /^\d{4}-\d{2}(-\d{2})?$/.test(newValue);
    type = isOldDate || isNewDate ? 'date' : 'string';
  }

  return {
    oldValue,
    newValue,
    changed: oldValue !== newValue,
    type,
  };
}

/**
 * Bewerte die Auswirkung einer Änderung
 * 
 * Regeln:
 * - Datums-Änderung → MAJOR
 * - Satz-Änderung > 0,5% → MAJOR
 * - Satz-Änderung 0,1%–0,5% → MINOR
 * - Preis-Änderung > 5% → MINOR
 * - Preis-Änderung ≤ 5% → NONE
 * - HIGH-Kritikalität + Änderung → kann MAJOR hochbewerten
 */
export function assessImpact(
  _key: string,
  oldValue: unknown,
  newValue: unknown,
  criticality?: 'high' | 'medium' | 'low' | 'notApplicable' | 'none'
): Impact {
  // Keine Änderung
  if (oldValue === newValue) {
    return 'none';
  }

  // HIGH-Kritikalität: Änderungen sind MAJOR
  // (z.B. KfW 458 Deckel: auch 1€ Änderung ist meldepflichtig)
  if (criticality === 'high') {
    return 'major';
  }

  // Datums-Änderung → MAJOR
  if (typeof oldValue === 'string' && typeof newValue === 'string') {
    const isOldDate = /^\d{4}-\d{2}(-\d{2})?$/.test(oldValue);
    const isNewDate = /^\d{4}-\d{2}(-\d{2})?$/.test(newValue);
    if (isOldDate && isNewDate && oldValue !== newValue) {
      return 'major';
    }
  }

  // Satz oder Preis (number)
  if (typeof oldValue === 'number' && typeof newValue === 'number') {
    const delta = Math.abs(newValue - oldValue);

    // Sätze (0–1, z.B. 0.30 für 30%)
    if (oldValue >= 0 && oldValue <= 1) {
      if (delta > 0.005) return 'major'; // > 0,5%
      if (delta > 0.001) return 'minor'; // > 0,1%
      return 'none';
    }

    // Beträge oder Preise
    const baseValue = Math.abs(oldValue);
    if (baseValue > 0) {
      const pctChange = delta / baseValue;
      if (pctChange > 0.05) return 'minor'; // > 5%
      if (pctChange > 0.01) return 'none'; // > 1%
      return 'none';
    }

    // Basis ist 0 (z.B. bei Preisen)
    if (delta > 0) return 'minor';
  }

  return 'none';
}

/**
 * Konvertiere Impact zu Emoji/String
 */
export function impactToString(impact: Impact): string {
  switch (impact) {
    case 'critical':
      return '❌ KRITISCH';
    case 'major':
      return '⚠️  MAJOR';
    case 'minor':
      return '⚠️  MINOR';
    case 'none':
      return '✅ OK';
  }
}
