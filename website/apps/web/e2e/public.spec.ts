import { expect, test } from '@playwright/test';
import { apiOrigin } from './safety.ts';

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
