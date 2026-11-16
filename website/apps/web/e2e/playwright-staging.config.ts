import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: 'hosted-staging.spec.ts',
  outputDir: '../../../.cache/e2e-hosted-staging',
  reporter: 'list',
  timeout: 60_000,
  workers: 1,
  use: {
    ...devices['Desktop Chrome'],
    trace: 'off',
    screenshot: 'off',
    video: 'off',
  },
});
