import { expect, it } from 'vitest';
import { Types } from 'mongoose';
import { bearer, replica } from './support/replica.js';

const fixture = replica({}, { ADMIN_EMAIL: 'user_Admin@example.test' });
const base = '/api/v1/admin';
const auth = bearer('user_Admin');
const get = (path: string, headers = auth) =>
  fixture.app.inject({ url: base + path, headers });

it('guards analytics routes and validates filters', async () => {
  for (const path of ['/customers', '/stats']) {
    expect((await fixture.app.inject({ url: base + path })).statusCode).toBe(
      401,
    );
    expect((await get(path, bearer())).statusCode).toBe(403);
  }
  expect((await get('/stats?range=8d')).statusCode).toBe(400);
  expect((await get('/customers?limit=0')).statusCode).toBe(400);
});
it('groups customer spend and UTC revenue, fills empty days and uses additive indexes', async () => {
  const user = new Types.ObjectId();
  const product = new Types.ObjectId();
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const earlier = new Date(today.getTime() - 10 * 86_400_000);
  const users = fixture.db.collection('users');
  const orders = fixture.db.collection('orders');
  await users.insertOne({
    _id: user,
    name: 'Sample Buyer',
    email: 'sample@example.test',
    createdAt: today,
    clerkId: 'private',
    expoPushToken: 'private',
    addresses: ['private'],
    wishlist: [product],
  });
  await fixture.db
    .collection('products')
    .insertMany([{ _id: product, stock: 2 }, { stock: 0 }, { stock: 7 }]);
  await orders.insertMany([
    {
      user,
      totalPrice: 2.37,
      status: 'shipped',
      createdAt: today,
      orderItems: [{ product, name: 'Snapshot', quantity: 2 }],
    },
    {
      user,
      totalPrice: 0.18,
      status: 'delivered',
      createdAt: today,
      orderItems: [{ product, name: 'Snapshot', quantity: 4 }],
    },
    {
      user,
      totalPrice: 20,
      status: 'pending',
      createdAt: earlier,
      orderItems: [],
    },
  ]);
  const customers = await get('/customers?q=SAMPLE&limit=1');
  expect(customers.statusCode, customers.body).toBe(200);
  expect(customers.json()).toEqual({
    page: 1,
    limit: 1,
    total: 1,
    items: [
      {
        id: String(user),
        name: 'Sample Buyer',
        email: 'sample@example.test',
        createdAt: today.toISOString(),
        totalSpent: 22.55,
        orderCount: 3,
      },
    ],
  });
  expect((await get('/customers?q=.%2A')).json().items).toEqual([]);
  const weekly = await get('/stats?range=7d');
  expect(weekly.statusCode, weekly.body).toBe(200);
  expect(weekly.json()).toMatchObject({
    range: '7d',
    revenue: 2.55,
    orderCount: 2,
    productCount: 3,
    lowStockCount: 1,
    outOfStockCount: 1,
    ordersByStatus: { pending: 0, shipped: 1, delivered: 1 },
    topProducts: [{ id: String(product), name: 'Snapshot', quantity: 6 }],
  });
  expect(weekly.json().revenueByDay).toHaveLength(7);
  expect(
    weekly.json().revenueByDay.map((day: { revenue: number }) => day.revenue),
  ).toEqual([0, 0, 0, 0, 0, 0, 2.55]);
  const monthly = await get('/stats?range=30d');
  expect(monthly.json()).toMatchObject({ revenue: 22.55, orderCount: 3 });
  expect(monthly.json().revenueByDay).toHaveLength(30);
  const plan = await orders
    .find({ createdAt: { $gte: earlier } })
    .hint({ createdAt: -1, _id: -1 })
    .explain('queryPlanner');
  expect(JSON.stringify(plan.queryPlanner.winningPlan)).toContain('IXSCAN');
  const customerPlan = await orders
    .find({ user })
    .hint({ user: 1, createdAt: -1 })
    .explain('queryPlanner');
  expect(JSON.stringify(customerPlan.queryPlanner.winningPlan)).toContain(
    'IXSCAN',
  );
});
