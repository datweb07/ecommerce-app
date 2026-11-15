import { expect, it } from 'vitest';
import { Types } from 'mongoose';
import { bearer, replica } from './support/replica.js';

const auth = bearer('user_Admin');
const fixture = replica({}, { ADMIN_EMAIL: 'user_Admin@example.test' });
const path = '/api/v1/admin/reviews';

it('guards both moderation operations and validates rating and IDs', async () => {
  const id = new Types.ObjectId();
  const routes = [
    { method: 'GET' as const, url: path },
    { method: 'DELETE' as const, url: path + '/' + id },
  ];
  for (const route of routes) {
    expect((await fixture.app.inject(route)).statusCode).toBe(401);
    expect(
      (await fixture.app.inject({ ...route, headers: bearer() })).statusCode,
    ).toBe(403);
  }
  for (const url of [path + '?rating=6', path + '?productId=bad']) {
    expect((await fixture.app.inject({ url, headers: auth })).statusCode).toBe(
      400,
    );
  }
  expect(
    (
      await fixture.app.inject({
        method: 'DELETE',
        url: path + '/bad',
        headers: auth,
      })
    ).statusCode,
  ).toBe(400);
});
it('lists a safe DTO and recomputes rating after concurrent moderation', async () => {
  const author = new Types.ObjectId();
  const product = new Types.ObjectId();
  const reviews = fixture.db.collection('reviews');
  await fixture.db.collection('users').insertOne({
    _id: author,
    name: 'Buyer',
    email: 'private@example.test',
    clerkId: 'private',
  });
  const products = fixture.db.collection('products');
  await products.insertOne({
    _id: product,
    name: 'Tên',
    averageRating: 3,
    totalReviews: 3,
  });
  const ids = await reviews.insertMany(
    [1, 3, 5].map((rating) => ({
      productId: product,
      rating,
      userId: author,
      orderId: new Types.ObjectId(),
    })),
  );
  const result = await fixture.app.inject({
    url: path + '?productId=' + product + '&rating=5&limit=1',
    headers: auth,
  });
  expect(result.statusCode, result.body).toBe(200);
  expect(result.json()).toEqual({
    page: 1,
    limit: 1,
    total: 1,
    items: [
      {
        id: String(ids.insertedIds[2]),
        productId: String(product),
        productName: 'Tên',
        displayName: 'Buyer',
        rating: 5,
        createdAt: null,
      },
    ],
  });
  const remove = (id: Types.ObjectId | undefined) =>
    fixture.app.inject({
      method: 'DELETE',
      url: path + '/' + id,
      headers: auth,
    });
  const outcomes = await Promise.all([
    remove(ids.insertedIds[0]),
    remove(ids.insertedIds[1]),
  ]);
  expect(outcomes.map((response) => response.statusCode)).toEqual([200, 200]);
  expect(await products.findOne({ _id: product })).toMatchObject({
    averageRating: 5,
    totalReviews: 1,
  });
  expect((await remove(ids.insertedIds[0])).statusCode).toBe(404);
  expect((await remove(ids.insertedIds[2])).statusCode).toBe(200);
  expect(await products.findOne({ _id: product })).toMatchObject({
    averageRating: 0,
    totalReviews: 0,
  });
});
