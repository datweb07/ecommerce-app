import { expect, test } from '@playwright/test';
import {
  assertSafeEnvironment,
  checkUploadAccount,
  missingFor,
} from './safety.ts';

test(
  'enables the upload project only for a confirmed test cloud and admin session',
  { tag: '@upload' },
  async ({ page }) => {
    assertSafeEnvironment(process.env);
    checkUploadAccount(process.env);
    expect(missingFor('upload', process.env)).toEqual([]);
    await page.goto('/admin/products/new');
    await expect(
      page.getByRole('heading', { name: 'Thêm sản phẩm' }),
    ).toBeVisible();
  },
);
