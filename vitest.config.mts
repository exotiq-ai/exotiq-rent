import { defineConfig } from 'vitest/config';

// Next preserves JSX for its own compiler. Vitest/Vite 8 must transform the
// component tests instead; do not change the application's TypeScript contract.
export default defineConfig({
  oxc: { jsx: { runtime: 'automatic' } },
});
