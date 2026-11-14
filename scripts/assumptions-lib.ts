/**
 * Periodic review of the assumptions (F22): builds the checklist for the "Annahmen prüfen" issue
 * from the documented origin of the default values (src/core/sources.ts, F11).
 * Only time-sensitive kinds are listed: official sources, laws and market data.
 */
import type { DefaultSource, OfficialRef, SourceKind } from '../src/core/sources.ts';

export const REVIEW_KINDS: readonly SourceKind[] = ['quelle', 'gesetz', 'markt'];

interface SectionLike {
  title: string;
  fields: { path: string; label: string }[];
}

export interface ChecklistInput {
  sections: readonly SectionLike[];
  sources: Record<string, DefaultSource>;
  refs: Record<string, OfficialRef[]>;
  kindLabels: Record<SourceKind, string>;
  /** Date of the last review of the funding conditions (YYYY-MM-DD, defaults.ts FUNDING_SOURCE_DATE). */
  lastReview: string;
  /** Date of this review (YYYY-MM-DD). */
  today: string;
}

const de = (iso: string) => iso.split('-').reverse().join('.');

/** Markdown body of the review issue. */
export function buildChecklist(inp: ChecklistInput): { title: string; body: string; count: number } {
  const quarter = `${inp.today.slice(0, 4)}-Q${Math.floor((Number(inp.today.slice(5, 7)) - 1) / 3) + 1}`;
  const parts: string[] = [
    `Förderregeln, Preise und Gesetze ändern sich laufend. Bitte die folgenden Standardwerte gegen ihre Quellen prüfen – zuletzt geprüft am **${de(inp.lastReview)}**.`,
    '',
    '**So geht’s:** Quelle öffnen, Wert vergleichen, abhaken. Geänderte Werte in `src/core/defaults.ts` und `src/core/sources.ts` anpassen (Abrufdatum aktualisieren), danach `FUNDING_SOURCE_DATE` in `defaults.ts` auf das Prüfdatum setzen – das setzt auch den Hinweis „Annahmen älter als 6 Monate“ im Rechner zurück. Regressions-Snapshots mit `npm test -- -u` aktualisieren und im Änderungsprotokoll begründen. Commit als `fix:` (Korrektur) bzw. `feat:` (geänderte Annahmen, siehe CONTRIBUTING.md).',
    '',
    'Hinweise von Nutzerinnen und Nutzern: offene Issues mit dem Label `bug` prüfen.',
  ];
  let count = 0;
  for (const section of inp.sections) {
    const items: string[] = [];
    for (const f of section.fields) {
      const src = inp.sources[f.path];
      if (!src || !REVIEW_KINDS.includes(src.kind)) continue;
      const links = [
        ...(src.url ? [`[Quelle](${src.url})`] : []),
        ...(inp.refs[f.path] ?? []).map((r) => `[${r.label}](${r.url})`),
      ];
      const asOf = src.asOf ? `, Stand ${src.asOf}` : '';
      items.push(`- [ ] **${f.label}** (${inp.kindLabels[src.kind]}${asOf})${links.length ? ' – ' + links.join(' · ') : ''}`);
      count++;
    }
    if (items.length) parts.push('', `### ${section.title}`, ...items);
  }
  parts.push('', '_Automatisch erstellt vom Workflow „Annahmen prüfen“ (`.github/workflows/annahmen-pruefen.yml`)._');
  return { title: `Annahmen prüfen (${quarter})`, body: parts.join('\n') + '\n', count };
}
