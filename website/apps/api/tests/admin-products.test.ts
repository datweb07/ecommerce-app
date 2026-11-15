import { expect, it, vi } from 'vitest';
import { Types } from 'mongoose';
import { bearer, replica } from './support/replica.js';

const base = '/api/v1/admin/products';
const auth = bearer('user_Admin');
const cloud = 'fixture-cloud';
const url =
  'https://res.cloudinary.com/' +
  cloud +
  '/image/upload/v1/products/sample.webp';
const image = { url, publicId: 'products/sample' };
const product = {
  name: 'Áo mẫu',
  description: 'Mô tả',
  category: 'Áo',
  price: 49.99,
  stock: 1,
  images: [image],
};
const destroy = vi.fn(async () => ({}));
const fixture = replica(
  {
    media: {
      async resource(id) {
        return {
          public_id: id,
          asset_folder: 'products',
          secure_url: url,
          format: 'webp',
          bytes: 1000,
          width: 1200,
          height: 1000,
          resource_type: 'image',
          type: 'upload',
        };
      },
      destroy,
    },
  },
  { ADMIN_EMAIL: 'user_Admin@example.test', CLOUDINARY_CLOUD_NAME: cloud },
);
const send = (
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  url: string,
  payload?: object,
) =>
  fixture.app.inject({
    method,
    url,
    ...(payload ? { payload } : {}),
    headers: auth,
  });

it('protects every product operation and validates write and query inputs', async () => {
  const id = new Types.ObjectId();
  const calls = [
    { method: 'GET' as const, url: base },
    { method: 'GET' as const, url: base + '/' + id },
    { method: 'POST' as const, url: base, payload: product },
    {
      method: 'PATCH' as const,
      url: base + '/' + id,
      payload: { price: 0.99 },
    },
    { method: 'DELETE' as const, url: base + '/' + id },
    {
      method: 'POST' as const,
      url: base + '/' + id + '/stock',
      payload: { delta: -1, reason: 'damage' },
    },
  ];
  for (const call of calls) {
    expect((await fixture.app.inject(call)).statusCode).toBe(401);
    expect(
      (await fixture.app.inject({ ...call, headers: bearer() })).statusCode,
    ).toBe(403);
  }
  expect((await send('GET', base + '?stockStatus=unknown')).statusCode).toBe(
    400,
  );
  expect((await send('GET', base + '/bad')).statusCode).toBe(400);
  expect(
    (await send('POST', base, { ...product, price: 1.001 })).statusCode,
  ).toBe(400);
  expect(
    (
      await send('POST', base, {
        ...product,
        images: [{ ...image, url: 'https://evil.test/image.webp' }],
      })
    ).statusCode,
  ).toBe(400);
});
it('manages legacy-compatible products, snapshots and concurrent stock deltas', async () => {
  const created = await send('POST', base, product);
  expect(created.statusCode, created.body).toBe(201);
  const { id } = created.json();
  const path = base + '/' + id;
  expect((await send('GET', path)).json()).toMatchObject({
    images: [url],
    imageAssets: [image],
  });
  expect(created.json()).not.toHaveProperty('webImageAssets');
  expect((await send('PATCH', path, { stock: 99 })).statusCode).toBe(400);
  expect(
    (await send('PATCH', path, { category: 'Áo khoác' })).json().category,
  ).toBe('Áo khoác');
  const delta = { delta: -1, reason: 'inventory_count' };
  const attempts = await Promise.all([
    send('POST', path + '/stock', delta),
    send('POST', path + '/stock', delta),
  ]);
  expect(attempts.map((response) => response.statusCode).sort()).toEqual([
    200, 409,
  ]);
  expect((await send('GET', base + '?stockStatus=out')).json().items).toEqual([
    expect.objectContaining({ id, stock: 0, stockStatus: 'out' }),
  ]);
  const session = new Types.ObjectId();
  await fixture.db.collection('web_checkout_sessions').insertOne({
    _id: session,
    user: new Types.ObjectId(),
    clerkId: 'fixture',
    key: 'fixture',
    status: 'pending',
    items: [{ product: new Types.ObjectId(id), image: url }],
  });
  expect((await send('DELETE', path)).json().error.code).toBe(
    'PRODUCT_RESERVED',
  );
  await fixture.db
    .collection('web_checkout_sessions')
    .deleteOne({ _id: session });
  await fixture.db
    .collection('orders')
    .insertOne({ orderItems: [{ image: url, name: product.name }] });
  expect((await send('DELETE', path)).statusCode).toBe(200);
  expect((await send('GET', path)).statusCode).toBe(404);
  expect(destroy).not.toHaveBeenCalled();
});
