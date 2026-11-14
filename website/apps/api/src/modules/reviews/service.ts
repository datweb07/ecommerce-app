import { Types, type ClientSession, type Connection } from 'mongoose';
import type { z } from 'zod';
import type { catalogueModels, Review } from '../../models/catalogue.js';
import type { orderModel } from '../../models/order.js';
import type { User } from '../../models/user.js';
import { ApiError } from '../../plugins/errors.js';
import { owner } from '../customer/service.js';
import type { reviewCreate } from './schemas.js';

const missingReview = () =>
  new ApiError(404, 'REVIEW_NOT_FOUND', 'Không tìm thấy đánh giá.');

function view(review: Review) {
  return {
    id: review._id.toString(),
    productId: review.productId.toString(),
    orderId: review.orderId.toString(),
    rating: review.rating,
    createdAt: review.createdAt?.toISOString() ?? null,
  };
}

export function reviewService(
  db: Connection,
  { products, reviews }: ReturnType<typeof catalogueModels>,
  orders: ReturnType<typeof orderModel>,
) {
  async function lockProduct(
    productId: Types.ObjectId,
    session: ClientSession,
  ) {
    // A real write to the same product serializes all web review mutations.
    const result = await products.updateOne(
      { _id: productId },
      { $inc: { __v: 1 } },
      { session, timestamps: false },
    );
    return result.matchedCount === 1;
  }

  async function refresh(productId: Types.ObjectId, session: ClientSession) {
    const [summary] = await reviews
      .aggregate<{ average: number; count: number }>([
        { $match: { productId } },
        {
          $group: {
            _id: null,
            average: { $avg: '$rating' },
            count: { $sum: 1 },
          },
        },
      ])
      .session(session);
    await products.updateOne(
      { _id: productId },
      {
        $set: {
          averageRating: summary?.average ?? 0,
          totalReviews: summary?.count ?? 0,
        },
      },
      { session },
    );
  }

  function create(user: User, input: z.infer<typeof reviewCreate>) {
    return db.transaction(async (session) => {
      const order = await orders
        .findOne({ ...owner(user), _id: input.orderId })
        .session(session)
        .lean();
      if (!order)
        throw new ApiError(404, 'ORDER_NOT_FOUND', 'Không tìm thấy đơn hàng.');
      if (
        order.status !== 'delivered' ||
        !order.orderItems.some((item) => item.product.equals(input.productId))
      ) {
        throw new ApiError(
          409,
          'REVIEW_INELIGIBLE',
          'Sản phẩm phải thuộc đơn hàng đã giao.',
        );
      }
      const productId = new Types.ObjectId(input.productId);
      if (!(await lockProduct(productId, session)))
        throw new ApiError(
          404,
          'PRODUCT_NOT_FOUND',
          'Không tìm thấy sản phẩm.',
        );
      if (
        await reviews.exists({ productId, userId: user._id }).session(session)
      ) {
        throw new ApiError(
          409,
          'REVIEW_EXISTS',
          'Bạn đã đánh giá sản phẩm này.',
        );
      }
      const review = new reviews({
        productId,
        userId: user._id,
        orderId: order._id,
        rating: input.rating,
      });
      await review.save({ session });
      await refresh(productId, session);
      return view(review);
    });
  }

  function update(user: User, id: string, rating: number) {
    return db.transaction(async (session) => {
      const filter = { _id: id, userId: user._id };
      const existing = await reviews.findOne(filter).session(session).lean();
      if (!existing) throw missingReview();
      const present = await lockProduct(existing.productId, session);
      const updated = await reviews
        .findOneAndUpdate(
          filter,
          { $set: { rating } },
          { session, returnDocument: 'after' },
        )
        .lean();
      if (!updated) throw missingReview();
      if (present) await refresh(existing.productId, session);
      return view(updated);
    });
  }

  function remove(user: User, id: string) {
    return db.transaction(async (session) => {
      const filter = { _id: id, userId: user._id };
      const existing = await reviews.findOne(filter).session(session).lean();
      if (!existing) throw missingReview();
      const present = await lockProduct(existing.productId, session);
      const result = await reviews.deleteOne(filter, { session });
      if (!result.deletedCount) throw missingReview();
      if (present) await refresh(existing.productId, session);
    });
  }

  return { create, update, remove };
}
export type ReviewService = ReturnType<typeof reviewService>;
