import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import AxeBuilder from '@axe-core/playwright';
import { chromium, expect } from '@playwright/test';
import { productListDto } from '@storefront/shared';

const site = process.env.SMOKE_SITE_URL ?? 'http://localhost:3000';
const api = process.env.SMOKE_API_URL ?? 'http://127.0.0.1:4000';
const output = new URL('../../../.cache/catalogue-smoke/', import.meta.url);
await mkdir(output, { recursive: true });
const seed = await fetch(api + '/api/v1/products?limit=8');
assert.equal(seed.status, 200);
const { items } = productListDto.parse(await seed.json());
const item = items.find((product) => product.stock > 0);
assert.ok(item, 'Run pnpm seed before the catalogue smoke test.');
const detail = '/products/' + item.id;
assert.equal((await fetch(site + '/products/invalid')).status, 404);
const missing = await fetch(site + '/products/000000000000000000000000');
assert.equal(missing.status, 404);
const sitemap = await fetch(site + '/sitemap.xml');
assert.equal(sitemap.status, 200);
assert.match(await sitemap.text(), new RegExp(detail));
const privateRoute = await fetch(site + '/cart', { redirect: 'manual' });
assert.equal(privateRoute.status, 307);
const signIn = new URL(privateRoute.headers.get('location') ?? '', site);
assert.equal(signIn.pathname, '/sign-in');
assert.equal(
  new URL(signIn.searchParams.get('redirect_url') ?? '').pathname,
  '/cart',
);

const browser = await chromium.launch({
  channel: process.env.SMOKE_BROWSER_CHANNEL ?? 'msedge',
});
try {
  const flow = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  await flow.goto(site + '/');
  await expect(
    flow.getByRole('heading', { name: 'Sản phẩm mới' }),
  ).toBeVisible();
  await expect(
    flow.getByRole('heading', { name: 'Sản phẩm bán chạy' }),
  ).toBeVisible();
  await expect(
    flow.getByRole('link', { name: item.name }).first(),
  ).toBeVisible();
  await flow.goto(site + '/products?limit=2');
  await flow.getByRole('link', { name: 'Trang sau' }).click();
  await expect(flow).toHaveURL(/limit=2&page=2$/);
  await flow.goBack();
  await expect(flow).toHaveURL(/limit=2$/);
  const filter = flow.getByRole('complementary', { name: 'Bộ lọc' });
  await filter.getByLabel('Danh mục').selectOption(item.category);
  await filter.getByLabel('Sắp xếp').selectOption('price');
  await filter.getByRole('button', { name: 'Áp dụng bộ lọc' }).click();
  await expect(flow).toHaveURL(/category=.*sort=price/);
  await expect(
    flow.getByRole('heading', { name: item.category, exact: true }),
  ).toBeVisible();
  await expect(flow.locator('meta[name=robots]')).toHaveAttribute(
    'content',
    'noindex, follow',
  );
  await filter.getByLabel('Tìm sản phẩm').fill('khong-co-san-pham-999');
  await expect(flow).toHaveURL(/q=khong-co-san-pham-999/);
  await expect(flow.getByText('Không tìm thấy sản phẩm')).toBeVisible();
  await flow.getByRole('link', { name: 'Xóa tất cả bộ lọc' }).first().click();
  await expect(flow).toHaveURL(/\/products$/);
  await flow.goto(site + '/products?page=0&sort=invalid');
  await expect(flow.getByText('Không tìm thấy sản phẩm')).toHaveCount(0);
  await flow.goto(site + detail + '?page=2');
  await expect(flow.getByRole('heading', { name: item.name })).toBeVisible();
  const json = JSON.parse(
    (await flow.locator('script[type="application/ld+json"]').textContent()) ??
      '{}',
  );
  assert.equal(json['@type'], 'Product');
  assert.equal(json.offers.price, item.price);
  assert.equal(json.offers.priceCurrency, 'USD');
  await expect(flow.locator('link[rel=canonical]')).toHaveAttribute(
    'href',
    new RegExp(detail + '$'),
  );
  await expect(flow.locator('meta[property="og:title"]')).toHaveAttribute(
    'content',
    item.name,
  );
  await flow.getByRole('button', { name: 'Thêm vào giỏ' }).click();
  await expect(flow).toHaveURL(/\/sign-in\?redirect_url=/);
  assert.equal(
    new URL(new URL(flow.url()).searchParams.get('redirect_url') ?? '')
      .pathname,
    detail,
  );
  assert.equal(
    new URL(new URL(flow.url()).searchParams.get('redirect_url') ?? '').search,
    '?page=2',
  );
  await flow.close();

  for (const [device, width, height] of [
    ['desktop', 1440, 1000],
    ['mobile', 390, 844],
  ] as const) {
    for (const colorScheme of ['light', 'dark'] as const) {
      for (const [name, route] of [
        ['home', '/'],
        ['catalogue', '/products'],
        ['detail', detail],
      ] as const) {
        const context = await browser.newContext({
          viewport: { width, height },
          colorScheme,
        });
        const page = await context.newPage();
        await page.goto(site + route, { waitUntil: 'networkidle' });
        await expect(page.locator('html')).toHaveClass(new RegExp(colorScheme));
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        if (name === 'catalogue' && device === 'mobile') {
          const trigger = page.getByRole('button', { name: 'Bộ lọc' });
          await trigger.click();
          await expect(
            page.getByRole('dialog', { name: 'Bộ lọc' }),
          ).toBeVisible();
          await page.keyboard.press('Escape');
          await expect(trigger).toBeFocused();
        }
        const result = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
          .analyze();
        assert.deepEqual(
          result.violations.map(({ id, nodes }) => ({
            id,
            targets: nodes.map(({ target }) => target),
          })),
          [],
        );
        const screenshot = fileURLToPath(
          new URL(`${name}-${device}-${colorScheme}.png`, output),
        );
        await page.screenshot({ path: screenshot, fullPage: true });
        const timings = await page.evaluate(() => {
          const navigation = performance.getEntriesByType('navigation')[0];
          const scripts = performance
            .getEntriesByType('resource')
            .filter(
              (entry) =>
                entry.name.includes('/_next/static/') &&
                entry.name.includes('.js'),
            );
          return {
            responseMs:
              navigation instanceof PerformanceNavigationTiming
                ? Math.round(navigation.responseStart)
                : 0,
            javascriptKiB: Math.round(
              scripts.reduce(
                (total, entry) =>
                  total +
                  (entry instanceof PerformanceResourceTiming
                    ? entry.encodedBodySize
                    : 0),
                0,
              ) / 1024,
            ),
          };
        });
        console.log(`${name} ${device} ${colorScheme}: axe 0,`, timings);
        await context.close();
      }
    }
  }
} finally {
  await browser.close();
}
console.log('Public storefront smoke passed.');
