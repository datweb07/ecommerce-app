import { randomUUID } from 'node:crypto';
import { v2 as cloudinary } from 'cloudinary';
import type { Connection } from 'mongoose';
import type { z } from 'zod';
import { maxProductImageBytes } from '@storefront/shared';
import type { Order, orderModel } from '../../models/order.js';
import type { Env } from '../../config/env.js';
import { ApiError } from '../../plugins/errors.js';
import type { NotificationService } from '../notifications/service.js';
import type { adminOrderPatch, pagination } from './schemas.js';

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
) {
  async function list(query: z.infer<typeof pagination>) {
    const [rows, total] = await Promise.all([
      orders
        .find()
        .select(orderFields)
        .sort({ createdAt: -1, _id: -1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .lean(),
      orders.countDocuments(),
    ]);
    return { ...query, total, items: rows.map(view) };
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

  return { list, changeStatus, uploadSignature };
}

export type AdminService = ReturnType<typeof adminService>;
