import { createHmac, randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { addressFixture, memberApi } from './member.ts';
import { pathsFor } from './paths.ts';
import {
  apiOrigin,
  assertSafeEnvironment,
  missingFor,
  requireRunId,
  webOrigin,
} from './safety.ts';
import { firstProductId } from './seed.ts';

test(
  'real hosted test session, signed simulated webhook, one durable order',
  { tag: '@payment' },
  async ({ browser, page }) => {
    test.setTimeout(120_000);
    assertSafeEnvironment(process.env);
    expect(missingFor('payment', process.env)).toEqual([]);
    const key = process.env.STRIPE_SECRET_KEY;
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!key?.startsWith('sk_test_') || !secret?.startsWith('whsec_'))
      throw new Error('Stripe test credentials are required.');
    const stripe = (id: string, action?: 'expire') =>
      fetch(
        'https://api.stripe.com/v1/checkout/sessions/' +
          id +
          (action ? '/' + action : ''),
        {
          method: action ? 'POST' : 'GET',
          headers: { authorization: 'Bearer ' + key },
          redirect: 'error',
          signal: AbortSignal.timeout(10_000),
        },
      );
    const signedEvent = (data: Record<string, unknown>, forged = false) => {
      const payload = JSON.stringify({
        id: 'evt_storefront_e2e_' + randomUUID().replaceAll('-', ''),
        type: 'checkout.session.completed',
        livemode: false,
        data: { object: data },
      });
      const timestamp = Math.floor(Date.now() / 1000);
      const digest = createHmac('sha256', forged ? 'wrong-secret' : secret)
        .update(timestamp + '.' + payload)
        .digest('hex');
      return { payload, signature: `t=${timestamp},v1=${digest}` };
    };
    await page.goto('/account');
    const api = memberApi(page);
    const address = await api('POST', '/addresses', addressFixture);
    expect(address.status()).toBe(200);
    const addressId = (await address.json()).items[0].id as string;
    const cart = await api('POST', '/cart/items', {
      productId: firstProductId,
      quantity: 1,
    });
    expect(cart.status()).toBe(200);
    const input = { addressId, version: (await cart.json()).version as number };
    const quote = await api('POST', '/checkout/quote', input);
    expect(quote.status()).toBe(200);
    const amounts = await quote.json();
    expect(amounts).toMatchObject({
      subtotalCents: 1950,
      shippingCents: 1000,
      taxCents: 156,
      totalCents: 3106,
    });
    const idempotency = { 'idempotency-key': randomUUID() };
    const created = await api('POST', '/checkout/sessions', input, idempotency);
    expect(created.status()).toBe(200);
    const checkout = (await created.json()) as { id: string; url: string };
    const hosted = new URL(checkout.url);
    expect(hosted.origin).toBe('https://checkout.stripe.com');
    const stripeId = hosted.pathname.match(/cs_test_[a-zA-Z0-9]+/)?.[0];
    if (!stripeId)
      throw new Error('Hosted Stripe URL is missing a test checkout ID.');
    const expireTestSession = async () => {
      if ((await stripe(stripeId, 'expire')).ok) return;
      const current = await stripe(stripeId);
      const status = current.ok ? (await current.json()).status : undefined;
      expect(['complete', 'expired'], 'Stripe test session cleanup').toContain(
        status,
      );
    };
    try {
      const replay = await api(
        'POST',
        '/checkout/sessions',
        input,
        idempotency,
      );
      expect(replay.status()).toBe(200);
      expect(await replay.json()).toMatchObject({
        id: checkout.id,
        url: checkout.url,
      });
      const remote = await stripe(stripeId);
      expect(remote.status).toBe(200);
      const session = await remote.json();
      expect(session).toMatchObject({
        id: stripeId,
        livemode: false,
        amount_total: 3106,
        payment_status: 'unpaid',
        metadata: { checkoutId: checkout.id },
      });
      await page.goto(
        '/checkout/return?checkoutId=' + checkout.id + '&status=paid',
      );
      const paid = page.getByText('Thanh toán đã được xác nhận.', {
        exact: true,
      });
      await expect(page.getByRole('status')).toContainText(
        /chờ Stripe xác nhận/i,
      );
      await expect(paid).toHaveCount(0);
      const send = ({ payload, signature }: ReturnType<typeof signedEvent>) =>
        page.request.post(apiOrigin + '/api/v1/webhooks/stripe', {
          data: payload,
          headers: {
            'content-type': 'application/json',
            'stripe-signature': signature,
          },
        });
      const completed = {
        ...session,
        status: 'complete',
        payment_status: 'paid',
        payment_intent: 'pi_storefront_e2e_' + randomUUID().replaceAll('-', ''),
      };
      expect((await send(signedEvent(completed, true))).status()).toBe(400);
      const event = signedEvent(completed);
      for (const response of await Promise.all([
        send(event),
        send(event),
        send(signedEvent(completed)),
      ]))
        expect(response.status()).toBe(200);
      await expect(paid).toBeVisible({ timeout: 25_000 });
      await page.reload();
      await page.getByRole('link', { name: 'Xem đơn hàng' }).click();
      await expect(page).toHaveURL(/\/account\/orders\/[a-f0-9]{24}$/);
      await expect(
        page.getByText('Sản phẩm E2E tồn một', { exact: true }),
      ).toBeVisible();
      const orders = await api('GET', '/orders');
      expect((await orders.json()).items).toHaveLength(1);
      expect((await (await api('GET', '/cart')).json()).items).toHaveLength(0);
      const product = await page.request.get(
        apiOrigin + '/api/v1/products/' + firstProductId,
      );
      expect(await product.json()).toMatchObject({ stock: 0 });

      const orderId = new URL(page.url()).pathname.split('/').at(-1);
      expect(orderId).toMatch(/^[a-f0-9]{24}$/);
      const paths = pathsFor(requireRunId(process.env));
      const admin = await browser.newContext({
        baseURL: webOrigin,
        storageState: paths.state('admin'),
      });
      const stranger = await browser.newContext({
        baseURL: webOrigin,
        storageState: paths.state('customer2'),
      });
      try {
        const strangerPage = await stranger.newPage();
        await strangerPage.goto('/account');
        const strangerApi = memberApi(strangerPage);
        expect(
          (
            await strangerApi('GET', '/checkout/sessions/' + checkout.id)
          ).status(),
        ).toBe(404);
        expect((await strangerApi('GET', '/orders/' + orderId)).status()).toBe(
          404,
        );

        const adminPage = await admin.newPage();
        await adminPage.goto('/admin/orders/' + orderId);
        const adminApi = memberApi(adminPage);
        const orderRoute = '/admin/orders/' + orderId + '/status';
        expect(
          (
            await adminApi('PATCH', orderRoute, {
              expectedStatus: 'pending',
              status: 'shipped',
            })
          ).status(),
        ).toBe(200);
        expect(
          (
            await adminApi('PATCH', orderRoute, {
              expectedStatus: 'shipped',
              status: 'delivered',
            })
          ).status(),
        ).toBe(200);
        expect(
          (
            await adminApi('PATCH', orderRoute, {
              expectedStatus: 'delivered',
              status: 'shipped',
            })
          ).status(),
        ).toBe(409);
        const notifications = await api('GET', '/notifications');
        expect(await notifications.json()).toMatchObject({ unreadCount: 2 });
        await page.goto('/account/notifications');
        await expect(
          page.getByRole('heading', { name: 'Thông báo' }),
        ).toBeVisible();
        const review = await api('POST', '/reviews', {
          productId: firstProductId,
          orderId,
          rating: 5,
        });
        expect(review.status()).toBe(201);
        const reviewId = (await review.json()).id as string;
        const readProduct = async () =>
          (
            await page.request.get(
              apiOrigin + '/api/v1/products/' + firstProductId,
            )
          ).json();
        expect(await readProduct()).toMatchObject({
          averageRating: 5,
          totalReviews: 1,
        });
        expect(
          (await adminApi('DELETE', '/admin/reviews/' + reviewId)).status(),
        ).toBe(200);
        expect(await readProduct()).toMatchObject({
          averageRating: 0,
          totalReviews: 0,
        });
        expect(
          (
            await adminApi('DELETE', '/admin/products/' + firstProductId)
          ).status(),
        ).toBe(200);
        await page.goto('/account/orders/' + orderId);
        await expect(
          page.getByText('Sản phẩm E2E tồn một', { exact: true }),
        ).toBeVisible();
      } finally {
        await admin.close();
        await stranger.close();
      }
    } finally {
      await expireTestSession();
    }
  },
);
