import { generateKeyPairSync, sign } from 'node:crypto';
import { expect, it, vi } from 'vitest';
import { parseEnv } from '../src/config/env.js';
import { clerkAdapter } from '../src/plugins/clerk.js';

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
});
const issuer = 'https://storefront-fixture.clerk.accounts.dev';

vi.mock('@clerk/fastify', async (importOriginal) => {
  const sdk = await importOriginal<typeof import('@clerk/fastify')>();
  return {
    ...sdk,
    createClerkClient: (options: Parameters<typeof sdk.createClerkClient>[0]) =>
      sdk.createClerkClient({
        ...options,
        jwtKey: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
        telemetry: { disabled: true },
      }),
  };
});

function bearer(azp: string) {
  const json = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const payload = [
    // Session-token category used by the installed Clerk Backend SDK.
    json({ alg: 'RS256', typ: 'JWT', kid: 'fixture', cat: 'cl_B7d4PD111AAA' }),
    json({
      azp,
      sub: 'user_fixture',
      sid: 'sess_fixture',
      iss: issuer,
      iat: now,
      exp: now + 60,
      nbf: now - 10,
    }),
  ].join('.');
  return (
    'Bearer ' +
    payload +
    '.' +
    sign('RSA-SHA256', Buffer.from(payload), privateKey).toString('base64url')
  );
}

it('verifies signed Clerk tokens against the exact storefront and preview origins', async () => {
  const web = 'https://storefront-staging.vercel.app';
  const preview = 'https://storefront-preview.vercel.app';
  const adapter = clerkAdapter(
    parseEnv({
      NODE_ENV: 'test',
      WEB_ORIGIN: web,
      CORS_ORIGINS: web + ',' + preview,
      CLERK_PUBLISHABLE_KEY:
        'pk_test_' +
        Buffer.from(new URL(issuer).hostname + '$').toString('base64url'),
      CLERK_SECRET_KEY: 'sk_test_fixture',
    }),
  );
  expect(adapter).toBeDefined();
  for (const origin of [web, preview]) {
    await expect(adapter?.authenticate(bearer(origin))).resolves.toBe(
      'user_fixture',
    );
  }
  for (const origin of ['https://other.vercel.app', web + '.invalid']) {
    await expect(adapter?.authenticate(bearer(origin))).resolves.toBeNull();
  }
});
