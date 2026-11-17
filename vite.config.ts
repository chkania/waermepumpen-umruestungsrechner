/// <reference types="vitest/config" />
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import { cspPlugin } from './csp';
import { version } from './package.json';

/**
 * Commit of the build: the checked-out HEAD (in the deploy workflow the release commit on main – GITHUB_SHA would be the
 * commit that triggered the workflow), GITHUB_SHA only without git.
 */
function buildCommit(): string {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return process.env.GITHUB_SHA ?? 'unbekannt';
  }
}

/** Writes version.json (version and commit) into the build – checked after every deployment (N15, scripts/smoke-test.ts). */
function versionFilePlugin(): Plugin {
  return {
    name: 'version-file',
    apply: 'build',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json', source: `${JSON.stringify({ version, commit: buildCommit() }, null, 2)}\n` });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [
    cspPlugin(),
    versionFilePlugin(),
  ],
  build: {
    rollupOptions: {
      // Calculator and user manual as separate pages
      input: {
        main: resolve(__dirname, 'index.html'),
        hilfe: resolve(__dirname, 'hilfe.html'),
        // License pages (N8): render LICENSE.md and THIRD-PARTY-NOTICES.md
        lizenz: resolve(__dirname, 'lizenz.html'),
        drittanbieter: resolve(__dirname, 'lizenzen-drittanbieter.html'),
        // Changelog (N9)
        changelog: resolve(__dirname, 'changelog.html'),
        // Legal pages: imprint and privacy policy (N11)
        impressum: resolve(__dirname, 'impressum.html'),
        datenschutz: resolve(__dirname, 'datenschutz.html'),
        // Derivation of all figures (F32)
        rechenweg: resolve(__dirname, 'rechenweg.html'),
      },
    },
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.test.ts'],
    // Test coverage (`npm run test:coverage`): calculation core and UI; page entry points only mount pages
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/main.ts', 'src/help-main.ts', 'src/pages/**', 'src/**/*.d.ts'],
      reporter: ['text', 'text-summary', 'html', 'json-summary'],
      reportsDirectory: 'coverage',
      // Minimum coverage, slightly below the current level: the run fails if coverage drops.
      // Stricter for the calculation core (amounts users decide on) than for the UI (charts cannot be drawn in tests).
      // Raise when coverage has grown – never lower.
      thresholds: {
        lines: 90,
        branches: 78,
        'src/core/**': { lines: 95, branches: 85 },
        'src/ui/**': { lines: 80, branches: 65 },
      },
    },
  },
});
