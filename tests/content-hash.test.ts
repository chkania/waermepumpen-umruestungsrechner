import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { contentHash, deployDecision, hashOf, listFiles } from '../scripts/content-hash-lib.ts';

let dir: string;
const put = (rel: string, text: string) => {
  const file = join(dir, rel);
  mkdirSync(join(file, '..'), { recursive: true });
  writeFileSync(file, text);
};

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'wpir-dist-'));
  put('index.html', '<html></html>');
  put('assets/main-abc.js', 'console.log(1)');
  put('.htaccess', 'Header set X 1');
  put('version.json', '{"version":"1.0.0","commit":"aaa"}');
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('N12.2 Inhalts-Hash des Builds', () => {
  it('listet alle Dateien sortiert, auch versteckte und verschachtelte', () => {
    expect(listFiles(dir)).toEqual(['.htaccess', 'assets/main-abc.js', 'index.html', 'version.json']);
  });

  it('ist ein stabiler SHA-256 und ändert sich nicht mit version.json (Commit)', () => {
    const h = contentHash(dir);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    put('version.json', '{"version":"1.0.0","commit":"bbb","contentHash":"x"}');
    expect(contentHash(dir)).toBe(h);
  });

  it('ändert sich bei geändertem Inhalt, neuer, umbenannter oder entfernter Datei', () => {
    const h = contentHash(dir);
    put('index.html', '<html>neu</html>');
    const changed = contentHash(dir);
    expect(changed).not.toBe(h);
    put('neu.txt', 'x');
    const added = contentHash(dir);
    expect(added).not.toBe(changed);
    rmSync(join(dir, 'neu.txt'));
    expect(contentHash(dir)).toBe(changed);
    // same content under another name is a different build
    rmSync(join(dir, 'assets/main-abc.js'));
    put('assets/main-def.js', 'console.log(1)');
    expect(contentHash(dir)).not.toBe(changed);
  });

  it('hashOf liest nur einen gültigen SHA-256 aus version.json', () => {
    const h = 'a'.repeat(64);
    expect(hashOf({ contentHash: h })).toBe(h);
    for (const bad of [null, 'x', {}, { contentHash: 'abc' }, { contentHash: 'A'.repeat(64) }, { contentHash: 5 }]) expect(hashOf(bad)).toBeNull();
  });

  it('Entscheidung: nur bei gleichem Hash entfällt das Deployment', () => {
    const h = 'a'.repeat(64);
    const other = 'b'.repeat(64);
    expect(deployDecision({ contentHash: h }, h)).toMatchObject({ needed: false });
    expect(deployDecision({ contentHash: other }, h)).toMatchObject({ needed: true });
    expect(deployDecision({ version: '1.0.0' }, h)).toMatchObject({ needed: true }); // live version.json without hash
    expect(deployDecision(null, h)).toMatchObject({ needed: true }); // live site unreachable
    expect(deployDecision({ contentHash: h }, null)).toMatchObject({ needed: true }); // build without hash
  });

  it('ein manueller Lauf stellt immer bereit', () => {
    const h = 'a'.repeat(64);
    expect(deployDecision({ contentHash: h }, h, true)).toMatchObject({ needed: true });
  });

  it('der Build schreibt den Hash in version.json und der Workflow überspringt Deploy und Verify bei Gleichheit', () => {
    expect(JSON.parse(readFileSync('package.json', 'utf8')).scripts.build).toMatch(/node scripts\/content-hash\.ts$/);
    const wf = readFileSync('.github/workflows/deploy.yml', 'utf8');
    expect(wf).toMatch(/node scripts\/deploy-needed\.ts/);
    expect(wf).toMatch(/FORCE: \$\{\{ github\.event_name == 'workflow_dispatch' \}\}/);
    const deploy = wf.slice(wf.indexOf('\n  deploy:'), wf.indexOf('\n  verify:'));
    expect(deploy).toMatch(/if: needs\.build\.outputs\.changed == 'true'/);
    const verify = wf.slice(wf.indexOf('\n  verify:'));
    expect(verify).toMatch(/needs: \[build, deploy\]/);
    expect(verify).toMatch(/if: needs\.build\.outputs\.changed == 'true'/);
  });
});
