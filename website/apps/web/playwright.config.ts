import { defineConfig, devices } from '@playwright/test';
import { pathsFor } from './e2e/paths.ts';
import {
  assertSafeEnvironment,
  requireRunId,
  webOrigin,
} from './e2e/safety.ts';

assertSafeEnvironment(process.env);
const id = requireRunId(process.env);
const paths = pathsFor(id);
const publicMatch = '**/public.spec.ts';
const authMatch = '**/auth.spec.ts';
const browser = { ...devices['Desktop Chrome'] };
const mobile = { ...devices['Pixel 7'] };
const headedChannel = process.env.SMOKE_BROWSER_CHANNEL;
const chromiumChannel =
  headedChannel === 'msedge' || headedChannel === 'chrome'
    ? headedChannel
    : undefined;
const chromium = {
  ...browser,
  ...(chromiumChannel ? { channel: chromiumChannel } : {}),
};
const chromiumMobile = {
  ...mobile,
  ...(chromiumChannel ? { channel: chromiumChannel } : {}),
};

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 2,
  reporter: [['list'], ['html', { outputFolder: paths.report, open: 'never' }]],
  outputDir: paths.results,
  use: {
    baseURL: webOrigin,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command: 'node e2e/server.ts',
    url: webOrigin + '/robots.txt',
    reuseExistingServer: false,
    timeout: 240_000,
    gracefulShutdown: { signal: 'SIGTERM', timeout: 5000 },
  },
  projects: [
    { name: 'zap', testMatch: '**/zap.spec.ts' },
    {
      name: 'performance',
      testMatch: '**/performance.spec.ts',
      use: { ...chromium, trace: 'off', screenshot: 'off', video: 'off' },
    },
    {
      name: 'public-chromium',
      testMatch: [
        publicMatch,
        '**/accessibility.spec.ts',
        '**/security.spec.ts',
      ],
      use: chromium,
    },
    {
      name: 'public-mobile',
      testMatch: [publicMatch, '**/accessibility.spec.ts'],
      use: chromiumMobile,
    },
    {
      name: 'public-firefox',
      testMatch: publicMatch,
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'public-webkit',
      testMatch: publicMatch,
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'clerk-setup',
      testMatch: '**/clerk.setup.ts',
      use: { ...chromium, trace: 'off', screenshot: 'off', video: 'off' },
    },
    {
      name: 'auth-chromium',
      testMatch: [authMatch, '**/private-accessibility.spec.ts'],
      dependencies: ['clerk-setup'],
      use: { ...chromium, storageState: paths.state('customer') },
    },
    {
      name: 'auth-mobile',
      testMatch: [authMatch, '**/private-accessibility.spec.ts'],
      dependencies: ['clerk-setup'],
      use: { ...chromiumMobile, storageState: paths.state('customer') },
    },
    {
      name: 'payment-chromium',
      testMatch: '**/payment.spec.ts',
      dependencies: ['clerk-setup'],
      use: { ...chromium, storageState: paths.state('payer') },
    },
    {
      name: 'upload-chromium',
      testMatch: '**/upload.spec.ts',
      dependencies: ['clerk-setup'],
      use: { ...chromium, storageState: paths.state('admin') },
    },
  ],
});
