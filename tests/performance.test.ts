import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = (f: string) => readFileSync(join(process.cwd(), 'src', f), 'utf8');
const staticImports = (code: string) => [...code.matchAll(/^import\s[^;]*?from\s+'([^']+)'/gms)].map((m) => m[1]);

describe('N14 Ladezeit: Chart.js und Quellen-Popover erst bei Bedarf', () => {
  it('nur chart-render.ts bindet Chart.js statisch ein, die App lädt es dynamisch nach', () => {
    const uiFiles = readdirSync(join(process.cwd(), 'src', 'ui')).filter((f) => f.endsWith('.ts'));
    const withChartJs = uiFiles.filter((f) => staticImports(src(`ui/${f}`)).includes('chart.js'));
    expect(withChartJs).toEqual(['chart-render.ts']);
    for (const f of uiFiles) expect(staticImports(src(`ui/${f}`)), f).not.toContain('./chart-render');
    expect(src('ui/app.ts')).toMatch(/import\('\.\/chart-render'\)/);
  });
});
