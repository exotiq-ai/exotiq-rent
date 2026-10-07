import { fileURLToPath } from 'node:url';
import { defineConfig,configDefaults } from 'vitest/config';

// Next preserves JSX for its own compiler. Vitest/Vite 8 must transform the
// component tests instead; do not change the application's TypeScript contract.
export default defineConfig({
  test:{exclude:[...configDefaults.exclude,'tests/agent/*-browser.spec.ts']},
  oxc: { jsx: { runtime: 'automatic' } },
  resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
});
