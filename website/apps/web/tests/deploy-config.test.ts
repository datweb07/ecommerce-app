import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

function environment(tier: 'staging' | 'production') {
  const mode = tier === 'staging' ? 'test' : 'live';
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('DEPLOY_ENV', tier);
  vi.stubEnv('VERCEL_ENV', 'production');
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://web.example.com');
  vi.stubEnv('API_INTERNAL_URL', 'https://api.example.com');
  vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://api.example.com');
  vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_' + mode + '_fixture');
  vi.stubEnv('CLERK_SECRET_KEY', 'sk_' + mode + '_fixture');
  vi.stubEnv('CLOUDINARY_IMAGE_CLOUD_NAME', 'storefront-fixture');
  vi.stubEnv('WEB_HSTS_MAX_AGE', undefined);
}

it('blocks crawling on the staging custom domain and applies baseline hosted security', async () => {
  environment('staging');
  const { default: nextConfig } = await import('../next.config');
  const { default: robots } = await import('../src/app/robots');
  const [rule] = (await nextConfig.headers?.()) ?? [];
  expect(rule?.headers).toEqual(
    expect.arrayContaining([
      { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
      { key: 'Strict-Transport-Security', value: 'max-age=300' },
      {
        key: 'Content-Security-Policy',
        value: "base-uri 'self'; object-src 'none'; frame-ancestors 'none'",
      },
      {
        key: 'Content-Security-Policy-Report-Only',
        value: expect.stringContaining('script-src'),
      },
    ]),
  );
  expect(robots()).toEqual({ rules: { userAgent: '*', disallow: '/' } });
  expect(nextConfig.images?.remotePatterns).toContainEqual({
    protocol: 'https',
    hostname: 'res.cloudinary.com',
    pathname: '/storefront-fixture/image/upload/**',
  });
});

it('preserves the canonical sitemap for production and permits a reviewed HSTS increase', async () => {
  environment('production');
  vi.stubEnv('WEB_HSTS_MAX_AGE', '86400');
  const { default: nextConfig } = await import('../next.config');
  const { default: robots } = await import('../src/app/robots');
  const [rule] = (await nextConfig.headers?.()) ?? [];
  expect(rule?.headers.some((header) => header.key === 'X-Robots-Tag')).toBe(
    false,
  );
  expect(rule?.headers).toContainEqual({
    key: 'Strict-Transport-Security',
    value: 'max-age=86400',
  });
  expect(robots().sitemap).toBe('https://web.example.com/sitemap.xml');
});
