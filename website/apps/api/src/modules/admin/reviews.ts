import type { QueryFilter } from 'mongoose';
import type { z } from 'zod';
import type { adminReviewsQuery } from '@storefront/shared';
import type { catalogueModels, Review } from '../../models/catalogue.js';
import type { AuthService } from '../auth/service.js';

export function adminReviews(
  { products, reviews }: ReturnType<typeof catalogueModels>,
  users: AuthService['users'],
) {
  async function list({
    page,
    limit,
    productId,
    rating,
  }: z.infer<typeof adminReviewsQuery>) {
    const filter: QueryFilter<Review> = {
      ...(productId ? { productId } : {}),
      ...(rating ? { rating } : {}),
    };
    const [rows, total] = await Promise.all([
      reviews
        .find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      reviews.countDocuments(filter),
    ]);
    const [authors, summaries] = await Promise.all([
      users
        .find({ _id: { $in: rows.map((row) => row.userId) } })
        .select({ name: 1 })
        .lean(),
      products
        .find({ _id: { $in: rows.map((row) => row.productId) } })
        .select({ name: 1 })
        .lean(),
    ]);
    const names = new Map(authors.map((row) => [String(row._id), row.name]));
    const productNames = new Map(
      summaries.map((row) => [String(row._id), row.name]),
    );
    return {
      page,
      limit,
      total,
      items: rows.map((row) => ({
        id: String(row._id),
        productId: String(row.productId),
        productName: productNames.get(String(row.productId)) ?? null,
        displayName: names.get(String(row.userId)) ?? 'Khách hàng',
        rating: row.rating,
        createdAt: row.createdAt?.toISOString() ?? null,
      })),
    };
  }
  return { list };
}
export type AdminReviews = ReturnType<typeof adminReviews>;
