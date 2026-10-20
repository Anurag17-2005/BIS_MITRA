import { defineConfig } from '@playwright/test';

const PROD_USER = (process.env.PLAYWRIGHT_BASE_URL || 'https://bis-mitra-user.vercel.app').replace(/\/$/, '');

/** Run against deployed Vercel user portal + Railway APIs (no local dev server). */
export default defineConfig({
  testDir: './e2e',
  timeout: 120_000,
  expect: { timeout: 90_000 },
  fullyParallel: false,
  workers: 1,
  globalSetup: './e2e/global-setup.mjs',
  globalTeardown: './e2e/global-teardown.mjs',
  use: {
    baseURL: PROD_USER,
    trace: 'on-first-retry',
  },
});
