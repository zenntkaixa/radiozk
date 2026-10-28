import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// UI/unit tests only; the node:test parser tests (test/*.test.mjs) and the Playwright e2e run separately.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['test/**/*.test.{ts,tsx}'],
    setupFiles: ['test/setup.ts'],
    restoreMocks: true,
  },
});
