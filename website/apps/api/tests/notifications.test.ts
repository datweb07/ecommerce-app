import { expect, it } from 'vitest';
import { Types } from 'mongoose';
import { bearer, replica } from './support/replica.js';

const fixture = replica();
const base = '/api/v1/notifications';
const call = (
  user = 'user_A',
  suffix = '',
  method: 'GET' | 'PATCH' | 'POST' = 'GET',
) => fixture.app.inject({ url: base + suffix, headers: bearer(user), method });

async function createOrder(user: string, fields: object) {
  const profile = await fixture.app.inject({
    url: '/api/v1/me',
    headers: bearer(user),
  });
  expect(profile.statusCode).toBe(200);
  return (
    await fixture.db.collection('orders').insertOne({
      user: new Types.ObjectId(profile.json().id),
      clerkId: user,
      ...fields,
    })
  ).insertedId;
}

it('reconciles legacy changes without duplicates, isolates accounts and paginates tied dates', async () => {
  const orderId = await createOrder('user_A', { status: 'pending' });
  await createOrder('user_B', {
    status: 'delivered',
    deliveredAt: new Date(200),
  });
  expect((await fixture.app.inject(base)).statusCode).toBe(401);
  const orders = fixture.db.collection('orders');
  await orders.updateOne(
    { _id: orderId },
    {
      $set: {
        status: 'delivered',
        shippedAt: new Date(100),
        deliveredAt: new Date(200),
      },
    },
  );
  const results = await Promise.all([call(), call()]);
  for (const result of results) {
    expect(result.statusCode, result.body).toBe(200);
    expect(result.json().items).toHaveLength(2);
  }
  expect(
    await fixture.db.collection('web_notifications').countDocuments(),
  ).toBe(2);
  await fixture.db
    .collection('web_notifications')
    .updateMany({}, { $set: { createdAt: new Date(1_700_000_000_000) } });
  const first = (await call('user_A', '?limit=1')).json();
  const next = (
    await call('user_A', '?limit=1&cursor=' + first.nextCursor)
  ).json();
  expect(first.unreadCount).toBe(2);
  expect(next.items).toHaveLength(1);
  expect(next.nextCursor).toBeNull();
  expect(next.items[0].id).not.toBe(first.items[0].id);
  const path = '/' + first.items[0].id + '/read';
  expect((await call('user_B', path, 'PATCH')).statusCode).toBe(404);
  const read = (await call('user_A', path, 'PATCH')).json();
  expect(read.readAt).toEqual(expect.any(String));
  expect((await call('user_A', path, 'PATCH')).json()).toEqual(read);
  expect((await call('user_B')).json().items).toHaveLength(1);
  expect((await call('user_A', '?cursor=bad')).statusCode).toBe(400);
});

it('excludes late-imported events from read-all even with older occurrence timestamps', async () => {
  const user = 'user_Late';
  const orderId = await createOrder(user, {
    status: 'shipped',
    shippedAt: new Date(100),
  });
  expect((await call(user)).json().unreadCount).toBe(1);
  await fixture.db
    .collection('web_notifications')
    .updateOne(
      { orderId },
      { $set: { createdAt: new Date(1_700_000_000_000) } },
    );
  // This legacy update has happened, but its inbox entry has not been imported.
  await fixture.db
    .collection('orders')
    .updateOne(
      { _id: orderId },
      { $set: { status: 'delivered', deliveredAt: new Date(200) } },
    );
  const readAll = await call(user, '/read-all', 'POST');
  expect(readAll.statusCode, readAll.body).toBe(200);
  expect(readAll.json().readCount).toBe(1);
  const list = (await call(user)).json();
  expect(list.unreadCount).toBe(1);
  expect(list.items).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        status: 'delivered',
        readAt: null,
        occurredAt: new Date(200).toISOString(),
      }),
      expect.objectContaining({
        status: 'shipped',
        readAt: readAll.json().cutoff,
      }),
    ]),
  );
});
