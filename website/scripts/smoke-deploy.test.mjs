import assert from 'node:assert/strict';
import { test } from 'node:test';
import { smokeDeploy, smokeOptions } from './smoke-deploy.mjs';

const env = {
  SMOKE_WEB_ORIGIN: 'https://www.example.com',
  SMOKE_API_ORIGIN: 'https://api.example.com',
  SMOKE_VERCEL_BYPASS_SECRET: 'test-only',
};
const fields = 'Authorization, Content-Type, Idempotency-Key, X-Request-Id';
const security = {
  'x-content-type-options': 'nosniff',
  'strict-transport-security': 'max-age=300',
  'content-security-policy': "frame-ancestors 'none'",
};

function fixtures({ web, api, tier, apex }, flags = {}) {
  const calls = [];
  const json = (data, status = 200, headers = {}) =>
    new globalThis.Response(JSON.stringify(data), {
      status,
      headers: { 'content-type': 'application/json', ...headers },
    });
  const error = {
    requestId: 'fixture-request',
    error: { code: 'DENIED', message: 'Denied' },
  };
  const redirect = (location) =>
    new globalThis.Response(null, {
      status: 308,
      headers: location ? { location } : {},
    });
  return {
    calls,
    report() {},
    async certificate(url) {
      assert.ok([web.origin, api.origin, apex?.origin].includes(url.origin));
    },
    async request(url, init) {
      calls.push({ url, init });
      assert.equal(init.redirect, 'manual');
      if (url.protocol === 'http:')
        return redirect(
          flags.insecureRedirect ? '/' : 'https://' + url.hostname + '/',
        );
      if (url.origin === apex?.origin) return redirect(web.origin + '/');
      if (url.origin === web.origin) {
        if (url.pathname === '/')
          return new globalThis.Response('Storefront', {
            headers: {
              ...security,
              'content-type': 'text/html',
              ...(tier === 'staging'
                ? { 'x-robots-tag': 'noindex, nofollow' }
                : {}),
            },
          });
        if (url.pathname === '/robots.txt')
          return new globalThis.Response(
            tier === 'staging'
              ? 'User-Agent: *\nDisallow: /\n'
              : 'Disallow: /admin\nSitemap: ' + web.origin + '/sitemap.xml',
          );
        if (url.pathname === '/sitemap.xml')
          return new globalThis.Response(
            '<loc>' + web.origin + '/products</loc>',
          );
        if (url.pathname === '/account') return redirect('/sign-in');
      }
      if (url.origin === api.origin) {
        if (init.method === 'OPTIONS')
          return new globalThis.Response(null, {
            status: 204,
            headers: {
              vary: 'Origin',
              'access-control-allow-methods': 'POST',
              'access-control-allow-headers': fields,
              ...(init.headers.Origin === web.origin || flags.allowForeign
                ? { 'access-control-allow-origin': init.headers.Origin }
                : {}),
            },
          });
        if (url.pathname === '/health/ready')
          return json({ status: 'ok' }, 200, security);
        if (url.pathname === '/api/v1/products')
          return json({ items: [{ id: 'fixture' }] }, 200, {
            'access-control-allow-origin': web.origin,
            'access-control-expose-headers': 'x-request-id',
            'x-request-id': 'fixture-request',
          });
        if (url.pathname === '/api/v1/me') return json(error, 401);
        if (url.pathname.startsWith('/api/v1/webhooks/'))
          return json(error, flags.acceptWebhook ? 200 : 400);
      }
      return new globalThis.Response(null, { status: 404 });
    },
  };
}

test('production probes are fixed, verify apex, and keep the bypass on HTTPS web requests', async () => {
  const options = smokeOptions(['--', '--env', 'production'], env);
  const mock = fixtures(options);
  assert.deepEqual(await smokeDeploy(options, mock), []);
  assert.ok(mock.calls.some(({ url }) => url.origin === 'https://example.com'));
  for (const { url, init } of mock.calls) {
    assert.equal(
      Boolean(init.headers['x-vercel-protection-bypass']),
      url.origin === options.web.origin,
    );
    if (init.method === 'POST') {
      assert.match(url.pathname, /^\/api\/v1\/webhooks\/(clerk|stripe)$/);
      assert.deepEqual(init.headers, { 'content-type': 'application/json' });
      assert.equal(init.body, '{}');
    }
  }
});

test('staging checks crawling and fails for HTTP redirects, permissive CORS and accepted unsigned events', async () => {
  const options = smokeOptions(['--env', 'staging'], {
    ...env,
    SMOKE_WEB_ORIGIN: 'https://staging.example.com',
  });
  assert.deepEqual(await smokeDeploy(options, fixtures(options)), []);
  assert.deepEqual(
    await smokeDeploy(
      options,
      fixtures(options, {
        insecureRedirect: true,
        allowForeign: true,
        acceptWebhook: true,
      }),
    ),
    [
      'HTTP redirect web',
      'HTTP redirect api',
      'CORS preflight denied',
      'Unsigned webhook clerk rejected',
      'Unsigned webhook stripe rejected',
    ],
  );
});

test('invalid targets and arbitrary probe flags fail before network access', () => {
  assert.throws(
    () => smokeOptions(['--env', 'production', '--write'], env),
    /Usage/,
  );
  assert.throws(
    () =>
      smokeOptions(['--env', 'production'], {
        ...env,
        SMOKE_API_ORIGIN: 'https://127.0.0.1',
      }),
    /SMOKE_API_ORIGIN/,
  );
  assert.throws(
    () =>
      smokeOptions(['--env', 'production'], {
        ...env,
        SMOKE_APEX_ORIGIN: 'https://other.example.com',
      }),
    /SMOKE_APEX_ORIGIN/,
  );
});
