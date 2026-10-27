import { describe, expect, it } from 'vitest';
import { parseEnv } from '../src/config/env.js';

describe('environment configuration', () => {
  it('runs locally with no external secrets and configures the approved price policy', () => {
    const env = parseEnv({});
    expect(env.MONGODB_URI).toContain('/storefront_web?');
    expect([env.CURRENCY, env.SHIPPING_FEE_CENTS, env.TAX_RATE]).toEqual([
      'usd',
      1000,
      0.08,
    ]);
  });
  it.each([
    { PORT: '0' },
    { PORT: '1.5' },
    { MONGODB_URI: 'https://invalid' },
    { CORS_ORIGINS: '*' },
    { CORS_ORIGINS: 'https://example.com/path' },
    { SHIPPING_FEE_CENTS: '-1' },
    { SHIPPING_FEE_CENTS: '1.5' },
    { TAX_RATE: '1.1' },
    { STRIPE_SECRET_KEY: 'sk_live_do_not_log' },
  ])('rejects invalid configuration without printing values (%o)', (values) => {
    expect(() => parseEnv(values)).toThrow('Invalid environment:');
    try {
      parseEnv(values);
    } catch (error) {
      expect(String(error)).not.toContain('sk_live_do_not_log');
    }
  });
});
