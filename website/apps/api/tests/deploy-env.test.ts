import { expect, it } from 'vitest';
import { parseEnv } from '../src/config/env.js';

const staging = {
  DEPLOY_ENV: 'staging',
  NODE_ENV: 'production',
  HOST: '0.0.0.0',
  WEB_ORIGIN: 'https://staging.example.com',
  CORS_ORIGINS: 'https://staging.example.com',
  MONGODB_URI: 'mongodb+srv://example.mongodb.net/web_staging',
  CLERK_PUBLISHABLE_KEY: 'pk_test_fixture',
  CLERK_SECRET_KEY: 'sk_test_fixture',
  CLERK_WEBHOOK_SIGNING_SECRET: 'whsec_fixture',
  ADMIN_EMAIL: 'admin@example.com',
  CLOUDINARY_CLOUD_NAME: 'fixture',
  CLOUDINARY_API_KEY: 'fixture',
  CLOUDINARY_API_SECRET: 'fixture',
  STRIPE_SECRET_KEY: 'sk_test_fixture',
  STRIPE_WEBHOOK_SECRET: 'whsec_fixture',
};

it('requires a deployment target with production Node and isolates staging', () => {
  expect(() => parseEnv({ NODE_ENV: 'production' })).toThrow(/DEPLOY_ENV/);
  expect(parseEnv(staging).DEPLOY_ENV).toBe('staging');
  expect(() =>
    parseEnv({ ...staging, CLERK_SECRET_KEY: 'sk_live_fixture' }),
  ).toThrow(/CLERK_SECRET_KEY/);
  expect(() =>
    parseEnv({ ...staging, STRIPE_SECRET_KEY: 'sk_live_fixture' }),
  ).toThrow(/STRIPE_SECRET_KEY/);
  expect(() =>
    parseEnv({ ...staging, CORS_ORIGINS: 'http://localhost:3000' }),
  ).toThrow(/CORS_ORIGINS/);
  expect(() =>
    parseEnv({
      ...staging,
      MONGODB_URI: 'mongodb+srv://example.mongodb.net/web_e2e',
    }),
  ).toThrow(/MONGODB_URI/);
  expect(() =>
    parseEnv({ ...staging, CLERK_SECRET_KEY: 'sk_live_hidden' }),
  ).toThrow(/^Invalid environment: CLERK_SECRET_KEY$/);
});

it('accepts production catalogue settings and rejects both checkout modes until live activation is implemented', () => {
  const prod = {
    ...staging,
    DEPLOY_ENV: 'production',
    MONGODB_URI: 'mongodb+srv://example.mongodb.net/web_prod',
    WEB_ORIGIN: 'https://www.example.com',
    CORS_ORIGINS: 'https://www.example.com',
    CLERK_PUBLISHABLE_KEY: 'pk_live_fixture',
    CLERK_SECRET_KEY: 'sk_live_fixture',
    STRIPE_SECRET_KEY: undefined,
    STRIPE_WEBHOOK_SECRET: undefined,
  };
  expect(parseEnv(prod).DEPLOY_ENV).toBe('production');
  expect(() =>
    parseEnv({ ...prod, CLERK_PUBLISHABLE_KEY: 'pk_test_fixture' }),
  ).toThrow(/CLERK_PUBLISHABLE_KEY/);
  expect(() =>
    parseEnv({ ...prod, STRIPE_SECRET_KEY: 'sk_test_fixture' }),
  ).toThrow(/STRIPE_SECRET_KEY/);
  expect(() =>
    parseEnv({ ...prod, STRIPE_SECRET_KEY: 'sk_live_fixture' }),
  ).toThrow(/STRIPE_SECRET_KEY/);
  expect(() => parseEnv({ ...prod, DEPLOY_ENV: 'local' })).toThrow(
    /MONGODB_URI/,
  );
});
