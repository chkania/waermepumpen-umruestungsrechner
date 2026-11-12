/// <reference types="vitest/config" />
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';
import { cspPlugin } from './csp';

export default defineConfig({
  base: './',
  plugins: [
    cspPlugin(),
    {
      // Lizenz und Drittanbieter-Lizenzen gehören zum ausgelieferten Build (Seitenfuß verlinkt sie)
      name: 'wp-license-files',
      apply: 'build',
      generateBundle() {
        for (const fileName of ['LICENSE.md', 'THIRD-PARTY-NOTICES.md']) {
          this.emitFile({ type: 'asset', fileName, source: readFileSync(resolve(__dirname, fileName), 'utf8') });
        }
      },
    },
  ],
  build: {
    rollupOptions: {
      // Rechner und Benutzerhandbuch als eigene Seiten
      input: {
        main: resolve(__dirname, 'index.html'),
        hilfe: resolve(__dirname, 'hilfe.html'),
      },
    },
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.test.ts'],
  },
});
