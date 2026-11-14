import { expect, it } from 'vitest';
import { Webhook } from 'svix';
import { Types } from 'mongoose';
import { authService } from '../src/modules/auth/service.js';
import { bearer, clerkFixture, replica } from './support/replica.js';

const signingSecret = 'whsec_' + Buffer.alloc(32, 42).toString('base64');
const fixture = replica(
  {},
  {
    CLERK_WEBHOOK_SIGNING_SECRET: signingSecret,
    ADMIN_EMAIL: 'user_A@example.test',
  },
);
const url = '/api/v1/me';

function sendEvent(
  id: string,
  timestamp: number,
  type = 'user.updated',
  bad = false,
) {
  const payload = JSON.stringify(
    {
      type,
      timestamp,
      data: {
        id: 'user_A',
        first_name: 'Identity ' + timestamp,
        image_url: '',
        primary_email_address_id: 'id',
        email_addresses: [
          {
            id: 'id',
            email_address: 'user_A@example.test',
            verification: { status: 'verified' },
          },
        ],
      },
    },
    null,
    2,
  );
  const now = new Date();
  return fixture.app.inject({
    method: 'POST',
    url: '/api/v1/webhooks/clerk',
    payload,
    headers: {
      'content-type': 'application/json',
      'svix-id': id,
      'svix-timestamp': String(Math.floor(now.getTime() / 1000)),
      'svix-signature': bad
        ? 'invalid'
        : new Webhook(signingSecret).sign(id, now, payload),
    },
  });
}

it('returns JSON 401 for missing and invalid session tokens', async () => {
  for (const headers of [{}, { authorization: 'Bearer invalid' }]) {
    const res = await fixture.app.inject({ url, headers });
    expect(res.statusCode).toBe(401);
    expect(res.headers.location).toBeUndefined();
    expect(res.json().error.code).toBe('UNAUTHORIZED');
  }
});
it('hydrates missing users concurrently and returns an allowlisted profile', async () => {
  const responses = await Promise.all(
    Array.from({ length: 4 }, () =>
      fixture.app.inject({ url, headers: bearer() }),
    ),
  );
  expect(responses.map((res) => res.statusCode)).toEqual([200, 200, 200, 200]);
  const profiles = responses.map((res) => res.json());
  expect(new Set(profiles.map((profile) => profile.id)).size).toBe(1);
  expect(profiles[0]).toEqual({
    id: expect.any(String),
    name: 'user_A',
    imageUrl: '',
    bio: '',
    userName: null,
  });
  expect(
    await fixture.db.collection('users').countDocuments({ clerkId: 'user_A' }),
  ).toBe(1);
});
it('allows only profile changes and makes usernames unique across users', async () => {
  const patch = (id: string, payload: object) =>
    fixture.app.inject({ method: 'PATCH', url, headers: bearer(id), payload });
  expect(
    (await patch('user_A', { bio: 'test', userName: 'customer_a' })).statusCode,
  ).toBe(200);
  expect((await patch('user_B', { userName: 'customer_a' })).statusCode).toBe(
    409,
  );
  expect(
    (await patch('user_A', { email: 'spoof@example.test' })).statusCode,
  ).toBe(400);
  expect((await patch('user_B', { bio: { $ne: '' } })).statusCode).toBe(400);
  expect(
    (await fixture.app.inject({ url, headers: bearer('user_B') })).json().bio,
  ).toBe('');
});
it('checks verified upstream primary email for admin', async () => {
  const auth = authService(
    fixture.db.useDb('storefront_web', { useCache: true }),
    clerkFixture,
    'user_A@example.test',
  );
  const admin = authService(
    fixture.db.useDb('admin_probe', { useCache: true }),
    clerkFixture,
    'user_Unverified@example.test',
  );
  const test = await import('fastify');
  const probe = test.default();
  probe.get('/admin', { preHandler: auth.requireAdmin }, async () => ({
    allowed: true,
  }));
  probe.get('/unverified', { preHandler: admin.requireAdmin }, async () => ({
    allowed: true,
  }));
  try {
    expect(
      (await probe.inject({ url: '/admin', headers: bearer() })).statusCode,
    ).toBe(200);
    expect(
      (await probe.inject({ url: '/admin', headers: bearer('user_B') }))
        .statusCode,
    ).toBe(403);
    expect(
      (
        await probe.inject({
          url: '/unverified',
          headers: bearer('user_Unverified'),
        })
      ).statusCode,
    ).toBe(403);
  } finally {
    await probe.close();
  }
});
it('verifies raw bytes, deduplicates deliveries and ignores older identity changes', async () => {
  const users = fixture.db.collection('users');
  const product = new Types.ObjectId();
  await users.updateOne(
    { clerkId: 'user_A' },
    {
      $set: {
        wishlist: [product],
        addresses: [{ label: 'Home' }],
        expoPushToken: 'private',
      },
    },
  );
  expect(
    (await sendEvent('msg_invalid', 1000, 'user.updated', true)).statusCode,
  ).toBe(400);
  const results = await Promise.all([
    sendEvent('msg_update', 2000),
    sendEvent('msg_update', 2000),
  ]);
  expect(results.map((res) => res.statusCode)).toEqual([200, 200]);
  expect((await sendEvent('msg_old', 1000)).statusCode).toBe(200);
  expect(await users.findOne({ clerkId: 'user_A' })).toMatchObject({
    name: 'Identity 2000',
    wishlist: [product],
    addresses: [{ label: 'Home' }],
    bio: 'test',
    userName: 'customer_a',
    expoPushToken: 'private',
  });
  expect(
    await fixture.db
      .collection<{ _id: string }>('web_webhook_events')
      .countDocuments({ _id: 'clerk:msg_update' }),
  ).toBe(1);
});
it('removes the cart on verified deletion and refuses hydration after tombstoning', async () => {
  await fixture.db
    .collection('carts')
    .insertOne({ clerkId: 'user_A', items: [] });
  expect((await sendEvent('msg_delete', 3000, 'user.deleted')).statusCode).toBe(
    200,
  );
  expect((await sendEvent('msg_stale', 2500)).statusCode).toBe(200);
  expect(
    (await fixture.app.inject({ url, headers: bearer() })).statusCode,
  ).toBe(401);
  expect(
    await fixture.db.collection('carts').countDocuments({ clerkId: 'user_A' }),
  ).toBe(0);
  expect(
    await fixture.db.collection('users').countDocuments({ clerkId: 'user_A' }),
  ).toBe(0);
});
