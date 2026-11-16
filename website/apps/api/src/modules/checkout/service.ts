import { Types, type Connection, type ClientSession } from 'mongoose';
import type { z } from 'zod';
import type { FastifyBaseLogger } from 'fastify';
import type { Env } from '../../config/env.js';
import type { User, userModels } from '../../models/user.js';
import type { catalogueModels } from '../../models/catalogue.js';
import type {
  Checkout,
  ReservedItem,
  checkoutModel,
} from '../../models/checkout.js';
import type { orderModel } from '../../models/order.js';
import { groupCartItems, type cartModel } from '../../models/cart.js';
import {
  duplicateKey,
  receiptExpiry,
  type webhookEvents,
} from '../../models/webhook-event.js';
import { ApiError } from '../../plugins/errors.js';
import { owner, cartConflict, stockConflict } from '../customer/service.js';
import type {
  PaymentEvent,
  PaymentProvider,
  PaymentSession,
} from './payment-provider.js';
import {
  checkoutQuote,
  checkoutShippingFields,
  type checkoutInput,
} from './schemas.js';

type Input = z.infer<typeof checkoutInput>;
const reservationTime = 45 * 60_000;
const checkoutMissing = () =>
  new ApiError(404, 'CHECKOUT_NOT_FOUND', 'Không tìm thấy phiên thanh toán.');
const paymentUnavailable = () =>
  new ApiError(
    503,
    'PAYMENT_UNAVAILABLE',
    'Phiên thanh toán chưa sẵn sàng. Hãy thử lại với cùng Idempotency-Key.',
  );
const invalidProduct = () =>
  new ApiError(
    409,
    'PRODUCT_UNAVAILABLE',
    'Sản phẩm trong giỏ không thể thanh toán.',
  );

function checkoutView(row: Checkout) {
  return {
    id: row._id.toString(),
    status: row.status,
    url:
      row.status === 'pending' && !row.requiresReconciliation
        ? (row.url ?? null)
        : null,
    expiresAt: row.expiresAt.toISOString(),
    orderId: row.orderId?.toString() ?? null,
    requiresReconciliation: row.requiresReconciliation ?? false,
  };
}

export function checkoutService(
  db: Connection,
  models: {
    checkouts: ReturnType<typeof checkoutModel>;
    carts: ReturnType<typeof cartModel>;
    users: ReturnType<typeof userModels>['users'];
    products: ReturnType<typeof catalogueModels>['products'];
    orders: ReturnType<typeof orderModel>;
    receipts: ReturnType<typeof webhookEvents>;
  },
  env: Env,
  payment: PaymentProvider | undefined,
  log: FastifyBaseLogger,
) {
  const { checkouts, carts, users, products, orders, receipts } = models;

  async function snapshot(user: User, input: Input, session: ClientSession) {
    const cart = await carts.findOne(owner(user)).session(session).lean();
    if ((cart?.version ?? 0) !== input.version) throw cartConflict();
    const lines = groupCartItems(cart?.items ?? []);
    if (!cart || lines.length === 0)
      throw new ApiError(409, 'EMPTY_CART', 'Giỏ hàng đang trống.');
    if (lines.length > 99)
      throw new ApiError(
        409,
        'CART_LIMIT',
        'Giỏ hàng vượt giới hạn thanh toán 99 sản phẩm.',
      );
    const addressId = new Types.ObjectId(input.addressId);
    const account = await users
      .findOne({
        _id: user._id,
        clerkId: user.clerkId,
        'addresses._id': addressId,
      })
      .select({ 'addresses.$': 1 })
      .session(session)
      .lean();
    const address = account?.addresses[0];
    if (!address)
      throw new ApiError(404, 'ADDRESS_NOT_FOUND', 'Không tìm thấy địa chỉ.');
    const { fullName, streetAddress, city, state, zipCode, phoneNumber } =
      address;
    const shipping = checkoutShippingFields.safeParse({
      fullName,
      streetAddress,
      city,
      state,
      zipCode,
      phoneNumber,
    });
    if (!shipping.success)
      throw new ApiError(
        409,
        'INVALID_ADDRESS',
        'Vui lòng cập nhật địa chỉ giao hàng.',
      );
    const rows = await products
      .find({ _id: { $in: lines.map((line) => line.product) } })
      .session(session)
      .lean();
    const byId = new Map(rows.map((row) => [row._id.toString(), row]));
    const items: ReservedItem[] = lines.map((line) => {
      const product = byId.get(line.product.toString());
      if (
        !product ||
        !product.images?.[0] ||
        !product.name ||
        product.name.length > 200
      )
        throw invalidProduct();
      if (
        !Number.isSafeInteger(line.quantity) ||
        line.quantity < 1 ||
        line.quantity > env.CART_MAX_QUANTITY
      ) {
        throw new ApiError(
          409,
          'INVALID_QUANTITY',
          'Vui lòng cập nhật số lượng trong giỏ.',
        );
      }
      if (!Number.isSafeInteger(product.stock) || product.stock < line.quantity)
        throw stockConflict();
      const unitCents = Math.round(product.price * 100);
      if (
        !Number.isSafeInteger(unitCents) ||
        unitCents < 0 ||
        unitCents / 100 !== product.price
      )
        throw invalidProduct();
      return {
        cartItemId: line._id,
        product: product._id,
        quantity: line.quantity,
        name: product.name,
        image: product.images[0],
        price: product.price,
        unitCents,
      };
    });
    const subtotalCents = items.reduce(
      (sum, item) => sum + item.unitCents * item.quantity,
      0,
    );
    if (!Number.isSafeInteger(subtotalCents) || subtotalCents > 99_999_999)
      throw new ApiError(
        409,
        'INVALID_TOTAL',
        'Giá trị đơn vượt giới hạn thanh toán.',
      );
    const shippingCents = env.SHIPPING_FEE_CENTS;
    const taxCents = Math.floor(
      (subtotalCents * Math.round(env.TAX_RATE * 1_000_000) + 500_000) /
        1_000_000,
    );
    const totalCents = subtotalCents + shippingCents + taxCents;
    const amounts = checkoutQuote.safeParse({
      currency: env.CURRENCY,
      subtotalCents,
      shippingCents,
      taxCents,
      totalCents,
    });
    if (!amounts.success || totalCents < 50)
      throw new ApiError(
        409,
        'INVALID_TOTAL',
        'Giá trị đơn nằm ngoài giới hạn thanh toán.',
      );
    return {
      items,
      shipping: shipping.data,
      quote: amounts.data,
      cart,
      addressId,
    };
  }

  function quote(user: User, input: Input) {
    return db.transaction(
      async (session) => (await snapshot(user, input, session)).quote,
    );
  }

  async function reserve(
    user: User,
    input: Input,
    key: string,
  ): Promise<Checkout> {
    const filter = { ...owner(user), key };
    try {
      return await db.transaction(async (session) => {
        const existing = await checkouts
          .findOne(filter)
          .session(session)
          .lean();
        if (existing) return existing;
        if (
          await checkouts
            .exists({ ...owner(user), status: 'pending' })
            .session(session)
        ) {
          throw new ApiError(
            409,
            'CHECKOUT_PENDING',
            'Bạn đang có một phiên thanh toán chờ xử lý.',
          );
        }
        const state = await snapshot(user, input, session);
        // This write conflicts with cart mutations and normalizes duplicate legacy rows.
        await carts.updateOne(
          { _id: state.cart._id, ...owner(user) },
          {
            $set: { items: groupCartItems(state.cart.items) },
            $inc: { version: 1 },
          },
          { session },
        );
        for (const item of state.items) {
          const result = await products.updateOne(
            { _id: item.product, stock: { $gte: item.quantity } },
            { $inc: { stock: -item.quantity } },
            { session },
          );
          if (!result.matchedCount) throw stockConflict();
        }
        const expiresAt = new Date(
          Math.floor((Date.now() + reservationTime) / 1000) * 1000,
        );
        const row = new checkouts({
          ...filter,
          version: input.version,
          addressId: state.addressId,
          cartId: state.cart._id,
          shipping: state.shipping,
          quote: state.quote,
          items: state.items,
          status: 'pending',
          expiresAt,
          nextSweepAt: expiresAt,
          returnOrigin: env.WEB_ORIGIN,
        });
        await row.save({ session });
        return row.toObject();
      });
    } catch (error) {
      if (!duplicateKey(error)) throw error;
      const existing = await checkouts.findOne(filter).lean();
      if (existing) return existing;
      throw new ApiError(
        409,
        'CHECKOUT_PENDING',
        'Bạn đang có một phiên thanh toán chờ xử lý.',
      );
    }
  }

  function matches(row: Checkout, remote: PaymentSession) {
    return (
      !remote.livemode &&
      remote.mode === 'payment' &&
      remote.metadata?.checkoutId === row._id.toString() &&
      remote.currency === row.quote.currency &&
      remote.amount_total === row.quote.totalCents &&
      remote.expires_at * 1000 === row.expiresAt.getTime()
    );
  }

  async function create(user: User, input: Input, key: string) {
    if (!payment) throw paymentUnavailable();
    const row = await reserve(user, input, key);
    if (
      row.version !== input.version ||
      !row.addressId.equals(input.addressId)
    ) {
      throw new ApiError(
        409,
        'IDEMPOTENCY_CONFLICT',
        'Khóa này đã dùng cho một yêu cầu khác.',
      );
    }
    if (row.status !== 'pending' || row.stripeId || row.requiresReconciliation)
      return checkoutView(row);
    // An ambiguous remote create may have succeeded. Keep the reservation and
    // replay the exact parameters/key only while the checkout can still be open.
    if (row.expiresAt.getTime() <= Date.now()) {
      await checkouts.updateOne(
        { _id: row._id, status: 'pending', stripeId: { $exists: false } },
        { $set: { requiresReconciliation: true } },
      );
      log.warn(
        { checkoutId: row._id.toString() },
        'Checkout creation requires reconciliation',
      );
      return checkoutView(await checkouts.findById(row._id).lean().orFail());
    }
    let remote: PaymentSession;
    try {
      remote = await payment.create(row);
    } catch {
      log.warn(
        { checkoutId: row._id.toString() },
        'Stripe session creation outcome unknown',
      );
      throw paymentUnavailable();
    }
    if (
      !matches(row, remote) ||
      !remote.url ||
      new URL(remote.url).protocol !== 'https:'
    )
      throw paymentUnavailable();
    await checkouts.updateOne(
      {
        _id: row._id,
        status: 'pending',
        $or: [{ stripeId: { $exists: false } }, { stripeId: remote.id }],
      },
      { $set: { stripeId: remote.id, url: remote.url } },
    );
    return checkoutView(
      await checkouts
        .findOne({ ...owner(user), _id: row._id })
        .lean()
        .orFail(),
    );
  }

  async function get(user: User, id: string) {
    const row = await checkouts.findOne({ ...owner(user), _id: id }).lean();
    if (!row) throw checkoutMissing();
    return checkoutView(row);
  }

  async function removePurchased(row: Checkout, session: ClientSession) {
    const filter = { user: row.user, clerkId: row.clerkId, _id: row.cartId };
    const cart = await carts.findOne(filter).session(session).lean();
    if (!cart) return;
    const purchased = new Map(
      row.items.map((item) => [item.cartItemId.toString(), item.quantity]),
    );
    const items = cart.items.flatMap((item) => {
      const amount = purchased.get(item._id.toString());
      if (amount === undefined) return [item];
      const quantity = item.quantity - amount;
      return quantity > 0 ? [{ ...item, quantity }] : [];
    });
    await carts.updateOne(
      filter,
      { $set: { items }, $inc: { version: 1 } },
      { session },
    );
  }

  async function apply(event: PaymentEvent, source: 'webhook' | 'sweep') {
    const remote = event.session;
    const checkoutId = remote.metadata?.checkoutId;
    if (!checkoutId || !/^[a-f\d]{24}$/i.test(checkoutId)) return;
    const receipt = 'stripe:' + event.id;
    try {
      const reconcile = await db.transaction(async (session) => {
        if (await receipts.exists({ _id: receipt }).session(session))
          return false;
        const row = await checkouts
          .findById(checkoutId)
          .session(session)
          .lean();
        if (!row || (row.stripeId && row.stripeId !== remote.id)) return false;
        if (source === 'sweep' && !row.stripeId) return false;
        // The ledger and all inventory/order changes commit together.
        await receipts.create([{ _id: receipt, expiresAt: receiptExpiry() }], {
          session,
        });
        if (!matches(row, remote))
          throw new ApiError(
            409,
            'PAYMENT_MISMATCH',
            'Dữ liệu thanh toán không khớp phiên.',
          );
        if (row.status === 'paid') return false;
        if (event.type === 'paid') {
          if (remote.payment_status !== 'paid' || remote.status !== 'complete')
            return false;
          const intent =
            typeof remote.payment_intent === 'string'
              ? remote.payment_intent
              : remote.payment_intent?.id;
          if (!intent)
            throw new ApiError(
              503,
              'MISSING_PAYMENT_INTENT',
              'Thiếu mã giao dịch thanh toán.',
            );
          if (row.status !== 'pending') {
            await checkouts.updateOne(
              { _id: row._id },
              {
                $set: {
                  stripeId: remote.id,
                  paymentIntent: intent,
                  requiresReconciliation: true,
                },
              },
              { session },
            );
            return true;
          }
          const order = new orders({
            user: row.user,
            clerkId: row.clerkId,
            orderItems: row.items.map(
              ({ product, name, price, quantity, image }) => ({
                product,
                name,
                price,
                quantity,
                image,
              }),
            ),
            shippingAddress: row.shipping,
            paymentResult: { id: intent, status: 'succeeded' },
            totalPrice: row.quote.totalCents / 100,
            status: 'pending',
          });
          await checkouts.updateOne(
            { _id: row._id, status: 'pending' },
            {
              $set: {
                stripeId: remote.id,
                paymentIntent: intent,
                status: 'paid',
                orderId: order._id,
                requiresReconciliation: false,
              },
              $unset: { url: 1 },
            },
            { session },
          );
          await order.save({ session });
          await removePurchased(row, session);
          return false;
        }
        if (row.status !== 'pending' || remote.payment_status !== 'unpaid')
          return false;
        if (event.type === 'expired' && remote.status !== 'expired')
          return false;
        if (event.type === 'failed' && remote.status !== 'complete')
          return false;
        const changed = await checkouts.updateOne(
          { _id: row._id, status: 'pending' },
          {
            $set: {
              status: event.type,
              stripeId: remote.id,
              requiresReconciliation: false,
            },
            $unset: { url: 1 },
          },
          { session },
        );
        if (changed.modifiedCount) {
          for (const item of row.items) {
            await products.updateOne(
              { _id: item.product },
              { $inc: { stock: item.quantity } },
              { session },
            );
          }
        }
        return false;
      });
      if (reconcile)
        log.error(
          { checkoutId },
          'Payment received after stock release; reconcile manually',
        );
    } catch (error) {
      if (duplicateKey(error) && (await receipts.exists({ _id: receipt })))
        return;
      if (error instanceof ApiError && error.code === 'PAYMENT_MISMATCH') {
        log.error(
          { checkoutId },
          'Verified Stripe event did not match the reservation',
        );
        // Preserve the reservation and ask Stripe to redeliver.
        throw new ApiError(
          503,
          'PAYMENT_MISMATCH',
          'Cần đối soát dữ liệu thanh toán.',
        );
      }
      throw error;
    }
  }

  async function receive(raw: string, signature: string) {
    if (!payment) throw paymentUnavailable();
    const event = await payment.verify(raw, signature);
    if (event) await apply(event, 'webhook');
  }

  async function sweep(signal?: AbortSignal) {
    if (!payment || signal?.aborted) return;
    const now = new Date();
    const unknown = await checkouts.updateMany(
      {
        status: 'pending',
        stripeId: { $exists: false },
        expiresAt: { $lte: now },
        requiresReconciliation: { $ne: true },
      },
      { $set: { requiresReconciliation: true } },
    );
    if (unknown.modifiedCount)
      log.warn(
        { count: unknown.modifiedCount },
        'Expired checkout attempts require reconciliation',
      );
    const due = await checkouts
      .find({
        status: 'pending',
        stripeId: { $exists: true },
        nextSweepAt: { $lte: now },
      })
      .sort({ nextSweepAt: 1, _id: 1 })
      .limit(10)
      .select({ stripeId: 1 })
      .lean();
    for (const row of due) {
      if (signal?.aborted) break;
      if (!row.stripeId) continue;
      const claimed = await checkouts.updateOne(
        { _id: row._id, status: 'pending', nextSweepAt: { $lte: now } },
        { $set: { nextSweepAt: new Date(now.getTime() + 5 * 60_000) } },
      );
      if (!claimed.modifiedCount) continue;
      try {
        const remote = await payment.retrieve(row.stripeId);
        // Sweeping releases stock only after Stripe confirms the session expired.
        // Paid orders still require a verified webhook.
        if (remote.id === row.stripeId && remote.status === 'expired') {
          await apply(
            { id: 'sweep:' + remote.id, type: 'expired', session: remote },
            'sweep',
          );
        }
      } catch {
        log.warn(
          { checkoutId: row._id.toString() },
          'Stripe expiry lookup failed; reservation kept',
        );
      }
    }
  }
  return { quote, create, get, receive, sweep };
}
export type CheckoutService = ReturnType<typeof checkoutService>;
