/// <reference types="vitest/config" />
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import { cspPlugin } from './csp';

export default defineConfig({
  base: './',
  plugins: [cspPlugin()],
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
