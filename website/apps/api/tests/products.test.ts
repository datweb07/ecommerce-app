import { beforeAll, expect, it } from 'vitest';
import { Types } from 'mongoose';
import { replica } from './support/replica.js';
import { sampleProducts } from '../src/scripts/product-data.js';

const fixture = replica();
const id = new Types.ObjectId();
const second = new Types.ObjectId();
const author = new Types.ObjectId();
const request = (path: string) => fixture.app.inject('/api/v1' + path);

beforeAll(async () => {
  const template = sampleProducts[0];
  if (!template) throw new Error('Missing product fixture');
  await fixture.db.collection('products').insertMany([
    {
      ...template,
      _id: id,
      name: 'Laptop Max',
      price: 20,
      category: 'Computing',
      stock: 1,
      averageRating: 4,
      createdAt: new Date(1000),
      secret: 'private',
    },
    {
      ...template,
      _id: second,
      name: 'Laptop Mini',
      price: 10,
      category: 'Computing',
      stock: 0,
      averageRating: 5,
      createdAt: new Date(2000),
    },
    {
      ...template,
      _id: new Types.ObjectId(),
      name: 'Headphones',
      price: 30,
      category: 'Audio',
      stock: 4,
      averageRating: 3,
      createdAt: new Date(3000),
    },
  ]);
  await fixture.db.collection('users').insertOne({
    _id: author,
    clerkId: 'user_Reviewer',
    name: 'Reviewer',
    email: 'private@example.test',
    expoPushToken: 'private',
  });
  await fixture.db.collection('reviews').insertOne({
    productId: id,
    userId: author,
    orderId: new Types.ObjectId(),
    rating: 4,
    createdAt: new Date(1000),
  });
  await fixture.db.collection('orders').insertOne({
    status: 'delivered',
    createdAt: new Date(),
    orderItems: [{ product: id, quantity: 8 }],
  });
});

it('combines filters, returns stable pages and permits only supported sorts', async () => {
  const filtered = await request(
    '/products?q=laptop&category=Computing&minPrice=15&maxPrice=30&minRating=4&inStock=true',
  );
  expect(filtered.statusCode).toBe(200);
  expect(filtered.json()).toMatchObject({
    total: 1,
    items: [{ id: id.toString(), price: 20 }],
  });
  expect(filtered.headers['cache-control']).toContain('public');
  expect(
    (await request('/products?sort=price&limit=1&page=2')).json().items[0].id,
  ).toBe(id.toString());
  expect((await request('/products?sort=rating')).json().items[0].id).toBe(
    second.toString(),
  );
  expect((await request('/products?sort=bestselling')).json().items[0].id).toBe(
    id.toString(),
  );
  expect((await request('/products?sort=unknown')).statusCode).toBe(400);
  expect((await request('/products?page=501&limit=100')).statusCode).toBe(400);
});
it('escapes regex and rejects injected query operators', async () => {
  expect(
    (await request('/products?q=' + encodeURIComponent('.*'))).json().total,
  ).toBe(0);
  expect((await request('/products?category%5B%24ne%5D=x')).statusCode).toBe(
    400,
  );
  expect((await request('/products?minPrice=12&maxPrice=4')).statusCode).toBe(
    400,
  );
});
it('maps public product, reviews and related records to safe DTOs', async () => {
  const detail = await request('/products/' + id);
  expect(detail.json()).not.toHaveProperty('secret');
  expect(detail.json()).not.toHaveProperty('_id');
  expect(
    (await request('/products/' + id + '/related')).json().items,
  ).toMatchObject([{ id: second.toString() }]);
  expect((await request('/products/' + id + '/reviews')).json().items).toEqual([
    {
      displayName: 'Reviewer',
      rating: 4,
      createdAt: new Date(1000).toISOString(),
    },
  ]);
  expect((await request('/categories')).json()).toEqual({
    items: ['Audio', 'Computing'],
  });
  expect((await request('/products/bad')).statusCode).toBe(400);
  expect((await request('/products/' + new Types.ObjectId())).statusCode).toBe(
    404,
  );
});
it('provides an index plan for category and price ordering', async () => {
  const result = await fixture.db
    .collection('products')
    .find({ category: 'Computing' })
    .sort({ price: 1, _id: 1 })
    .hint({ category: 1, price: 1, _id: 1 })
    .explain('executionStats');
  expect(JSON.stringify(result.queryPlanner.winningPlan)).toContain('IXSCAN');
  expect(result.executionStats.totalKeysExamined).toBe(2);
});
