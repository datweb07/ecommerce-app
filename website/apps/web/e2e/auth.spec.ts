import { expect, test } from '@playwright/test';
import { pathsFor, roles } from './paths.ts';
import { apiOrigin, requireRunId, webOrigin } from './safety.ts';
import { addressFixture, memberApi } from './member.ts';

const paths = pathsFor(requireRunId(process.env));
for (const role of roles) {
  test(
    'restores Clerk state and authenticates API for ' + role,
    { tag: '@auth' },
    async ({ browser, baseURL }) => {
      const context = await browser.newContext({
        baseURL: baseURL ?? '',
        storageState: paths.state(role),
      });
      try {
        const page = await context.newPage();
        await page.goto('/account');
        await expect(page).toHaveURL(/\/account$/);
        await expect
          .poll(async () =>
            page.evaluate(async () => {
              const clerk = (
                window as Window & {
                  Clerk?: { session?: { getToken(): Promise<string | null> } };
                }
              ).Clerk;
              return Boolean(await clerk?.session?.getToken());
            }),
          )
          .toBe(true);
        const statuses = await page.evaluate(async (origin) => {
          const clerk = (
            window as Window & {
              Clerk?: { session?: { getToken(): Promise<string | null> } };
            }
          ).Clerk;
          const token = await clerk?.session?.getToken();
          if (!token) return [];
          const headers = { Authorization: 'Bearer ' + token };
          const results = await Promise.all([
            fetch(origin + '/api/v1/me', { headers }),
            fetch(origin + '/api/v1/admin/me', { headers }),
          ]);
          return results.map(({ status }) => status);
        }, apiOrigin);
        expect(statuses).toEqual([200, role === 'admin' ? 200 : 403]);
      } finally {
        await context.close();
      }
    },
  );
}

test(
  'signed-in cart survives a second browser context and another account cannot access it',
  { tag: '@auth' },
  async ({ browser, page }, info) => {
    const role = info.project.name.endsWith('mobile')
      ? 'customer2'
      : 'customer';
    const otherRole = role === 'customer' ? 'customer2' : 'customer';
    const productId =
      role === 'customer'
        ? '760000000000000000000004'
        : '760000000000000000000005';
    const context = await browser.newContext({
      storageState: paths.state(role),
      baseURL: webOrigin,
    });
    const other = await browser.newContext({
      storageState: paths.state(otherRole),
      baseURL: webOrigin,
    });
    try {
      const shopper = await context.newPage();
      await shopper.goto('/products/' + productId);
      await shopper.getByRole('button', { name: 'Thêm vào giỏ' }).click();
      const api = memberApi(shopper);
      await expect
        .poll(async () =>
          (await (await api('GET', '/cart')).json()).items.map(
            (item: { productId: string }) => item.productId,
          ),
        )
        .toContain(productId);
      const secondContext = await browser.newContext({
        storageState: paths.state(role),
        baseURL: webOrigin,
      });
      try {
        const cart = await secondContext.newPage();
        await cart.goto('/cart');
        await expect(
          cart.getByText(
            role === 'customer' ? 'Sản phẩm E2E 4' : 'Sản phẩm E2E 5',
            { exact: true },
          ),
        ).toBeVisible();
      } finally {
        await secondContext.close();
      }
      expect(
        (
          await api('PATCH', '/cart/items/' + productId, { quantity: 2 })
        ).status(),
      ).toBe(200);
      expect((await api('PUT', '/wishlist/' + productId)).status()).toBe(200);
      const address = await api('POST', '/addresses', addressFixture);
      expect(address.status()).toBe(200);
      const { items } = await address.json();
      const addressId = items.find(
        (item: { label: string }) => item.label === addressFixture.label,
      )?.id;
      expect(addressId).toEqual(expect.any(String));
      const stranger = await other.newPage();
      await stranger.goto('/account');
      const strangerApi = memberApi(stranger);
      expect(
        (
          await strangerApi('PATCH', '/addresses/' + addressId, addressFixture)
        ).status(),
      ).toBe(404);
      expect(
        (
          await strangerApi('PATCH', '/cart/items/' + productId, {
            quantity: 3,
          })
        ).status(),
      ).toBe(404);
      expect((await api('DELETE', '/wishlist/' + productId)).status()).toBe(
        200,
      );
      expect((await api('DELETE', '/addresses/' + addressId)).status()).toBe(
        200,
      );
      expect((await api('DELETE', '/cart/items/' + productId)).status()).toBe(
        200,
      );
      await page.goto('/admin');
      await expect(
        page.getByRole('heading', { name: /không tìm thấy/i }),
      ).toBeVisible();
    } finally {
      await context.close();
      await other.close();
    }
  },
);
