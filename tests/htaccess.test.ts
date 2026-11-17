import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (f: string) => readFileSync(join(root, f), 'utf8');

describe('F33.6 .htaccess aus dem Repository', () => {
  const htaccess = read('public/.htaccess');

  it('leitet alle anderen Hostnamen per 301 auf die Hauptdomain weiter, Pfad und Parameter bleiben', () => {
    expect(htaccess).toContain('RewriteCond %{HTTP_HOST} !^waermepumpen-investitionsrechner\\.de$ [NC]');
    expect(htaccess).toContain('RewriteRule ^ https://waermepumpen-investitionsrechner.de%{REQUEST_URI} [R=301,L,NE]');
  });

  it('Cache-Regeln: HTML nicht zwischenspeichern, Assets ein Jahr, Favicon eine Woche', () => {
    expect(htaccess).toContain('Header set Cache-Control "no-cache"');
    expect(htaccess).toContain('Header set Cache-Control "public, max-age=31536000, immutable"');
    expect(htaccess).toContain('Header set Cache-Control "public, max-age=604800"');
  });

  it('Sicherheitsheader gesetzt', () => {
    for (const h of ['Strict-Transport-Security', 'Cross-Origin-Opener-Policy', 'X-Frame-Options "DENY"', 'X-Content-Type-Options "nosniff"', 'Referrer-Policy']) {
      expect(htaccess, h).toContain(h);
    }
  });

  it('Deployment überträgt .htaccess und bricht ohne sie ab', () => {
    const deploy = read('.github/workflows/deploy.yml');
    expect(deploy).not.toMatch(/--exclude='\.htaccess'/);
    expect(deploy).toContain("[ -f dist/.htaccess ]");
    expect(deploy).toContain("--exclude='.well-known/'");
  });
});
