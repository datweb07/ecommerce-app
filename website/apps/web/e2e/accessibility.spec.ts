import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { firstProductId } from './seed.ts';

async function scan(page: Page) {
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  await test.info().attach('axe', {
    body: JSON.stringify(result.violations, null, 2),
    contentType: 'application/json',
  });
  expect(
    result.violations.filter(
      ({ impact }) => impact === 'critical' || impact === 'serious',
    ),
  ).toEqual([]);
}

for (const theme of ['light', 'dark'] as const) {
  test.describe(theme, () => {
    test.use({ colorScheme: theme, reducedMotion: 'reduce' });
    for (const path of [
      '/',
      '/products',
      '/products?q=khong-co-ket-qua',
      '/products/' + firstProductId,
      '/sign-in',
      '/sign-up',
      '/products/invalid',
    ]) {
      test('axe ' + path, { tag: '@public' }, async ({ page }) => {
        await page.goto(path);
        await expect(page.locator('html')).toHaveClass(new RegExp(theme));
        await expect(page.locator('html')).toHaveAttribute('lang', 'vi');
        await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
        await scan(page);
      });
    }
    test(
      'axe open filters or search and restores focus',
      { tag: '@public' },
      async ({ page }) => {
        await page.goto('/products');
        const mobile = (page.viewportSize()?.width ?? 1280) < 1024;
        const trigger = mobile
          ? page.getByRole('button', { name: 'Bộ lọc', exact: true })
          : page
              .getByRole('banner')
              .getByRole('button', { name: 'Tìm sản phẩm', exact: true });
        await trigger.focus();
        await page.keyboard.press('Enter');
        await expect(page.getByRole('dialog')).toBeVisible();
        await scan(page);
        await page.keyboard.press('Escape');
        await expect(trigger).toBeFocused();
      },
    );
  });
}

test(
  'reflows catalogue at 320 CSS pixels and honors reduced motion',
  { tag: '@public' },
  async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await expect(page.locator('[data-mascot]')).toHaveCount(0);
    const carousel = page.getByRole('region', { name: 'Nổi bật tại cửa hàng' });
    await expect(carousel.getByRole('button').first()).toBeDisabled();
    for (const path of ['/', '/products', '/products/' + firstProductId]) {
      await page.goto(path);
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
        .toBe(320);
    }
  },
);
