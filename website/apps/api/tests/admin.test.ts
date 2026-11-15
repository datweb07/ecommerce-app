import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { Types } from 'mongoose';
import { bearer, replica } from './support/replica.js';

const secret = 'fixture_cloudinary_secret';
const fixture = replica(
  {},
  {
    ADMIN_EMAIL: 'user_Admin@example.test',
    CLOUDINARY_API_KEY: 'fixture-key',
    CLOUDINARY_API_SECRET: secret,
    CLOUDINARY_CLOUD_NAME: 'fixture-cloud',
  },
);
const base = '/api/v1/admin';
const signatureUrl = base + '/uploads/signature';
const image = { sizeBytes: 900, contentType: 'image/png' };
const auth = bearer('user_Admin');

it('requires a verified admin for all three routes and rejects anonymous requests', async () => {
  const blocked = [
    { method: 'GET' as const, url: base + '/me' },
    { method: 'GET' as const, url: base + '/orders' },
    {
      method: 'PATCH' as const,
      url: base + '/orders/' + new Types.ObjectId() + '/status',
      payload: { expectedStatus: 'pending', status: 'shipped' },
    },
    { method: 'POST' as const, url: signatureUrl, payload: image },
  ];
  for (const request of blocked) {
    expect((await fixture.app.inject(request)).statusCode).toBe(401);
    expect(
      (await fixture.app.inject({ ...request, headers: bearer('user_Other') }))
        .statusCode,
    ).toBe(403);
  }
  const result = await fixture.app.inject({ url: base + '/me', headers: auth });
  expect(result.statusCode).toBe(200);
  expect(result.headers['cache-control']).toBe('private, no-store');
  expect(result.json()).toEqual({
    id: expect.stringMatching(/^[a-f0-9]{24}$/),
    isAdmin: true,
  });
  expect(
    (await fixture.app.inject({ url: base + '/me?extra=1', headers: auth }))
      .statusCode,
  ).toBe(400);
});

it('lists paginated safe summaries and commits only the next status with one notification per transition', async () => {
  const profile = await fixture.app.inject({
    url: '/api/v1/me',
    headers: bearer(),
  });
  const orderId = (
    await fixture.db.collection('orders').insertOne({
      user: new Types.ObjectId(profile.json().id),
      clerkId: 'user_A',
      totalPrice: 12,
      status: 'pending',
      orderItems: [{ product: new Types.ObjectId(), quantity: 2 }],
      shippingAddress: { phoneNumber: 'private' },
      paymentResult: { id: 'private' },
    })
  ).insertedId;
  const url = base + '/orders/' + orderId + '/status';
  const change = (expectedStatus: string, status: string) =>
    fixture.app.inject({
      method: 'PATCH',
      url,
      headers: auth,
      payload: { expectedStatus, status },
    });
  const list = await fixture.app.inject({
    url: base + '/orders?limit=1',
    headers: auth,
  });
  expect(list.statusCode, list.body).toBe(200);
  expect(list.json()).toEqual({
    page: 1,
    limit: 1,
    total: 1,
    items: [
      {
        id: orderId.toString(),
        status: 'pending',
        totalPrice: 12,
        itemCount: 2,
        createdAt: null,
        shippedAt: null,
        deliveredAt: null,
      },
    ],
  });
  expect((await change('pending', 'delivered')).statusCode).toBe(409);
  const transitions = await Promise.all([
    change('pending', 'shipped'),
    change('pending', 'shipped'),
  ]);
  expect(transitions.map((entry) => entry.statusCode)).toEqual([200, 200]);
  expect(transitions[0]?.json()).toEqual(transitions[1]?.json());
  expect(
    await fixture.db
      .collection('web_notifications')
      .countDocuments({ orderId, status: 'shipped' }),
  ).toBe(1);
  expect((await change('pending', 'delivered')).statusCode).toBe(409);
  expect((await change('shipped', 'delivered')).statusCode).toBe(200);
  expect((await change('delivered', 'shipped')).statusCode).toBe(409);
  const inbox = (
    await fixture.app.inject({
      url: '/api/v1/notifications',
      headers: bearer(),
    })
  ).json();
  expect(inbox.unreadCount).toBe(2);
  expect(
    inbox.items.map((entry: { status: string }) => entry.status).sort(),
  ).toEqual(['delivered', 'shipped']);
  expect(
    await fixture.db
      .collection('web_notifications')
      .countDocuments({ orderId }),
  ).toBe(2);
});

it('signs only fixed Cloudinary upload fields and validates the upload declaration', async () => {
  const sign = (payload: object) =>
    fixture.app.inject({
      method: 'POST',
      url: signatureUrl,
      remoteAddress: '192.0.2.20',
      headers: auth,
      payload,
    });
  expect((await sign({ ...image, folder: 'other' })).statusCode).toBe(400);
  expect((await sign({ ...image, overwrite: true })).statusCode).toBe(400);
  expect(
    (await sign({ ...image, sizeBytes: 5 * 1024 * 1024 + 1 })).statusCode,
  ).toBe(400);
  expect(
    (await sign({ ...image, contentType: 'image/svg+xml' })).statusCode,
  ).toBe(400);
  const response = await sign(image);
  expect(response.statusCode, response.body).toBe(200);
  const value = response.json();
  expect(value.params).toEqual({
    timestamp: expect.any(Number),
    asset_folder: 'products',
    public_id: expect.stringMatching(/^products\/[a-f\d-]+$/),
    type: 'upload',
    overwrite: false,
    allowed_formats: 'jpg,jpeg,png,webp',
  });
  const canonical = Object.entries(value.params)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, val]) => key + '=' + val)
    .join('&');
  expect(value.signature).toBe(
    createHash('sha1')
      .update(canonical + secret)
      .digest('hex'),
  );
  expect(value.expiresAt).toBe(
    new Date((value.params.timestamp + 3600) * 1000).toISOString(),
  );
  expect(value.maxBytes).toBe(5 * 1024 * 1024);
  expect(value.uploadUrl).toBe(
    'https://api.cloudinary.com/v1_1/fixture-cloud/image/upload',
  );
  expect(response.body).not.toContain(secret);
  expect((await sign(image)).statusCode).toBe(429);
});

it('filters orders by UTC days, status, customer email and exact order id', async () => {
  const profile = await fixture.app.inject({
    url: '/api/v1/me',
    headers: bearer('user_Buyer'),
  });
  const customerId = new Types.ObjectId(profile.json().id);
  const orders = fixture.db.collection('orders');
  const orderId = (
    await orders.insertOne({
      user: customerId,
      status: 'shipped',
      totalPrice: 34.95,
      createdAt: new Date('2026-04-20T23:59:59Z'),
      orderItems: [
        {
          product: new Types.ObjectId(),
          quantity: 2,
          name: 'Snapshot',
          price: 10,
          image: '/archive.jpg',
        },
      ],
      shippingAddress: {
        fullName: 'Buyer',
        streetAddress: '123 Road',
        city: 'City',
        state: 'State',
        zipCode: '111',
        phoneNumber: '123',
        other: 'private',
      },
      paymentResult: { id: 'pi_example12345678', secret: 'private' },
    })
  ).insertedId;
  const url = base + '/orders';
  const get = (path: string, headers = auth) =>
    fixture.app.inject({ url: path, headers });
  const list = await get(
    url + '?status=shipped&from=2026-04-20&to=2026-04-20&q=BUYER&limit=1',
  );
  expect(list.statusCode, list.body).toBe(200);
  expect(list.json()).toMatchObject({
    total: 1,
    items: [{ id: orderId.toString() }],
  });
  expect((await get(url + '?q=' + orderId)).json().total).toBe(1);
  expect((await get(url + '?q=.%2A')).json().total).toBe(0);
  expect((await get(url + '?page=2&q=Buyer&limit=1')).json().items).toEqual([]);
  expect((await get(url + '?from=2026-04-21&to=2026-04-20')).statusCode).toBe(
    400,
  );
  const detail = await get(url + '/' + orderId);
  expect(detail.statusCode, detail.body).toBe(200);
  expect(detail.json()).toMatchObject({
    customer: { name: 'user_Buyer', email: 'user_Buyer@example.test' },
    paymentReference: '12345678',
    items: [{ name: 'Snapshot' }],
  });
  expect(detail.body).not.toContain('private');
  expect((await get(url + '/' + new Types.ObjectId())).statusCode).toBe(404);
  expect((await get(url + '/invalid')).statusCode).toBe(400);
  for (const guarded of [url + '/' + orderId, base + '/reconciliation']) {
    expect((await fixture.app.inject({ url: guarded })).statusCode).toBe(401);
    expect((await get(guarded, bearer())).statusCode).toBe(403);
  }
});

it('lists cases needing payment reconciliation without checkout credentials', async () => {
  const now = new Date();
  const entry = {
    user: new Types.ObjectId(),
    key: 'private',
    clerkId: 'private',
    status: 'expired',
    quote: { totalCents: 2999, currency: 'usd' },
    expiresAt: now,
    createdAt: now,
    paymentIntent: 'pi_reference99999999',
    requiresReconciliation: true,
  };
  await fixture.db.collection('web_checkout_sessions').insertOne(entry);
  const result = await fixture.app.inject({
    url: base + '/reconciliation',
    headers: auth,
  });
  expect(result.statusCode, result.body).toBe(200);
  expect(result.json()).toMatchObject({
    total: 1,
    items: [{ totalCents: 2999, paymentReference: '99999999' }],
  });
  expect(result.body).not.toContain('private');
  expect(
    (
      await fixture.app.inject({
        url: base + '/reconciliation?limit=101',
        headers: auth,
      })
    ).statusCode,
  ).toBe(400);
});
