import { randomUUID } from 'node:crypto';
import { v2 as cloudinary } from 'cloudinary';
import {
  Types,
  type Connection,
  type PipelineStage,
  type QueryFilter,
} from 'mongoose';
import type { z } from 'zod';
import {
  maxProductImageBytes,
  type adminOrdersQuery,
} from '@storefront/shared';
import type { Order, orderModel } from '../../models/order.js';
import type { Env } from '../../config/env.js';
import { ApiError } from '../../plugins/errors.js';
import type { NotificationService } from '../notifications/service.js';
import type { adminOrderPatch, pagination } from './schemas.js';
import type { checkoutModel } from '../../models/checkout.js';
import type { AuthService } from '../auth/service.js';
import { escapedSearch } from './products.js';

const orderFields = {
  status: 1,
  totalPrice: 1,
  'orderItems.quantity': 1,
  createdAt: 1,
  shippedAt: 1,
  deliveredAt: 1,
} as const;

function view(order: Order) {
  return {
    id: order._id.toString(),
    status: order.status,
    totalPrice: order.totalPrice,
    itemCount: order.orderItems.reduce((sum, item) => sum + item.quantity, 0),
    createdAt: order.createdAt?.toISOString() ?? null,
    shippedAt: order.shippedAt?.toISOString() ?? null,
    deliveredAt: order.deliveredAt?.toISOString() ?? null,
  };
}

export function adminService(
  db: Connection,
  orders: ReturnType<typeof orderModel>,
  notifications: NotificationService,
  env: Env,
  users: AuthService['users'],
  checkouts: ReturnType<typeof checkoutModel>,
) {
  async function list({
    page,
    limit,
    q,
    status,
    from,
    to,
  }: z.infer<typeof adminOrdersQuery>) {
    const offset = (page - 1) * limit;
    const until = to
      ? new Date(new Date(to).getTime() + 86_400_000)
      : undefined;
    const id =
      q && /^[a-f0-9]{24}$/i.test(q) ? new Types.ObjectId(q) : undefined;
    const filter: QueryFilter<Order> = {
      ...(id ? { _id: id } : {}),
      ...(status ? { status } : {}),
      ...(from || until
        ? {
            createdAt: {
              ...(from ? { $gte: new Date(from) } : {}),
              ...(until ? { $lt: until } : {}),
            },
          }
        : {}),
    };
    if (q && !id) {
      const steps: PipelineStage[] = [
        { $match: filter },
        {
          $lookup: {
            from: 'users',
            localField: 'user',
            foreignField: '_id',
            pipeline: [
              { $match: { email: escapedSearch(q) } },
              { $project: { _id: 1 } },
            ],
            as: 'customerMatch',
          },
        },
        { $match: { 'customerMatch.0': { $exists: true } } },
        {
          $facet: {
            rows: [
              { $sort: { createdAt: -1, _id: -1 } },
              { $skip: offset },
              { $limit: limit },
              { $project: orderFields },
            ],
            count: [{ $count: 'total' }],
          },
        },
      ];
      const [result] = await orders
        .aggregate<{ rows: Order[]; count: { total: number }[] }>(steps)
        .option({ maxTimeMS: 3000 });
      return {
        page,
        limit,
        total: result?.count[0]?.total ?? 0,
        items: (result?.rows ?? []).map(view),
      };
    }
    const [rows, total] = await Promise.all([
      orders
        .find(filter)
        .select(orderFields)
        .sort({ createdAt: -1, _id: -1 })
        .skip(offset)
        .limit(limit)
        .lean(),
      orders.countDocuments(filter),
    ]);
    return { page, limit, total, items: rows.map(view) };
  }

  async function detail(id: string) {
    const order = await orders.findById(id).lean();
    if (!order)
      throw new ApiError(404, 'ORDER_NOT_FOUND', 'Không tìm thấy đơn hàng.');
    const customer = await users
      .findById(order.user)
      .select({ name: 1, email: 1 })
      .lean();
    return {
      ...view(order),
      customer: customer
        ? { name: customer.name, email: customer.email }
        : null,
      items: order.orderItems.map(
        ({ product, name, price, quantity, image }) => ({
          productId: product.toString(),
          name,
          price,
          quantity,
          image,
        }),
      ),
      shippingAddress: order.shippingAddress,
      paymentReference: order.paymentResult?.id?.slice(-8) || null,
    };
  }

  async function reconciliation({ page, limit }: z.infer<typeof pagination>) {
    const filter = { requiresReconciliation: true };
    const [rows, total] = await Promise.all([
      checkouts
        .find(filter)
        .select({
          status: 1,
          quote: 1,
          orderId: 1,
          createdAt: 1,
          expiresAt: 1,
          paymentIntent: 1,
        })
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      checkouts.countDocuments(filter),
    ]);
    return {
      page,
      limit,
      total,
      items: rows.map((row) => ({
        id: row._id.toString(),
        status: row.status,
        orderId: row.orderId?.toString() ?? null,
        totalCents: row.quote.totalCents,
        currency: row.quote.currency,
        expiresAt: row.expiresAt.toISOString(),
        createdAt: row.createdAt.toISOString(),
        paymentReference: row.paymentIntent?.slice(-8) ?? null,
      })),
    };
  }

  function changeStatus(
    id: string,
    { expectedStatus, status }: z.infer<typeof adminOrderPatch>,
  ) {
    return db.transaction(async (session) => {
      const current = await orders
        .findById(id)
        .select({ ...orderFields, user: 1 })
        .session(session)
        .lean();
      if (!current)
        throw new ApiError(404, 'ORDER_NOT_FOUND', 'Không tìm thấy đơn hàng.');
      if (current.status === status) return view(current);
      const next =
        current.status === 'pending'
          ? 'shipped'
          : current.status === 'shipped'
            ? 'delivered'
            : null;
      if (expectedStatus !== current.status || status !== next) {
        throw new ApiError(
          409,
          'ORDER_STATUS_CONFLICT',
          'Trạng thái đơn hàng đã thay đổi hoặc bước chuyển không hợp lệ.',
        );
      }
      const clockField = status === 'shipped' ? 'shippedAt' : 'deliveredAt';
      const occurredAt = current[clockField] ?? new Date();
      const updated = await orders
        .findOneAndUpdate(
          { _id: current._id, status: expectedStatus },
          { $set: { status, [clockField]: occurredAt } },
          { session, returnDocument: 'after', runValidators: true },
        )
        .select(orderFields)
        .lean();
      if (!updated)
        throw new ApiError(
          409,
          'ORDER_STATUS_CONFLICT',
          'Trạng thái đơn hàng đã thay đổi.',
        );
      await notifications.record(
        { userId: current.user, orderId: current._id, status, occurredAt },
        session,
      );
      return view(updated);
    });
  }

  function uploadSignature() {
    const {
      CLOUDINARY_CLOUD_NAME: cloud,
      CLOUDINARY_API_KEY: apiKey,
      CLOUDINARY_API_SECRET: secret,
    } = env;
    if (!cloud || !apiKey || !secret)
      throw new ApiError(
        503,
        'UPLOAD_UNCONFIGURED',
        'Dịch vụ tải ảnh chưa được cấu hình.',
      );
    const timestamp = Math.floor(Date.now() / 1000);
    const params = {
      timestamp,
      asset_folder: 'products',
      public_id: 'products/' + randomUUID(),
      type: 'upload',
      overwrite: false,
      allowed_formats: 'jpg,jpeg,png,webp',
    } as const;
    return {
      uploadUrl:
        'https://api.cloudinary.com/v1_1/' +
        encodeURIComponent(cloud) +
        '/image/upload',
      apiKey,
      signature: cloudinary.utils.api_sign_request(params, secret),
      params,
      expiresAt: new Date((timestamp + 3600) * 1000).toISOString(),
      maxBytes: maxProductImageBytes,
    };
  }

  return { list, detail, reconciliation, changeStatus, uploadSignature };
}

export type AdminService = ReturnType<typeof adminService>;
