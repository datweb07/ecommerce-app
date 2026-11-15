import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, type NextFetchEvent } from 'next/server';
const fake = vi.hoisted(() => ({ userId: null as string | null }));
vi.mock('server-only', () => ({}));
vi.mock('../src/config/server-env', () => ({
  serverEnv: { CLERK_SECRET_KEY: 'configured' },
}));
vi.mock('@clerk/nextjs/server', () => ({
  clerkMiddleware:
    (
      handler: (
        auth: () => Promise<{ userId: string | null }>,
        request: NextRequest,
      ) => unknown,
    ) =>
    (request: NextRequest) =>
      handler(async () => ({ userId: fake.userId }), request),
}));
import { proxy } from '../src/proxy';
import { publicEnv } from '../src/config/public-env';
const event = {} as NextFetchEvent;
describe('route protection', () => {
  beforeEach(() => {
    fake.userId = null;
  });
  it('redirects anonymous private requests back to the exact path and query', async () => {
    const url =
      publicEnv.NEXT_PUBLIC_SITE_URL + '/checkout/return?session_id=123';
    const response = await proxy(new NextRequest(url), event);
    expect(response?.status).toBe(307);
    const location = new URL(String(response?.headers.get('location')));
    expect(location.pathname).toBe('/sign-in');
    expect(location.searchParams.get('redirect_url')).toBe(url);
    expect(response?.headers.get('cache-control')).toContain('no-store');
  });
  it('passes public requests through and marks authenticated account routes private', async () => {
    for (const route of [
      '/',
      '/products/example',
      '/sign-in',
      '/sign-up/verify',
      '/sitemap.xml',
      '/robots.txt',
      '/accounting',
    ]) {
      const response = await proxy(
        new NextRequest(publicEnv.NEXT_PUBLIC_SITE_URL + route),
        event,
      );
      expect(response?.headers.get('location')).toBeNull();
    }
    fake.userId = 'user_123';
    const response = await proxy(
      new NextRequest(publicEnv.NEXT_PUBLIC_SITE_URL + '/account/orders'),
      event,
    );
    expect(response?.headers.get('x-robots-tag')).toContain('noindex');
    expect(response?.headers.get('cache-control')).toContain('no-store');
  });
  it('preserves the full admin URL through sign-in and keeps it private', async () => {
    const url = publicEnv.NEXT_PUBLIC_SITE_URL + '/admin/orders?status=shipped';
    const guest = await proxy(new NextRequest(url), event);
    expect(guest?.status).toBe(307);
    expect(
      new URL(String(guest?.headers.get('location'))).searchParams.get(
        'redirect_url',
      ),
    ).toBe(url);
    fake.userId = 'user_123';
    const signedIn = await proxy(new NextRequest(url), event);
    expect(signedIn?.headers.get('location')).toBeNull();
    expect(signedIn?.headers.get('cache-control')).toContain('no-store');
    expect(signedIn?.headers.get('x-robots-tag')).toContain('noindex');
  });
});
