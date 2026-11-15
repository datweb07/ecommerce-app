import { expect, it } from 'vitest';
import {
  apiOrigin,
  assertSafeDatabase,
  assertSafeEnvironment,
  checkUploadAccount,
  missingFor,
  requireRunId,
  webOrigin,
} from '../e2e/safety';

it('rejects live Clerk and Stripe keys even in a public run without echoing them', () => {
  for (const [key, value] of Object.entries({
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_live_sensitive',
    CLERK_SECRET_KEY: 'sk_live_sensitive',
    STRIPE_SECRET_KEY: 'sk_live_sensitive',
  })) {
    expect(() => assertSafeEnvironment({ [key]: value })).toThrow(key);
    expect(() => assertSafeEnvironment({ [key]: value })).not.toThrow(value);
  }
  expect(() =>
    assertSafeEnvironment({
      E2E_WEB_ORIGIN: webOrigin,
      E2E_API_ORIGIN: apiOrigin,
      CLERK_SECRET_KEY: 'sk_test_fixture',
    }),
  ).not.toThrow();
});

it('rejects arbitrary targets, Mongo SRV, legacy database names and unsafe run IDs', () => {
  expect(() =>
    assertSafeEnvironment({ E2E_WEB_ORIGIN: 'https://production.example.com' }),
  ).toThrow();
  expect(() =>
    assertSafeDatabase('mongodb+srv://cluster.example.test/web_e2e'),
  ).toThrow();
  expect(() =>
    assertSafeDatabase('mongodb://127.0.0.1:27017/storefront_web'),
  ).toThrow();
  expect(() =>
    assertSafeDatabase('mongodb://127.0.0.1:27017/web_e2e?replicaSet=test'),
  ).not.toThrow();
  expect(() => requireRunId({ STOREFRONT_E2E_RUN: '../' })).toThrow();
});

it('classifies missing credentials and requires a confirmed Cloudinary test cloud', () => {
  expect(missingFor('public', {})).toEqual([]);
  expect(missingFor('payment', {}).sort()).toEqual([
    'CLERK_SECRET_KEY',
    'CLERK_WEBHOOK_SIGNING_SECRET',
    'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
  ]);
  expect(() =>
    checkUploadAccount({
      CLOUDINARY_CLOUD_NAME: 'prod',
      E2E_CLOUDINARY_CLOUD_NAME: 'test',
    }),
  ).toThrow();
});
