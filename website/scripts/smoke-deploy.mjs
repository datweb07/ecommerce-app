import { connect } from 'node:tls';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { URL } from 'node:url';

const redirects = new Set([301, 302, 303, 307, 308]);
const timeout = 10_000;
class ProbeError extends Error {}

function expect(condition, reason) {
  if (!condition) throw new ProbeError(reason);
}

function origin(value, name) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('Invalid configuration: ' + name);
  }
  expect(
    url.protocol === 'https:' &&
      url.origin === value &&
      !url.port &&
      /^(?:[a-z0-9-]+\.)+[a-z]{2,}$/.test(url.hostname) &&
      !/\.(?:localhost|local|test|internal|invalid|example)$/.test(
        url.hostname,
      ),
    'Invalid configuration: ' + name,
  );
  return url;
}

export function smokeOptions(args, env) {
  const flags = args[0] === '--' ? args.slice(1) : args;
  expect(
    flags.length === 2 &&
      flags[0] === '--env' &&
      ['staging', 'production'].includes(flags[1]),
    'Usage: pnpm smoke:deploy -- --env staging|production',
  );
  const tier = flags[1];
  const web = origin(env.SMOKE_WEB_ORIGIN, 'SMOKE_WEB_ORIGIN');
  const api = origin(env.SMOKE_API_ORIGIN, 'SMOKE_API_ORIGIN');
  expect(
    web.origin !== api.origin,
    'SMOKE_WEB_ORIGIN and SMOKE_API_ORIGIN must be different',
  );
  let apex;
  if (tier === 'production') {
    expect(
      web.hostname.startsWith('www.'),
      'Production SMOKE_WEB_ORIGIN must use www',
    );
    apex = origin(
      env.SMOKE_APEX_ORIGIN || 'https://' + web.hostname.slice(4),
      'SMOKE_APEX_ORIGIN',
    );
    expect(
      web.hostname === 'www.' + apex.hostname,
      'SMOKE_APEX_ORIGIN does not match SMOKE_WEB_ORIGIN',
    );
  } else {
    expect(
      !env.SMOKE_APEX_ORIGIN,
      'SMOKE_APEX_ORIGIN is only used in production',
    );
  }
  return { tier, web, api, apex, bypass: env.SMOKE_VERCEL_BYPASS_SECRET };
}

function validateCertificate(url) {
  return new Promise((accept, reject) => {
    const socket = connect({
      host: url.hostname,
      port: 443,
      servername: url.hostname,
      rejectUnauthorized: true,
    });
    socket.setTimeout(timeout, () => socket.destroy(new Error('TLS timeout')));
    socket.once('error', reject);
    socket.once('secureConnect', () => {
      const expiry = Date.parse(socket.getPeerCertificate().valid_to ?? '');
      socket.end();
      if (!Number.isFinite(expiry) || expiry <= Date.now())
        reject(new Error('Invalid certificate expiration'));
      else accept();
    });
  });
}

function readHeaders(value) {
  return (value ?? '').split(',').map((item) => item.trim().toLowerCase());
}

async function readJson(response) {
  expect(
    /\bapplication\/json\b/i.test(response.headers.get('content-type') ?? ''),
    'Expected JSON response',
  );
  return response.json();
}

function checkError(body) {
  expect(
    body &&
      typeof body === 'object' &&
      typeof body.requestId === 'string' &&
      typeof body.error?.code === 'string' &&
      typeof body.error?.message === 'string',
    'Unexpected API error shape',
  );
  expect(
    !/"(?:stack|stackTrace)"\s*:/i.test(JSON.stringify(body)),
    'Unexpected stack details',
  );
}

export async function smokeDeploy(options, adapters = {}) {
  const { tier, web, api, apex, bypass } = options;
  const request = adapters.request ?? fetch;
  const certificate = adapters.certificate ?? validateCertificate;
  const report = adapters.report ?? console.log;
  const failures = [];
  const check = async (label, operation) => {
    try {
      await operation();
      report('PASS ' + label);
    } catch (error) {
      failures.push(label);
      report(
        'FAIL ' +
          label +
          (error instanceof ProbeError ? ' — ' + error.message : ''),
      );
    }
  };
  const fetchAt = (target, path, init = {}, protocol = 'https:') => {
    const url = new URL(path, target);
    url.protocol = protocol;
    const headers = {
      ...init.headers,
      ...(target === web && protocol === 'https:' && bypass
        ? { 'x-vercel-protection-bypass': bypass }
        : {}),
    };
    return request(url, {
      ...init,
      headers,
      redirect: 'manual',
      signal: AbortSignal.timeout(timeout),
    });
  };
  const policy = (response) => {
    expect(
      response.headers.get('x-content-type-options') === 'nosniff',
      'Missing nosniff',
    );
    expect(
      /(?:^|;)\s*max-age=[1-9]\d*/i.test(
        response.headers.get('strict-transport-security') ?? '',
      ),
      'Missing HSTS',
    );
    expect(
      /\bframe-ancestors\b/i.test(
        response.headers.get('content-security-policy') ?? '',
      ),
      'Missing enforced frame-ancestors',
    );
  };
  const redirectedTo = (response, target) => {
    expect(redirects.has(response.status), 'Expected redirect');
    const location = new URL(response.headers.get('location'));
    expect(
      location.href === new URL('/', target).href,
      'Unexpected redirect target',
    );
  };
  for (const [name, target] of [
    ['web', web],
    ['api', api],
    ...(apex ? [['apex', apex]] : []),
  ]) {
    await check('TLS ' + name, () => certificate(target));
    await check('HTTP redirect ' + name, async () => {
      const response = await fetchAt(target, '/', {}, 'http:');
      if (target === apex) {
        expect(redirects.has(response.status), 'Expected apex redirect');
        const location = new URL(response.headers.get('location'));
        expect(
          [new URL('/', apex).href, new URL('/', web).href].includes(
            location.href,
          ),
          'Unexpected apex redirect',
        );
      } else redirectedTo(response, target);
    });
  }
  if (apex)
    await check('HTTPS apex to www', async () =>
      redirectedTo(await fetchAt(apex, '/'), web),
    );

  await check('Storefront and security headers', async () => {
    const response = await fetchAt(web, '/');
    expect(
      response.status === 200 &&
        /text\/html/i.test(response.headers.get('content-type') ?? ''),
      'Storefront unavailable',
    );
    policy(response);
    expect(
      /\bframe-ancestors\s+'none'/i.test(
        response.headers.get('content-security-policy') ?? '',
      ),
      'Storefront framing policy',
    );
    const noindex = /\bnoindex\b/i.test(
      response.headers.get('x-robots-tag') ?? '',
    );
    expect(
      noindex === (tier === 'staging'),
      'Incorrect storefront indexing header',
    );
  });
  await check('API readiness and security headers', async () => {
    const response = await fetchAt(api, '/health/ready');
    expect(response.status === 200, 'API not ready');
    policy(response);
    expect(
      (await readJson(response)).status === 'ok',
      'Unexpected readiness body',
    );
  });
  await check(
    'Catalogue has data and exposes request ID under CORS',
    async () => {
      const response = await fetchAt(api, '/api/v1/products?limit=1', {
        headers: { Origin: web.origin },
      });
      expect(response.status === 200, 'Catalogue unavailable');
      expect(
        response.headers.get('access-control-allow-origin') === web.origin,
        'Catalogue CORS origin mismatch',
      );
      expect(
        readHeaders(
          response.headers.get('access-control-expose-headers'),
        ).includes('x-request-id') && response.headers.has('x-request-id'),
        'Request ID not exposed',
      );
      const data = await readJson(response);
      expect(
        Array.isArray(data.items) && data.items.length > 0,
        'Add a catalogue product first',
      );
    },
  );

  const preflightHeaders = {
    'Access-Control-Request-Method': 'POST',
    'Access-Control-Request-Headers':
      'Authorization, Content-Type, Idempotency-Key, X-Request-Id',
  };
  for (const [name, incoming] of [
    ['allowed', web.origin],
    ['denied', 'https://unauthorized.invalid'],
  ]) {
    await check('CORS preflight ' + name, async () => {
      const response = await fetchAt(api, '/api/v1/checkout/sessions', {
        method: 'OPTIONS',
        headers: { ...preflightHeaders, Origin: incoming },
      });
      const allowed = response.headers.get('access-control-allow-origin');
      if (name === 'denied') {
        expect(allowed === null, 'Unexpected CORS allow');
        return;
      }
      expect(
        response.ok && allowed === web.origin,
        'Valid origin failed preflight',
      );
      expect(
        readHeaders(response.headers.get('vary')).includes('origin'),
        'Missing Vary Origin',
      );
      expect(
        response.headers.get('access-control-allow-credentials') !== 'true',
        'Unexpected credential CORS',
      );
      expect(
        readHeaders(
          response.headers.get('access-control-allow-methods'),
        ).includes('post'),
        'POST not allowed',
      );
      const headers = readHeaders(
        response.headers.get('access-control-allow-headers'),
      );
      expect(
        readHeaders(preflightHeaders['Access-Control-Request-Headers']).every(
          (header) => headers.includes(header),
        ),
        'Required header not allowed',
      );
    });
  }
  for (const [target, path] of [
    [api, '/docs'],
    [api, '/docs/'],
    [api, '/openapi.json'],
    [web, '/_dev/components'],
  ]) {
    await check('Disabled ' + path, async () =>
      expect((await fetchAt(target, path)).status === 404, 'Expected 404'),
    );
  }
  await check('robots.txt follows deployment mode', async () => {
    const response = await fetchAt(web, '/robots.txt');
    expect(response.status === 200, 'robots unavailable');
    const body = await response.text();
    const blocked = /^Disallow:\s*\/[^\S\r\n]*\r?$/im.test(body);
    expect(blocked === (tier === 'staging'), 'Wrong crawling policy');
    if (tier === 'production')
      expect(
        body.includes(new URL('/sitemap.xml', web).href),
        'Canonical sitemap missing',
      );
  });
  await check('Canonical sitemap', async () => {
    const response = await fetchAt(web, '/sitemap.xml');
    expect(response.status === 200, 'Sitemap unavailable');
    const locations = [
      ...(await response.text()).matchAll(/<loc>([^<]+)<\/loc>/g),
    ].map((match) => match[1]);
    expect(
      locations.includes(new URL('/products', web).href) &&
        locations.every((url) => url.startsWith(web.origin + '/')),
      'Wrong sitemap origin',
    );
  });
  await check('Anonymous API access returns JSON 401', async () => {
    const response = await fetchAt(api, '/api/v1/me');
    expect(response.status === 401, 'Expected 401');
    checkError(await readJson(response));
  });
  await check('Anonymous storefront redirects to sign-in', async () => {
    const response = await fetchAt(web, '/account');
    expect(redirects.has(response.status), 'Expected redirect');
    const location = new URL(response.headers.get('location') ?? '', web);
    expect(
      location.origin === web.origin &&
        /^\/sign-in\/?$/.test(location.pathname),
      'Unexpected sign-in URL',
    );
  });
  for (const vendor of ['clerk', 'stripe']) {
    await check('Unsigned webhook ' + vendor + ' rejected', async () => {
      const response = await fetchAt(api, '/api/v1/webhooks/' + vendor, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      });
      expect(
        [400, 401, 403, 422].includes(response.status),
        'Expected signature rejection',
      );
      checkError(await readJson(response));
    });
  }
  return failures;
}

if (fileURLToPath(import.meta.url) === resolve(process.argv[1] ?? '')) {
  try {
    const failed = await smokeDeploy(
      smokeOptions(process.argv.slice(2), process.env),
    );
    process.exitCode = failed.length ? 1 : 0;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
