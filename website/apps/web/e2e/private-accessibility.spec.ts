import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { pathsFor } from './paths.ts';
import { requireRunId, webOrigin } from './safety.ts';

const paths = pathsFor(requireRunId(process.env));
const storefront = [
  '/account',
  '/account/profile',
  '/account/addresses',
  '/account/orders',
  '/account/security',
  '/account/notifications',
  '/wishlist',
  '/cart',
  '/checkout',
  '/checkout/return',
];
const admin = [
  '/admin',
  '/admin/products',
  '/admin/products/new',
  '/admin/orders',
  '/admin/customers',
  '/admin/banners',
  '/admin/banners/new',
  '/admin/reviews',
];

for (const colorScheme of ['light', 'dark'] as const) {
  for (const [role, routes] of [
    ['customer', storefront],
    ['admin', admin],
  ] as const) {
    for (const path of routes) {
      test(
        'axe ' + colorScheme + ' ' + path,
        { tag: '@auth' },
        async ({ browser, viewport }) => {
          const context = await browser.newContext({
            baseURL: webOrigin,
            storageState: paths.state(role),
            colorScheme,
            reducedMotion: 'reduce',
            viewport,
          });
          try {
            const page = await context.newPage();
            const response = await page.goto(path);
            expect(response?.status()).toBe(200);
            await expect(page).toHaveURL(webOrigin + path);
            await expect(page.locator('html')).toHaveClass(
              new RegExp(colorScheme),
            );
            await expect(page.getByRole('heading', { level: 1 })).toHaveCount(
              1,
            );
            const result = await new AxeBuilder({ page })
              .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
              .analyze();
            await test.info().attach('axe', {
              body: JSON.stringify(result.violations),
              contentType: 'application/json',
            });
            expect(
              result.violations.filter(
                ({ impact }) => impact === 'critical' || impact === 'serious',
              ),
            ).toEqual([]);
          } finally {
            await context.close();
          }
        },
      );
    }
  }
}
