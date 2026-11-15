import { expect, test } from '@playwright/test';
import { apiOrigin, webOrigin } from './safety.ts';
import { firstProductId } from './seed.ts';

test(
  'starts a production storefront against the isolated seeded API',
  { tag: '@public' },
  async ({ page, request }) => {
    const seed = await request.get(apiOrigin + '/api/v1/products?limit=1');
    expect(seed.ok()).toBe(true);
    expect(await seed.json()).toMatchObject({ total: 24 });
    const pageResponse = await page.goto('/');
    expect(pageResponse?.status()).toBe(200);
    await expect(
      page.getByRole('region', { name: 'Nổi bật tại cửa hàng' }),
    ).toBeVisible();
    expect((await request.get('/_dev/components')).status()).toBe(404);
  },
);

test(
  'banner rotates, can be paused, and links to a seeded category',
  { tag: '@public' },
  async ({ page }) => {
    await page.clock.install();
    await page.goto('/');
    const carousel = page.getByRole('region', { name: 'Nổi bật tại cửa hàng' });
    const slide = (name: string) => carousel.getByRole('group', { name });
    await expect(slide('1 / 3')).toBeVisible();
    await expect(slide('2 / 3')).toBeVisible({ timeout: 12_000 });
    await carousel.getByRole('button', { name: 'Tạm dừng tự chuyển' }).click();
    await page.mouse.move(0, 0);
    await page.clock.fastForward(7000);
    await expect(slide('2 / 3')).toBeVisible();
    await slide('2 / 3').getByRole('link').click();
    await expect(page).toHaveURL(/\/products\?category=Fashion$/);
    await expect(
      page.getByRole('heading', { name: 'Fashion', exact: true }),
    ).toBeVisible();
  },
);

test(
  'catalogue keeps filters and pagination in browser history',
  { tag: '@public' },
  async ({ page }) => {
    await page.goto('/products?limit=2');
    await page.getByRole('link', { name: 'Trang sau' }).click();
    await expect(page).toHaveURL(/page=2/);
    await page.goBack();
    await expect(page).toHaveURL(/limit=2$/);
    await page.goForward();
    await expect(page).toHaveURL(/page=2/);
    if (page.viewportSize()!.width < 1024)
      await page.getByRole('button', { name: 'Bộ lọc', exact: true }).click();
    const filters = page
      .getByRole('dialog', { name: 'Bộ lọc' })
      .or(page.getByRole('complementary', { name: 'Bộ lọc' }));
    await filters.getByLabel('Danh mục').selectOption('Electronics');
    await filters.getByLabel('Sắp xếp').selectOption('price');
    await filters.getByRole('button', { name: 'Áp dụng bộ lọc' }).click();
    await expect(page).toHaveURL(/category=Electronics.*sort=price/);
    await expect(
      page.getByRole('heading', { name: 'Electronics', exact: true }),
    ).toBeVisible();
  },
);

test(
  'product metadata, crawler endpoints and private guards',
  { tag: '@public' },
  async ({ page, request }) => {
    const detail = '/products/' + firstProductId;
    await page.goto(detail);
    await expect(
      page.getByRole('heading', { name: 'Sản phẩm E2E tồn một' }),
    ).toBeVisible();
    await expect(page.locator('link[rel=canonical]')).toHaveAttribute(
      'href',
      webOrigin + detail,
    );
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
      'content',
      'Sản phẩm E2E tồn một',
    );
    const ld = await page
      .locator('script[type="application/ld+json"]')
      .textContent();
    expect(JSON.parse(ld ?? '{}')).toMatchObject({
      '@type': 'Product',
      offers: { price: 19.5, priceCurrency: 'USD' },
    });
    expect((await request.get('/products/invalid')).status()).toBe(404);
    expect(await (await request.get('/sitemap.xml')).text()).toContain(detail);
    expect(await (await request.get('/robots.txt')).text()).toContain('/admin');
    for (const path of ['/cart?from=e2e', '/checkout', '/admin']) {
      const response = await request.get(path, { maxRedirects: 0 });
      expect(response.status()).toBe(307);
      expect(response.headers()['cache-control']).toContain('no-store');
      const signIn = new URL(response.headers().location ?? '', webOrigin);
      expect(signIn.pathname).toBe('/sign-in');
      expect(signIn.searchParams.get('redirect_url')).toBe(webOrigin + path);
    }
    await page.getByRole('button', { name: 'Thêm vào giỏ' }).click();
    await expect(page).toHaveURL(/\/sign-in\?redirect_url=/);
    expect(new URL(page.url()).searchParams.get('redirect_url')).toBe(
      webOrigin + detail,
    );
  },
);

test(
  'theme, scroll focus, and mascot preference survive normal navigation',
  { tag: '@public' },
  async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/');
    const theme = page.getByRole('switch', { name: 'Chế độ tối' });
    if ((page.viewportSize()?.width ?? 1280) < 410)
      await page.getByRole('button', { name: 'Mở menu' }).click();
    await expect(theme).toBeVisible();
    await theme.click();
    await expect(page.locator('html')).toHaveClass(/dark/);
    if (await page.getByRole('dialog').isVisible())
      await page.keyboard.press('Escape');
    const mascot = page.locator('[data-mascot]');
    await expect(mascot).toBeVisible();
    await page.getByRole('button', { name: 'Ẩn linh vật' }).click();
    await expect(mascot).toHaveCount(0);
    await page.reload();
    await expect(page.locator('html')).toHaveClass(/dark/);
    await expect(
      page.getByRole('button', { name: 'Hiện linh vật' }),
    ).toBeVisible();
    await expect(mascot).toHaveCount(0);
    const top = page.getByRole('button', { name: 'Cuộn lên đầu trang' });
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await expect(top).toHaveCount(0);
    await page.getByRole('contentinfo').scrollIntoViewIfNeeded();
    await expect(top).toBeVisible();
    await top.click();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    await expect(top).toHaveCount(0);
    await expect(page.locator('#content')).toBeFocused();
    await page.goto('/sign-in');
    await expect(
      page.getByRole('button', { name: 'Hiện linh vật' }),
    ).toHaveCount(0);
  },
);
