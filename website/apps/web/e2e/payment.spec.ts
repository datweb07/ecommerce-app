import { expect, test } from '@playwright/test';
import { assertSafeEnvironment, missingFor } from './safety.ts';

test(
  'enables the payment project only with test credentials',
  { tag: '@payment' },
  async ({ page }) => {
    assertSafeEnvironment(process.env);
    expect(missingFor('payment', process.env)).toEqual([]);
    await page.goto('/checkout');
    await expect(page).toHaveURL(/\/checkout$/);
  },
);
