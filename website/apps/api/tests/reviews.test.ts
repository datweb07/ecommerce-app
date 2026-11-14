import { expect, it } from 'vitest';
import { Types } from 'mongoose';
import { bearer, replica } from './support/replica.js';
import { sampleProducts } from '../src/scripts/product-data.js';

const fixture = replica();
const url = '/api/v1/reviews';
const request = (
  method: 'POST' | 'PATCH' | 'DELETE',
  path: string,
  user: string,
  payload?: object,
) =>
  fixture.app.inject({
    method,
    url: url + path,
    headers: bearer(user),
    ...(payload ? { payload } : {}),
  });

async function product() {
  const template = sampleProducts[0];
  if (!template) throw new Error('Missing product fixture');
  return (
    await fixture.db
      .collection('products')
      .insertOne({ ...template, _id: new Types.ObjectId() })
  ).insertedId;
}

async function order(
  user: string,
  productId: Types.ObjectId,
  status = 'delivered',
) {
  const response = await fixture.app.inject({
    url: '/api/v1/me',
    headers: bearer(user),
  });
  expect(response.statusCode).toBe(200);
  return (
    await fixture.db.collection('orders').insertOne({
      clerkId: user,
      user: new Types.ObjectId(response.json().id),
      status,
      totalPrice: 12,
      shippingAddress: {
        fullName: 'Test buyer',
        streetAddress: '1 Test Street',
        city: 'Test',
        state: 'Test',
        zipCode: '12345',
        phoneNumber: '+12025550123',
      },
      orderItems: [
        {
          product: productId,
          name: 'Test product',
          price: 12,
          quantity: 1,
          image: 'test.png',
        },
      ],
    })
  ).insertedId.toString();
}

it('validates rating, purchase ownership, delivery and product membership', async () => {
  const id = await product();
  const pending = await order('user_Buyer', id, 'pending');
  const delivered = await order('user_Buyer', id);
  const body = { productId: id.toString(), orderId: pending, rating: 4 };
  expect(
    (await fixture.app.inject({ method: 'POST', url, payload: body }))
      .statusCode,
  ).toBe(401);
  expect((await request('POST', '', 'user_Other', body)).statusCode).toBe(404);
  expect((await request('POST', '', 'user_Buyer', body)).statusCode).toBe(409);
  expect(
    (
      await request('POST', '', 'user_Buyer', {
        ...body,
        orderId: delivered,
        productId: new Types.ObjectId().toString(),
      })
    ).statusCode,
  ).toBe(409);
  for (const rating of [0, 6, 2.5, '4', { $gt: 0 }]) {
    expect(
      (
        await request('POST', '', 'user_Buyer', {
          ...body,
          orderId: delivered,
          rating,
        })
      ).statusCode,
    ).toBe(400);
  }
  expect(
    (await request('PATCH', '/invalid', 'user_Buyer', { rating: 4 }))
      .statusCode,
  ).toBe(400);
});

it('protects review ownership and serializes duplicates and aggregate writes', async () => {
  const id = await product();
  const left = await order('user_Left', id);
  const right = await order('user_Right', id);
  const productId = id.toString();
  const create = (user: string, orderId: string, rating: number) =>
    request('POST', '', user, { productId, orderId, rating });
  const [a, b, c] = await Promise.all([
    create('user_Left', left, 5),
    create('user_Left', left, 5),
    create('user_Right', right, 3),
  ]);
  expect([a.statusCode, b.statusCode, c.statusCode].sort()).toEqual([
    201, 201, 409,
  ]);
  const leftPath = '/' + (a.statusCode === 201 ? a : b).json().id;
  const rightPath = '/' + c.json().id;
  const lookup = () => fixture.db.collection('products').findOne({ _id: id });
  expect(await lookup()).toMatchObject({ averageRating: 4, totalReviews: 2 });
  const ownOrder = await fixture.app.inject({
    url: '/api/v1/orders/' + left,
    headers: bearer('user_Left'),
  });
  expect(ownOrder.statusCode, ownOrder.body).toBe(200);
  expect(ownOrder.json().items[0]).toMatchObject({
    canReview: false,
    review: { id: leftPath.slice(1), rating: 5 },
  });
  expect(
    (await request('PATCH', leftPath, 'user_Right', { rating: 1 })).statusCode,
  ).toBe(404);
  expect((await request('DELETE', leftPath, 'user_Right')).statusCode).toBe(
    404,
  );
  const [updated, deleted] = await Promise.all([
    request('PATCH', leftPath, 'user_Left', { rating: 4 }),
    request('DELETE', rightPath, 'user_Right'),
  ]);
  expect(updated.statusCode).toBe(200);
  expect(updated.json()).toMatchObject({ rating: 4, productId });
  expect(updated.json()).not.toHaveProperty('userId');
  expect(deleted.statusCode).toBe(200);
  expect(await lookup()).toMatchObject({ averageRating: 4, totalReviews: 1 });
  expect((await request('DELETE', leftPath, 'user_Left')).statusCode).toBe(200);
  expect(await lookup()).toMatchObject({ averageRating: 0, totalReviews: 0 });
  expect(
    (await fixture.db.collection('reviews').indexes()).some(
      (index) => index.unique,
    ),
  ).toBe(false);
});
