import { expect, it } from 'vitest';
import { stagingTarget } from '../e2e/staging-target.ts';

const host = 'test-fixture.clerk.accounts.dev';
const env = {
  DEPLOY_ENV: 'staging',
  STAGING_WEB_ORIGIN: 'https://shop-preview.vercel.app',
  STAGING_API_ORIGIN: 'https://shop-api.onrender.com',
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:
    'pk_test_' + Buffer.from(host + '$').toString('base64url'),
  CLERK_SECRET_KEY: 'sk_test_fixture',
  STAGING_TEST_EMAIL: 'demo@example.test',
  STAGING_TEST_PASSWORD: 'fixture-password',
};

it('accepts explicitly configured staging provider hostnames', () => {
  expect(stagingTarget(env)).toEqual({
    web: env.STAGING_WEB_ORIGIN,
    api: env.STAGING_API_ORIGIN,
    clerkHost: host,
  });
});

it('refuses production mode, live credentials and insecure or non-origin URLs', () => {
  for (const changes of [
    { DEPLOY_ENV: 'production' },
    { STRIPE_SECRET_KEY: 'sk_live_fixture' },
    { CLERK_SECRET_KEY: 'sk_live_fixture' },
    { STAGING_API_ORIGIN: 'http://shop-api.onrender.com' },
    { STAGING_WEB_ORIGIN: 'https://shop-preview.vercel.app/login' },
    { STAGING_TEST_EMAIL: undefined },
  ]) {
    expect(() => stagingTarget({ ...env, ...changes })).toThrow();
  }
});
