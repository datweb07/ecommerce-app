import { beforeAll, expect, it } from 'vitest';
import { Types } from 'mongoose';
import { bearer, replica } from './support/replica.js';
import { sampleProducts } from '../src/scripts/product-data.js';

const fixture = replica({}, { CART_MAX_QUANTITY: '5', ADDRESS_MAX_COUNT: '3' });
const id = new Types.ObjectId();
const request = (
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  path: string,
  payload?: object,
  user = 'user_A',
) =>
  fixture.app.inject({
    method,
    url: '/api/v1' + path,
    headers: bearer(user),
    ...(payload ? { payload } : {}),
  });
const address = {
  label: 'Home',
  fullName: 'Customer',
  streetAddress: '1 Test Street',
  city: 'Test',
  state: 'Test',
  zipCode: '12345',
  phoneNumber: '+12025550123',
  isDefault: true,
};

beforeAll(async () => {
  const product = sampleProducts[0];
  if (!product) throw new Error('Missing test product');
  await fixture.db
    .collection('products')
    .insertOne({ ...product, _id: id, stock: 20 });
});
it('protects each private resource and reads a virtual cart without creating one', async () => {
  for (const path of ['/cart', '/wishlist', '/addresses']) {
    expect((await fixture.app.inject('/api/v1' + path)).statusCode).toBe(401);
  }
  expect((await request('GET', '/cart')).json()).toEqual({
    items: [],
    version: 0,
  });
  expect(await fixture.db.collection('carts').countDocuments()).toBe(0);
});
it('adds quantities atomically across concurrent first writes and enforces quantity and version', async () => {
  const add = (quantity: number) =>
    request('POST', '/cart/items', { productId: id.toString(), quantity });
  const result = await Promise.all([add(2), add(2)]);
  expect(result.map((r) => r.statusCode)).toEqual([200, 200]);
  expect((await request('GET', '/cart')).json()).toMatchObject({
    version: 2,
    items: [{ quantity: 4, productId: id.toString() }],
  });
  for (const quantity of [-1, 1.5, 6, 2])
    expect((await add(quantity)).statusCode).toBe(400);
  expect(
    (await request('PATCH', '/cart/items/' + id, { quantity: 1, version: 0 }))
      .statusCode,
  ).toBe(409);
  expect(
    (
      await request('PATCH', '/cart/items/' + id, { quantity: 3, version: 2 })
    ).json().items[0].quantity,
  ).toBe(3);
});
it('does not let another user mutate or inspect cart or wishlist entries', async () => {
  expect(
    (await request('PATCH', '/cart/items/' + id, { quantity: 1 }, 'user_B'))
      .statusCode,
  ).toBe(404);
  await request('DELETE', '/cart/items/' + id, undefined, 'user_B');
  await request('DELETE', '/cart', undefined, 'user_B');
  expect((await request('GET', '/cart')).json().items).toHaveLength(1);
  const results = await Promise.all([
    request('PUT', '/wishlist/' + id),
    request('PUT', '/wishlist/' + id),
  ]);
  expect(results.map((r) => r.statusCode)).toEqual([200, 200]);
  await request('DELETE', '/wishlist/' + id, undefined, 'user_B');
  expect(
    (await request('GET', '/wishlist', undefined, 'user_B')).json().items,
  ).toHaveLength(0);
  expect((await request('GET', '/wishlist')).json().items).toHaveLength(1);
  expect(
    (await request('PUT', '/wishlist/' + new Types.ObjectId())).statusCode,
  ).toBe(404);
});
it('prevents address IDOR and concurrent default addresses', async () => {
  const responses = await Promise.all([
    request('POST', '/addresses', address),
    request('POST', '/addresses', { ...address, label: 'Work' }),
  ]);
  expect(responses.map((r) => r.statusCode)).toEqual([200, 200]);
  const own = (await request('GET', '/addresses')).json().items;
  expect(own).toHaveLength(2);
  const defaults = own.filter(
    (entry: { isDefault: boolean }) => entry.isDefault,
  );
  expect(defaults).toHaveLength(1);
  const path = '/addresses/' + defaults[0].id;
  expect(
    (await request('PATCH', path, { label: 'Other' }, 'user_B')).statusCode,
  ).toBe(404);
  expect((await request('DELETE', path, undefined, 'user_B')).statusCode).toBe(
    404,
  );
  expect(
    (
      await request('POST', '/addresses', {
        ...address,
        phoneNumber: '++++---',
      })
    ).statusCode,
  ).toBe(400);
  expect(
    (await request('POST', '/addresses', { ...address, isDefault: false }))
      .statusCode,
  ).toBe(200);
  expect((await request('POST', '/addresses', address)).statusCode).toBe(409);
  expect(
    (await request('DELETE', path))
      .json()
      .items.every((entry: { isDefault: boolean }) => !entry.isDefault),
  ).toBe(true);
});
it('uses live stock and handles a deleted product without crashing', async () => {
  await fixture.db
    .collection('products')
    .updateOne({ _id: id }, { $set: { stock: 0, price: 55 } });
  expect((await request('GET', '/cart')).json().items[0]).toMatchObject({
    status: 'out_of_stock',
    product: { price: 55 },
  });
  await fixture.db.collection('products').deleteOne({ _id: id });
  expect((await request('GET', '/cart')).json().items[0]).toMatchObject({
    status: 'deleted',
    product: null,
  });
  expect((await request('DELETE', '/cart')).json().items).toEqual([]);
});
