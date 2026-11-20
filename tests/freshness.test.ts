import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FUNDING_SOURCE_DATE } from '../src/core/defaults';
import { assumptionsAgeMonths, assumptionsStale, STALE_AFTER_MONTHS } from '../src/core/freshness';
import { DEFAULT_SOURCES, OFFICIAL_REFS, SOURCE_KIND_LABEL } from '../src/core/sources';
import { SECTIONS } from '../src/ui/fields';
import { buildChecklist, REVIEW_KINDS } from '../scripts/assumptions-lib.ts';

describe('F22 Alter der Annahmen', () => {
  it('zählt volle Monate seit der letzten Prüfung', () => {
    expect(assumptionsAgeMonths(new Date(2026, 10, 11), '2026-11-11')).toBe(0);
    expect(assumptionsAgeMonths(new Date(2027, 4, 10), '2026-11-11')).toBe(5);
    expect(assumptionsAgeMonths(new Date(2027, 4, 11), '2026-11-11')).toBe(6);
    expect(assumptionsAgeMonths(new Date(2025, 0, 1), '2026-11-11')).toBe(0);
  });

  it(`gilt nach ${STALE_AFTER_MONTHS} Monaten als veraltet`, () => {
    expect(assumptionsStale(new Date(2027, 4, 10), '2026-11-11')).toBe(false);
    expect(assumptionsStale(new Date(2027, 4, 11), '2026-11-11')).toBe(true);
  });
});

describe('F22 Checkliste „Annahmen prüfen“', () => {
  const inp = { sections: SECTIONS, sources: DEFAULT_SOURCES, refs: OFFICIAL_REFS, kindLabels: SOURCE_KIND_LABEL, lastReview: '2026-11-11', today: '2027-01-01' };

  it('enthält genau die zeitkritischen Standardwerte mit Quelle', () => {
    const { title, body, count } = buildChecklist(inp);
    expect(title).toBe('Annahmen prüfen (2027-Q1)');
    expect(body).toContain('zuletzt geprüft am **11.11.2026**');
    const expected = SECTIONS.flatMap((s) => s.fields).filter((f) => {
      const src = DEFAULT_SOURCES[f.path];
      return src && REVIEW_KINDS.includes(src.kind);
    });
    // F22.1: the fixed line for the guide to the offer (docs/ANGEBOT.md) is a checkbox as well
    expect(count).toBe(expected.length + 1);
    expect(body).toContain('(`docs/ANGEBOT.md`)');
    expect(body.match(/^- \[ \] /gm)).toHaveLength(count);
    for (const f of expected) expect(body).toContain(`**${f.label}**`);
    // estimates and examples are the user's own values – not part of the review
    const own = SECTIONS.flatMap((s) => s.fields).find((f) => DEFAULT_SOURCES[f.path]?.kind === 'beispiel')!;
    expect(body).not.toContain(`**${own.label}**`);
    expect(body).toContain('FUNDING_SOURCE_DATE');
  });

  it('Skript läuft mit reinem Node (wie im Workflow) und schreibt Titel und Text', () => {
    const dir = mkdtempSync(join(tmpdir(), 'review-'));
    try {
      execFileSync('node', ['scripts/assumptions-checklist.ts', dir], { stdio: 'pipe' });
      expect(readFileSync(join(dir, 'title.txt'), 'utf8')).toMatch(/^Annahmen prüfen \(\d{4}-Q[1-4]\)$/);
      const body = readFileSync(join(dir, 'body.md'), 'utf8');
      expect(body).toContain(FUNDING_SOURCE_DATE.split('-').reverse().join('.'));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('Workflow läuft vierteljährlich und ohne npm', () => {
    const wf = readFileSync('.github/workflows/annahmen-pruefen.yml', 'utf8');
    expect(wf).toContain("cron: '0 6 1 1,4,7,10 *'");
    expect(wf).toContain('node scripts/assumptions-checklist.ts');
    expect(wf).not.toMatch(/run: npm/);
  });
});
