/// <reference types="vitest/config" />
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import { cspPlugin } from './csp';

export default defineConfig({
  base: './',
  plugins: [
    cspPlugin(),
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
