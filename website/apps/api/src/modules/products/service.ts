import { Types, type QueryFilter } from 'mongoose';
import type { z } from 'zod';
import type { pagination, productQuery } from './schemas.js';
import type { Product, catalogueModels } from '../../models/catalogue.js';
import type { orderModel } from '../../models/order.js';
import type { AuthService } from '../auth/service.js';
import { ApiError } from '../../plugins/errors.js';

export function productView(p: Product) {
  return {
    id: p._id.toString(),
    name: p.name,
    description: p.description,
    category: p.category,
    price: p.price,
    stock: p.stock,
    images: p.images,
    averageRating: p.averageRating ?? 0,
    totalReviews: p.totalReviews ?? 0,
    createdAt: p.createdAt?.toISOString() ?? null,
  };
}

export function catalogueService(
  models: ReturnType<typeof catalogueModels>,
  orders: ReturnType<typeof orderModel>,
  users: AuthService['users'],
) {
  const { products, reviews } = models;
  let sales: { until: number; ids: Types.ObjectId[] } | undefined;
  async function bestsellers() {
    if (sales && sales.until > Date.now()) return sales.ids;
    const rows = await orders
      .aggregate<{ _id: Types.ObjectId }>([
        { $match: { status: 'delivered' } },
        { $sort: { createdAt: -1, _id: -1 } },
        { $limit: 5000 },
        { $unwind: '$orderItems' },
        {
          $match: {
            'orderItems.product': { $type: 'objectId' },
            'orderItems.quantity': { $gt: 0 },
          },
        },
        {
          $group: {
            _id: '$orderItems.product',
            quantity: { $sum: '$orderItems.quantity' },
          },
        },
        { $sort: { quantity: -1, _id: 1 } },
        { $limit: 1000 },
      ])
      .option({ maxTimeMS: 2500 });
    sales = { until: Date.now() + 30_000, ids: rows.map((row) => row._id) };
    return sales.ids;
  }
  const pageOffset = ({ page, limit }: z.infer<typeof pagination>) =>
    (page - 1) * limit;
  async function list(query: z.infer<typeof productQuery>) {
    const filter: QueryFilter<Product> = {};
    if (query.category) filter.category = query.category;
    if (query.q) {
      const escaped = query.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.name = { $regex: escaped, $options: 'i' };
    }
    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      filter.price = {
        ...(query.minPrice === undefined ? {} : { $gte: query.minPrice }),
        ...(query.maxPrice === undefined ? {} : { $lte: query.maxPrice }),
      };
    }
    if (query.minRating !== undefined)
      filter.averageRating = { $gte: query.minRating };
    if (query.inStock !== undefined)
      filter.stock = query.inStock ? { $gt: 0 } : { $lte: 0 };
    const { page, limit } = query;
    const sort =
      query.sort === 'price'
        ? { price: 1 as const, _id: 1 as const }
        : query.sort === 'rating'
          ? { averageRating: -1 as const, _id: -1 as const }
          : { createdAt: -1 as const, _id: -1 as const };
    const skip = pageOffset(query);
    let rows: Product[];
    if (query.sort === 'bestselling') {
      const ids = await bestsellers();
      rows = await products
        .aggregate<Product>([
          { $match: filter },
          { $addFields: { salesRank: { $indexOfArray: [ids, '$_id'] } } },
          {
            $addFields: {
              salesRank: {
                $cond: [{ $lt: ['$salesRank', 0] }, ids.length, '$salesRank'],
              },
            },
          },
          { $sort: { salesRank: 1, createdAt: -1, _id: -1 } },
          { $skip: skip },
          { $limit: limit },
        ])
        .option({ maxTimeMS: 2500 });
    } else {
      rows = await products
        .find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .maxTimeMS(2500)
        .lean();
    }
    return {
      items: rows.map(productView),
      page,
      limit,
      total: await products.countDocuments(filter).maxTimeMS(2500),
    };
  }
  async function product(id: string) {
    const row = await products.findById(id).lean();
    if (!row)
      throw new ApiError(404, 'PRODUCT_NOT_FOUND', 'Không tìm thấy sản phẩm.');
    return row;
  }
  async function related(id: string) {
    const current = await product(id);
    const rows = await products
      .find({ category: current.category, _id: { $ne: current._id } })
      .sort({ createdAt: -1, _id: -1 })
      .limit(8)
      .lean();
    return { items: rows.map(productView) };
  }
  async function publicReviews(id: string, query: z.infer<typeof pagination>) {
    const { _id } = await product(id);
    const filter = { productId: _id };
    const rows = await reviews
      .find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip(pageOffset(query))
      .limit(query.limit)
      .lean();
    const authors = await users
      .find({ _id: { $in: rows.map((row) => row.userId) } })
      .select({ name: 1 })
      .lean();
    const names = new Map(
      authors.map((author) => [author._id.toString(), author.name]),
    );
    return {
      items: rows.map((row) => ({
        displayName: names.get(row.userId.toString()) ?? 'Khách hàng',
        rating: row.rating,
        createdAt: row.createdAt?.toISOString() ?? null,
      })),
      ...query,
      total: await reviews.countDocuments(filter),
    };
  }
  async function categories() {
    const rows = await products
      .aggregate<{ _id: string }>([
        { $match: { category: { $type: 'string' } } },
        { $group: { _id: '$category' } },
        { $sort: { _id: 1 } },
        { $limit: 1000 },
      ])
      .option({ maxTimeMS: 2500 });
    return { items: rows.map((row) => row._id) };
  }
  return { list, product, related, publicReviews, categories };
}
