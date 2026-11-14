import type { Types } from 'mongoose';
import type { z } from 'zod';
import type { pagination } from '@storefront/shared';
import type { Order, orderModel } from '../../models/order.js';
import type { catalogueModels } from '../../models/catalogue.js';
import type { User } from '../../models/user.js';
import { ApiError } from '../../plugins/errors.js';
import { owner } from '../customer/service.js';

export function orderService(
  orders: ReturnType<typeof orderModel>,
  reviews: ReturnType<typeof catalogueModels>['reviews'],
) {
  async function views(user: User, rows: Order[]) {
    const productIds = rows
      .filter((row) => row.status === 'delivered')
      .flatMap((row) => row.orderItems.map((item) => item.product));
    const existing = productIds.length
      ? await reviews
          .find({ userId: user._id, productId: { $in: productIds } })
          .select({ productId: 1, rating: 1 })
          .sort({ _id: 1 })
          .lean()
      : [];
    const reviewed = new Map(
      existing.map((review) => [
        review.productId.toString(),
        { id: review._id.toString(), rating: review.rating },
      ]),
    );
    return rows.map((row) => {
      const address = row.shippingAddress;
      return {
        id: row._id.toString(),
        status: row.status,
        totalPrice: row.totalPrice,
        createdAt: row.createdAt?.toISOString() ?? null,
        shippedAt: row.shippedAt?.toISOString() ?? null,
        deliveredAt: row.deliveredAt?.toISOString() ?? null,
        items: row.orderItems.map((item) => ({
          productId: item.product.toString(),
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          image: item.image,
          canReview:
            row.status === 'delivered' &&
            !reviewed.has(item.product.toString()),
          review: reviewed.get(item.product.toString()) ?? null,
        })),
        shippingAddress: {
          fullName: address.fullName,
          streetAddress: address.streetAddress,
          city: address.city,
          state: address.state,
          zipCode: address.zipCode,
          phoneNumber: address.phoneNumber,
        },
      };
    });
  }

  async function list(user: User, query: z.infer<typeof pagination>) {
    const filter = owner(user);
    const rows = await orders
      .find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .lean();
    return {
      ...query,
      items: await views(user, rows),
      total: await orders.countDocuments(filter),
    };
  }
  async function get(user: User, id: string | Types.ObjectId) {
    const row = await orders.findOne({ ...owner(user), _id: id }).lean();
    if (!row)
      throw new ApiError(404, 'ORDER_NOT_FOUND', 'Không tìm thấy đơn hàng.');
    const [result] = await views(user, [row]);
    if (!result) throw new Error('Unable to render order snapshot');
    return result;
  }
  return { list, get };
}
export type OrderService = ReturnType<typeof orderService>;
