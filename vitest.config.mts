import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// .mts so Vite loads this config as native ESM: a .ts config in a package
// without "type": "module" goes through Vite's deprecated CJS loader and
// prints a warning on every run. ESM has no __dirname, so the project root
// comes from import.meta.url instead.
const root = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
    // Per-file isolation with a fresh jsdom is deliberate (module mocks and
    // the in-memory access token must not leak between files), so Vitest's
    // "isolate: false / pool: 'vmThreads'" performance hints are noise here.
    experimental: { diagnostics: false },
  },
  resolve: {
    alias: { '@': root },
  },
});
