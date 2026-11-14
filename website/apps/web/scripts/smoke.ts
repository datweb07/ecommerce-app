import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { verifyOpenApi } from '../src/lib/api/openapi-contract.ts';

const site = process.env.SMOKE_SITE_URL ?? 'http://localhost:3000';
const webOrigin = process.env.SMOKE_WEB_ORIGIN ?? new URL(site).origin;
const api = process.env.SMOKE_API_URL ?? 'http://127.0.0.1:4000';
const mode = process.env.SMOKE_MODE ?? 'dev';
const output = new URL('../../../.cache/web-smoke/', import.meta.url);
const request = (path: string) => fetch(site + path, { redirect: 'manual' });
const home = await request('/');
assert.equal(home.status, 200);
const html = await home.text();
assert.match(html, /Mua sắm cùng ShopEase/);
assert.match(html, /lang="vi"/);
assert.equal(home.headers.get('x-content-type-options'), 'nosniff');
const privateRoute = await request('/checkout/return?session_id=smoke');
assert.equal(privateRoute.status, 307);
const signIn = new URL(privateRoute.headers.get('location') ?? '', site);
assert.equal(signIn.pathname, '/sign-in');
assert.equal(
  signIn.searchParams.get('redirect_url'),
  new URL('/checkout/return?session_id=smoke', signIn.origin).href,
);
assert.match(privateRoute.headers.get('cache-control') ?? '', /no-store/);
assert.match(privateRoute.headers.get('x-robots-tag') ?? '', /noindex/);
assert.equal((await request('/products')).status, 200);
assert.equal((await request('/invalid-page-smoke')).status, 404);
assert.equal((await request('/sitemap.xml')).status, 200);
assert.equal((await request('/robots.txt')).status, 200);
const gallery = await request('/_dev/components');
assert.equal(gallery.status, mode === 'dev' ? 200 : 404);
if (mode === 'dev') assert.match(await gallery.text(), /Thư viện thành phần/);

if (mode !== 'fallback') {
  const openapi = await fetch(api + '/openapi.json');
  assert.equal(openapi.status, 200);
  console.log(
    `OpenAPI: ${verifyOpenApi(await openapi.json())} storefront operations`,
  );
  const categories = await fetch(api + '/api/v1/categories');
  assert.equal(categories.status, 200);
  const { items } = await categories.json();
  assert.ok(items.length > 0, 'Run pnpm seed before this check.');
  assert.ok(
    html.includes(
      '/products?category=' +
        encodeURIComponent(items[0]).replaceAll('%20', '+'),
    ) || html.includes('/products?category=' + encodeURIComponent(items[0])),
    'SSR includes a seeded category from the API',
  );
  const preflight = (origin: string) =>
    fetch(api + '/api/v1/checkout/sessions', {
      method: 'OPTIONS',
      headers: {
        origin,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers':
          'authorization,x-request-id,idempotency-key,content-type',
      },
    });
  const cors = await preflight(webOrigin);
  assert.equal(cors.headers.get('access-control-allow-origin'), webOrigin);
  assert.match(
    cors.headers.get('access-control-allow-headers') ?? '',
    /idempotency-key/i,
  );
  assert.equal(
    (await preflight('https://unexpected.example')).headers.get(
      'access-control-allow-origin',
    ),
    null,
  );
} else {
  assert.match(html, /href="\/products"/);
  assert.doesNotMatch(html, /\/products\?category=/);
}

if (mode === 'dev') {
  await mkdir(output, { recursive: true });
  const browser = await chromium.launch({
    channel: process.env.SMOKE_BROWSER_CHANNEL ?? 'msedge',
  });
  try {
    for (const [label, width, height] of [
      ['desktop', 1440, 920],
      ['mobile', 390, 844],
    ] as const) {
      for (const colorScheme of ['light', 'dark'] as const) {
        const context = await browser.newContext({
          viewport: { width, height },
          colorScheme,
        });
        try {
          const page = await context.newPage();
          await page.goto(site, { waitUntil: 'networkidle' });
          await page
            .getByRole('heading', { name: 'Mua sắm cùng ShopEase' })
            .waitFor();
          await page.locator(`html.${colorScheme}`).waitFor();
          const result = await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
            .analyze();
          assert.deepEqual(
            result.violations.map((v) => v.id),
            [],
          );
          await page.screenshot({
            path: fileURLToPath(
              new URL(`home-${label}-${colorScheme}.png`, output),
            ),
            fullPage: true,
          });
          if (label === 'mobile') {
            const trigger = page.getByRole('button', { name: 'Mở menu' });
            await trigger.click();
            await page
              .getByRole('dialog', { name: 'Danh mục mua sắm' })
              .waitFor();
            await page.keyboard.press('Escape');
            await page.getByRole('dialog').waitFor({ state: 'hidden' });
            assert.equal(
              await trigger.evaluate(
                (button) => button === document.activeElement,
              ),
              true,
            );
          }
          await page.goto(site + '/_dev/components', {
            waitUntil: 'networkidle',
          });
          await page
            .getByRole('heading', { name: 'Thư viện thành phần' })
            .waitFor();
          const components = await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
            .analyze();
          assert.deepEqual(
            components.violations.map((v) => v.id),
            [],
          );
          await page.screenshot({
            path: fileURLToPath(
              new URL(`components-${label}-${colorScheme}.png`, output),
            ),
            fullPage: true,
          });
          console.log(
            `axe: ${label} ${colorScheme}, 0 violations on home and component gallery`,
          );
        } finally {
          await context.close();
        }
      }
    }
  } finally {
    await browser.close();
  }
}
console.log(`Storefront smoke passed (${mode}).`);
