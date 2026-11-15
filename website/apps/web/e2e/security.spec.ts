import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { pathsFor } from './paths.ts';
import {
  apiOrigin,
  assertSafeEnvironment,
  requireRunId,
  webOrigin,
} from './safety.ts';

const publicRoutes = new Set([
  'GET /health/live',
  'GET /health/ready',
  'GET /api/v1/banners',
  'GET /api/v1/categories',
  'GET /api/v1/products',
  'GET /api/v1/products/{id}',
  'GET /api/v1/products/{id}/related',
  'GET /api/v1/products/{id}/reviews',
  'POST /api/v1/webhooks/clerk',
  'POST /api/v1/webhooks/stripe',
]);

test.beforeAll(() => assertSafeEnvironment(process.env));

test(
  'production static assets expose no source maps or embedded server keys',
  { tag: '@public' },
  async () => {
    const root = join(
      pathsFor(requireRunId(process.env)).project,
      '.next',
      'static',
    );
    const findings: string[] = [];
    for (const file of await readdir(root, {
      recursive: true,
      withFileTypes: true,
    })) {
      if (!file.isFile()) continue;
      if (file.name.endsWith('.map')) findings.push(file.name + ' source map');
      if (!file.name.endsWith('.js')) continue;
      const source = await readFile(join(file.parentPath, file.name), 'utf8');
      if (
        /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{24,}|\bwhsec_[A-Za-z0-9]{24,}|mongodb\+srv:\/\/[^"\s]+:[^"\s]+@/.test(
          source,
        )
      )
        findings.push(file.name + ' credential pattern');
    }
    expect(findings).toEqual([]);
  },
);

test(
  'OpenAPI route inventory classifies every public operation and requires Bearer elsewhere',
  { tag: '@public' },
  async ({ request }) => {
    const spec = await request.get(apiOrigin + '/openapi.json');
    expect(spec.ok()).toBe(true);
    const { paths } = (await spec.json()) as {
      paths: Record<string, Record<string, { security?: unknown }>>;
    };
    const seen = new Set<string>();
    for (const [path, operations] of Object.entries(paths)) {
      for (const [method, operation] of Object.entries(operations)) {
        const route = method.toUpperCase() + ' ' + path;
        if (publicRoutes.has(route)) {
          expect(operation.security ?? [], route).toEqual([]);
          seen.add(route);
        } else {
          expect(operation.security, route).toEqual([{ clerkBearer: [] }]);
        }
      }
    }
    expect(seen).toEqual(publicRoutes);
    for (const path of [
      '/me',
      '/cart',
      '/wishlist',
      '/addresses',
      '/orders',
      '/notifications',
      '/admin/me',
      '/admin/customers',
      '/admin/stats',
    ]) {
      const response = await request.get(apiOrigin + '/api/v1' + path);
      expect(response.status(), path).toBe(401);
    }
  },
);

test(
  'rejects cross-origin preflight and unsafe query shapes; preserves safe request IDs',
  { tag: '@public' },
  async ({ request }) => {
    const endpoint = apiOrigin + '/api/v1/products';
    const preflight = (origin: string) =>
      request.fetch(endpoint, {
        method: 'OPTIONS',
        headers: {
          origin,
          'access-control-request-method': 'GET',
          'access-control-request-headers': 'Authorization,X-Request-Id',
        },
      });
    const allowed = (await preflight(webOrigin)).headers();
    expect(allowed['access-control-allow-origin']).toBe(webOrigin);
    expect(allowed['access-control-allow-credentials']).toBeUndefined();
    expect(
      (await preflight('https://untrusted.invalid')).headers()[
        'access-control-allow-origin'
      ],
    ).toBeUndefined();
    for (const query of [
      '?q[$ne]=x',
      '?$where=1',
      '?minPrice[$gt]=10',
      '?limit=101',
      '?page=9999999',
    ]) {
      const response = await request.get(endpoint + query, {
        headers: { 'x-request-id': 'phase5-probe-01' },
      });
      expect(response.status(), query).toBe(400);
      expect(response.headers()['x-request-id']).toBe('phase5-probe-01');
      expect(await response.json()).toMatchObject({
        requestId: 'phase5-probe-01',
      });
    }
    expect((await request.get(endpoint + '/invalid')).status()).toBe(400);
    const web = await request.get('/');
    expect(web.headers()['x-powered-by']).toBeUndefined();
    expect(web.headers()['x-content-type-options']).toBe('nosniff');
    expect(web.headers()['x-frame-options']).toBe('DENY');
    expect(web.headers()['strict-transport-security']).toContain('max-age=');
    expect(web.headers()['content-security-policy-report-only']).toContain(
      "frame-ancestors 'none'",
    );
    expect(web.headers()['content-security-policy']).toBeUndefined();
  },
);

test(
  'collects CSP reports without URLs, script samples or session data',
  { tag: '@public' },
  async ({ page }) => {
    const events: string[] = [];
    page.on('console', (message) => {
      const text = message.text();
      if (text.startsWith('CSP audit: '))
        events.push(text.slice('CSP audit: '.length));
    });
    await page.addInitScript(() => {
      document.addEventListener('securitypolicyviolation', (event) => {
        if (event.disposition === 'report')
          console.info('CSP audit: ' + event.effectiveDirective);
      });
    });
    for (const path of ['/', '/products', '/sign-in']) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await test.info().attach('directives ' + path, {
        body: JSON.stringify([...new Set(events.splice(0))].sort()),
        contentType: 'application/json',
      });
    }
  },
);
