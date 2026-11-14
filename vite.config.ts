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
      },
    },
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.test.ts'],
  },
});
