import { expect, it } from 'vitest';
import { assertWebDeployment } from '../src/config/deploy-env';

it('allows a disconnected loopback build but requires an explicit deployment target', () => {
  expect(() => assertWebDeployment({ NODE_ENV: 'production' })).toThrow(
    'DEPLOY_ENV',
  );
  expect(() =>
    assertWebDeployment({
      NODE_ENV: 'production',
      DEPLOY_ENV: 'local',
      API_INTERNAL_URL: 'http://127.0.0.1:1',
    }),
  ).not.toThrow();
  expect(() =>
    assertWebDeployment({
      NODE_ENV: 'production',
      DEPLOY_ENV: 'local',
      API_INTERNAL_URL: 'https://api.example.com',
    }),
  ).toThrow('API_INTERNAL_URL');
});

it('requires hosted origins and the Clerk keys for the selected mode', () => {
  const staging = {
    NODE_ENV: 'production',
    DEPLOY_ENV: 'staging',
    NEXT_PUBLIC_SITE_URL: 'https://staging.example.com',
    NEXT_PUBLIC_API_URL: 'https://api-staging.example.com',
    API_INTERNAL_URL: 'https://api-staging.example.com',
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_fixture',
    CLERK_SECRET_KEY: 'sk_test_fixture',
  };
  expect(() => assertWebDeployment(staging)).not.toThrow();
  expect(() =>
    assertWebDeployment({ ...staging, DEPLOY_ENV: 'production' }),
  ).toThrow(/NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, CLERK_SECRET_KEY/);
  expect(() =>
    assertWebDeployment({ ...staging, CLERK_SECRET_KEY: 'sk_live_hidden' }),
  ).toThrow(/^Invalid environment: CLERK_SECRET_KEY$/);
  expect(() =>
    assertWebDeployment({
      ...staging,
      NEXT_PUBLIC_SITE_URL: 'http://localhost:3000',
    }),
  ).toThrow('NEXT_PUBLIC_SITE_URL');
});
