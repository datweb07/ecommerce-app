import { expect, it } from 'vitest';
import { Types, Schema } from 'mongoose';
import Stripe from 'stripe';
import { bearer, replica } from './support/replica.js';
import { sampleProducts } from '../src/scripts/product-data.js';
import { cartModel, type Cart } from '../src/models/cart.js';
import { checkoutModel } from '../src/models/checkout.js';
import { catalogueModels } from '../src/models/catalogue.js';
import { userModels } from '../src/models/user.js';
import { orderModel } from '../src/models/order.js';
import { webhookEvents } from '../src/models/webhook-event.js';
import { checkoutService } from '../src/modules/checkout/service.js';
import { parseEnv } from '../src/config/env.js';
import {
  stripeProvider,
  type PaymentProvider,
  type PaymentSession,
} from '../src/modules/checkout/payment-provider.js';

const secret = 'whsec_checkout_test_fixture';
const stripe = new Stripe('sk_test_fixture');
const provider = stripeProvider('sk_test_fixture', secret);
if (!provider) throw new Error('Missing fixture provider');
const remoteSessions = new Map<string, PaymentSession>();
const failCreation = new Set<string>();
const payment: PaymentProvider = {
  ...provider,
  async create(row) {
    const id = 'cs_test_' + row._id;
    const remote = remoteSessions.get(id) ?? {
      id,
      status: 'open',
      payment_status: 'unpaid',
      amount_total: row.quote.totalCents,
      currency: row.quote.currency,
      metadata: { checkoutId: row._id.toString() },
      mode: 'payment',
      livemode: false,
      expires_at: row.expiresAt.getTime() / 1000,
      url: 'https://checkout.stripe.com/test/' + row._id,
    };
    remoteSessions.set(id, remote);
    if (failCreation.delete(row.clerkId))
      throw new Error('Provider timed out after creating the session');
    return remote;
  },
  async retrieve(id) {
    const remote = remoteSessions.get(id);
    if (!remote) throw new Error('Missing remote session');
    return remote;
  },
};
const fixture = replica({ payment });
const prefix = '/api/v1';
const clientAddresses = new Map<string, string>();
type Method = 'GET' | 'POST' | 'PATCH';
function request(
  method: Method,
  path: string,
  user: string,
  body?: object,
  key?: string,
) {
  let remoteAddress = clientAddresses.get(user);
  if (!remoteAddress) {
    remoteAddress = '192.0.2.' + (clientAddresses.size + 1);
    clientAddresses.set(user, remoteAddress);
  }
  return fixture.app.inject({
    method,
    remoteAddress,
    url: prefix + path,
    headers: { ...bearer(user), ...(key ? { 'idempotency-key': key } : {}) },
    ...(body ? { payload: body } : {}),
  });
}
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
async function product(stock = 10, price = 12.34) {
  const template = sampleProducts[0];
  if (!template) throw new Error('Missing product fixture');
  const id = new Types.ObjectId();
  await fixture.db
    .collection('products')
    .insertOne({ ...template, _id: id, stock, price });
  return id;
}
async function prepare(user: string, productId: Types.ObjectId, quantity = 1) {
  const addresses = await request('POST', '/addresses', user, address);
  expect(addresses.statusCode, addresses.body).toBe(200);
  const cart = await request('POST', '/cart/items', user, {
    productId: productId.toString(),
    quantity,
  });
  expect(cart.statusCode, cart.body).toBe(200);
  return {
    addressId: addresses.json().items[0].id as string,
    version: cart.json().version as number,
  };
}
function create(user: string, input: object, key = 'test-key-0001') {
  return request('POST', '/checkout/sessions', user, input, key);
}
function remoteFor(id: string) {
  const remote = remoteSessions.get('cs_test_' + id);
  if (!remote) throw new Error('Fixture session missing');
  return remote;
}
function event(
  id: string,
  type: string,
  remote: PaymentSession,
  invalid = false,
) {
  const payload = JSON.stringify(
    { id: 'evt_' + id, type, livemode: false, data: { object: remote } },
    null,
    2,
  );
  return fixture.app.inject({
    method: 'POST',
    url: prefix + '/webhooks/stripe',
    payload,
    headers: {
      'content-type': 'application/json',
      'stripe-signature': invalid
        ? 'bad'
        : stripe.webhooks.generateTestHeaderString({ payload, secret }),
    },
  });
}
function paid(remote: PaymentSession): PaymentSession {
  return {
    ...remote,
    status: 'complete',
    payment_status: 'paid',
    payment_intent: 'pi_' + remote.id,
  };
}
const completed = 'checkout.session.completed';
const expired = 'checkout.session.expired';

it('quotes cents from the database, denies forged money, and detects cart and ownership conflicts', async () => {
  const id = await product();
  const input = await prepare('user_Quote', id, 2);
  const quote = await request('POST', '/checkout/quote', 'user_Quote', input);
  expect(quote.statusCode, quote.body).toBe(200);
  expect(quote.json()).toEqual({
    currency: 'usd',
    subtotalCents: 2468,
    shippingCents: 1000,
    taxCents: 197,
    totalCents: 3665,
  });
  expect(
    (await create('user_Quote', { ...input, totalCents: 1 })).statusCode,
  ).toBe(400);
  const other = await prepare('user_Other', id);
  expect(
    (await create('user_Other', { ...other, addressId: input.addressId }))
      .statusCode,
  ).toBe(404);
  await request('PATCH', '/cart/items/' + id, 'user_Quote', { quantity: 1 });
  expect((await create('user_Quote', input)).statusCode).toBe(409);
  expect((await fixture.app.inject('/api/v1/orders')).statusCode).toBe(401);
});
it('allows exactly one concurrent reservation for the final unit', async () => {
  const id = await product(1);
  const left = await prepare('user_Left', id);
  const right = await prepare('user_Right', id);
  const results = await Promise.all([
    create('user_Left', left),
    create('user_Right', right),
  ]);
  expect(results.map((r) => r.statusCode).sort()).toEqual([200, 409]);
  expect(
    (await fixture.db.collection('products').findOne({ _id: id }))?.stock,
  ).toBe(0);
});
it('normalizes legacy duplicate cart rows and rolls back when any line cannot be reserved', async () => {
  const first = await product(5);
  const second = await product(1);
  const user = 'user_Duplicate';
  const input = await prepare(user, first);
  const carts = fixture.db.collection<Cart>('carts');
  await carts.updateOne(
    { clerkId: user },
    {
      $push: {
        items: {
          $each: [
            { _id: new Types.ObjectId(), product: first, quantity: 2 },
            { _id: new Types.ObjectId(), product: second, quantity: 2 },
          ],
        },
      },
    },
  );
  expect((await create(user, input)).statusCode).toBe(409);
  expect(
    (await fixture.db.collection('products').findOne({ _id: first }))?.stock,
  ).toBe(5);
  expect(
    await fixture.db
      .collection('web_checkout_sessions')
      .countDocuments({ clerkId: user }),
  ).toBe(0);
  const changed = await request('PATCH', '/cart/items/' + second, user, {
    quantity: 1,
  });
  const response = await create(user, {
    ...input,
    version: changed.json().version,
  });
  expect(response.statusCode, response.body).toBe(200);
  const snapshot = await fixture.db
    .collection('web_checkout_sessions')
    .findOne({ clerkId: user });
  expect(
    snapshot?.items.map((item: { quantity: number }) => item.quantity),
  ).toEqual([3, 1]);
  expect(
    (await fixture.db.collection('products').findOne({ _id: first }))?.stock,
  ).toBe(2);
});
it('retries an ambiguous Stripe create with the same reservation and idempotency key', async () => {
  const id = await product(4);
  const user = 'user_Timeout';
  const input = await prepare(user, id);
  failCreation.add(user);
  expect((await create(user, input)).statusCode).toBe(503);
  expect(
    (await fixture.db.collection('products').findOne({ _id: id }))?.stock,
  ).toBe(3);
  const first = await create(user, input);
  expect(first.statusCode, first.body).toBe(200);
  expect((await create(user, input)).json()).toEqual(first.json());
  expect(
    (await create(user, { ...input, version: input.version + 1 })).statusCode,
  ).toBe(409);
  expect(
    await fixture.db
      .collection('web_checkout_sessions')
      .countDocuments({ clerkId: user }),
  ).toBe(1);
  expect(
    (await fixture.db.collection('products').findOne({ _id: id }))?.stock,
  ).toBe(3);
});
it('requires a signed matching event and only creates one legacy order across concurrent deliveries', async () => {
  const id = await product();
  const user = 'user_Payment';
  const input = await prepare(user, id, 2);
  const response = await create(user, input);
  expect(response.statusCode, response.body).toBe(200);
  const checkout = response.json();
  const session = paid(remoteFor(checkout.id));
  expect(
    (await request('GET', '/checkout/sessions/' + checkout.id, 'user_Other'))
      .statusCode,
  ).toBe(404);
  expect(
    (await request('GET', '/checkout/sessions/' + checkout.id, user)).json()
      .status,
  ).toBe('pending');
  expect((await event('bad', completed, session, true)).statusCode).toBe(400);
  expect(
    (await event('wrong_amount', completed, { ...session, amount_total: 1 }))
      .statusCode,
  ).toBe(503);
  expect(
    (await event('foreign', completed, { ...session, id: 'cs_test_foreign' }))
      .statusCode,
  ).toBe(200);
  expect(
    await fixture.db.collection('orders').countDocuments({ clerkId: user }),
  ).toBe(0);
  expect(
    (
      await request('POST', '/cart/items', user, {
        productId: id.toString(),
        quantity: 1,
      })
    ).statusCode,
  ).toBe(200);
  const results = await Promise.all([
    event('paid_one', completed, session),
    event('paid_one', completed, session),
    event('paid_other_delivery', completed, session),
  ]);
  expect(results.map((r) => r.statusCode)).toEqual([200, 200, 200]);
  expect(
    await fixture.db.collection('orders').countDocuments({ clerkId: user }),
  ).toBe(1);
  expect((await request('GET', '/cart', user)).json().items[0].quantity).toBe(
    1,
  );
  const orderId = (
    await request('GET', '/checkout/sessions/' + checkout.id, user)
  ).json().orderId;
  const legacy = fixture.db.model(
    'LegacyShapeProbe',
    new Schema({
      user: Schema.Types.ObjectId,
      clerkId: String,
      orderItems: [
        {
          product: Schema.Types.ObjectId,
          name: String,
          image: String,
          price: Number,
          quantity: Number,
        },
      ],
      shippingAddress: {
        fullName: String,
        streetAddress: String,
        city: String,
        state: String,
        zipCode: String,
        phoneNumber: String,
      },
      paymentResult: { id: String, status: String },
      status: { type: String, enum: ['pending', 'shipped', 'delivered'] },
      totalPrice: Number,
    }),
    'orders',
  );
  const saved = await legacy.findById(orderId).orFail();
  await expect(saved.validate()).resolves.toBeUndefined();
  expect(saved.toObject()).toMatchObject({
    status: 'pending',
    totalPrice: 36.65,
    paymentResult: { id: session.payment_intent, status: 'succeeded' },
    orderItems: [{ product: id, price: 12.34, quantity: 2 }],
  });
  await fixture.db.collection('products').deleteOne({ _id: id });
  expect(
    (await request('GET', '/orders/' + orderId, 'user_Other')).statusCode,
  ).toBe(404);
  expect((await request('GET', '/orders/bad', user)).statusCode).toBe(400);
  expect((await request('GET', '/orders', user)).json().items[0]).toMatchObject(
    { id: orderId, items: [{ price: 12.34, canReview: false }] },
  );
  await fixture.db
    .collection('orders')
    .updateOne(
      { _id: new Types.ObjectId(orderId) },
      { $set: { status: 'delivered' } },
    );
  expect(
    (await request('GET', '/orders/' + orderId, user)).json().items[0]
      .canReview,
  ).toBe(true);
});
it('rolls back event receipt and checkout when an order write fails, then accepts the retry', async () => {
  const id = await product();
  const user = 'user_Rollback';
  const response = await create(user, await prepare(user, id));
  expect(response.statusCode, response.body).toBe(200);
  const checkout = response.json();
  const session = paid(remoteFor(checkout.id));
  const connection = fixture.db.db;
  if (!connection) throw new Error('Missing database');
  const previous = await connection.command({
    listCollections: 1,
    filter: { name: 'orders' },
  });
  expect(previous.cursor.firstBatch).toHaveLength(1);
  await connection.command({
    collMod: 'orders',
    validator: { totalPrice: { $lt: 0 } },
    validationLevel: 'strict',
  });
  try {
    expect((await event('rollback', completed, session)).statusCode).toBe(500);
    expect(
      (await request('GET', '/checkout/sessions/' + checkout.id, user)).json()
        .status,
    ).toBe('pending');
    expect(
      await fixture.db
        .collection<{ _id: string }>('web_webhook_events')
        .countDocuments({ _id: 'stripe:evt_rollback' }),
    ).toBe(0);
  } finally {
    await connection.command({ collMod: 'orders', validator: {} });
  }
  expect((await event('rollback', completed, session)).statusCode).toBe(200);
  expect(
    await fixture.db.collection('orders').countDocuments({ clerkId: user }),
  ).toBe(1);
});
it('releases an expired reservation once and flags a paid event after release', async () => {
  const id = await product(2);
  const user = 'user_Expired';
  const response = await create(user, await prepare(user, id));
  expect(response.statusCode, response.body).toBe(200);
  const checkout = response.json();
  const session = remoteFor(checkout.id);
  const results = await Promise.all([
    event('expired_a', expired, { ...session, status: 'expired' }),
    event('expired_b', expired, { ...session, status: 'expired' }),
  ]);
  expect(results.map((r) => r.statusCode)).toEqual([200, 200]);
  expect(
    (await fixture.db.collection('products').findOne({ _id: id }))?.stock,
  ).toBe(2);
  expect((await event('late_paid', completed, paid(session))).statusCode).toBe(
    200,
  );
  expect(
    (await request('GET', '/checkout/sessions/' + checkout.id, user)).json(),
  ).toMatchObject({
    status: 'expired',
    requiresReconciliation: true,
    orderId: null,
  });
  expect(
    await fixture.db.collection('orders').countDocuments({ clerkId: user }),
  ).toBe(0);
  expect(
    (await fixture.db.collection('products').findOne({ _id: id }))?.stock,
  ).toBe(2);
});
it('claims due sessions once and preserves stock if remote expiry cannot be confirmed', async () => {
  const id = await product(3);
  const user = 'user_Sweep';
  const result = await create(user, await prepare(user, id));
  expect(result.statusCode, result.body).toBe(200);
  const remote = remoteFor(result.json().id);
  const checkouts = checkoutModel(fixture.db);
  const key = new Types.ObjectId(result.json().id);
  await checkouts.updateOne(
    { _id: key },
    { $set: { nextSweepAt: new Date(0) } },
  );
  const { products } = catalogueModels(fixture.db);
  const { users } = userModels(fixture.db);
  const sweep = checkoutService(
    fixture.db,
    {
      checkouts,
      carts: cartModel(fixture.db),
      users,
      products,
      orders: orderModel(fixture.db),
      receipts: webhookEvents(fixture.db),
    },
    parseEnv({}),
    payment,
    fixture.app.log,
  ).sweep;
  await sweep();
  expect((await products.findById(id).lean())?.stock).toBe(2);
  expect(
    (await checkouts.findById(key).lean())?.nextSweepAt.getTime(),
  ).toBeGreaterThan(Date.now());
  await checkouts.updateOne(
    { _id: key },
    { $set: { nextSweepAt: new Date(0) } },
  );
  remoteSessions.set(remote.id, { ...remote, status: 'expired' });
  await Promise.all([sweep(), sweep()]);
  expect((await products.findById(id).lean())?.stock).toBe(3);
  expect((await checkouts.findById(key).lean())?.status).toBe('expired');
});

it('documents every implemented route and authenticated request shape in OpenAPI', async () => {
  expect((await fixture.app.inject('/docs/')).statusCode).toBe(200);
  const spec = await fixture.app.inject('/openapi.json');
  expect(spec.statusCode, spec.body).toBe(200);
  const paths = spec.json().paths;
  expect(
    Object.keys(paths).filter((path) => path.startsWith('/api/v1/')),
  ).toHaveLength(20);
  expect(paths['/api/v1/checkout/sessions'].post.parameters).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        name: 'idempotency-key',
        in: 'header',
        required: true,
      }),
    ]),
  );
  expect(
    paths['/api/v1/webhooks/stripe'].post.requestBody.content[
      'application/json'
    ].schema.type,
  ).toBe('object');
  expect(paths['/api/v1/orders'].get.security).toEqual([{ clerkBearer: [] }]);
});
