import type { QueryFilter, Types } from 'mongoose';
import type { z } from 'zod';
import type {
  adminCustomersQuery,
  adminStatsDto,
  adminStatsQuery,
} from '@storefront/shared';
import type { catalogueModels } from '../../models/catalogue.js';
import type { Order, orderModel } from '../../models/order.js';
import type { User } from '../../models/user.js';
import type { AuthService } from '../auth/service.js';
import { escapedSearch } from './products.js';

const dayMs = 86_400_000;
type Stats = z.infer<typeof adminStatsDto>;
type Range = z.infer<typeof adminStatsQuery>['range'];
const ranges = { '7d': 7, '30d': 30, '90d': 90 } as const;
export function adminInsights(
  users: AuthService['users'],
  orders: ReturnType<typeof orderModel>,
  products: ReturnType<typeof catalogueModels>['products'],
  lowStock: number,
) {
  async function customers({
    q,
    page,
    limit,
  }: z.infer<typeof adminCustomersQuery>) {
    const pattern = q ? escapedSearch(q) : undefined;
    const filter: QueryFilter<User> = pattern
      ? { $or: [{ name: pattern }, { email: pattern }] }
      : {};
    const [rows, total] = await Promise.all([
      users
        .find(filter)
        .select({ name: 1, email: 1, createdAt: 1 })
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .maxTimeMS(2500)
        .lean(),
      users.countDocuments(filter).maxTimeMS(2500),
    ]);
    const summaries = await orders
      .aggregate<{
        _id: Types.ObjectId;
        orderCount: number;
        totalSpent: number;
      }>([
        { $match: { user: { $in: rows.map((row) => row._id) } } },
        {
          $group: {
            _id: '$user',
            orderCount: { $sum: 1 },
            totalSpent: {
              $sum: { $round: [{ $multiply: ['$totalPrice', 100] }, 0] },
            },
          },
        },
      ])
      .option({ maxTimeMS: 3000 });
    const counts = new Map(summaries.map((row) => [String(row._id), row]));
    return {
      page,
      limit,
      total,
      items: rows.map((row) => {
        const summary = counts.get(String(row._id));
        return {
          id: String(row._id),
          name: row.name,
          email: row.email,
          createdAt: row.createdAt?.toISOString() ?? null,
          orderCount: summary?.orderCount ?? 0,
          totalSpent: (summary?.totalSpent ?? 0) / 100,
        };
      }),
    };
  }
  const cache = new Map<Range, { expires: number; result: Promise<Stats> }>();
  function stats(range: Range) {
    const cached = cache.get(range);
    if (cached && cached.expires > Date.now()) return cached.result;
    const result = readStats(range).catch((error: unknown) => {
      if (cache.get(range)?.result === result) cache.delete(range);
      throw error;
    });
    cache.set(range, { expires: Date.now() + 60_000, result });
    return result;
  }
  async function readStats(range: Range): Promise<Stats> {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const length = ranges[range];
    const start = new Date(today.getTime() - (length - 1) * dayMs);
    const end = new Date(today.getTime() + dayMs);
    const match: QueryFilter<Order> = { createdAt: { $gte: start, $lt: end } };
    const [
      groups,
      top,
      customerCount,
      productCount,
      lowStockCount,
      outOfStockCount,
    ] = await Promise.all([
      orders
        .aggregate<{
          _id: { date: string; status: Order['status'] };
          count: number;
          cents: number;
        }>([
          { $match: match },
          {
            $group: {
              _id: {
                date: {
                  $dateToString: {
                    format: '%Y-%m-%d',
                    date: '$createdAt',
                    timezone: 'UTC',
                  },
                },
                status: '$status',
              },
              count: { $sum: 1 },
              cents: {
                $sum: { $round: [{ $multiply: ['$totalPrice', 100] }, 0] },
              },
            },
          },
        ])
        .option({ maxTimeMS: 5000 }),
      orders
        .aggregate<{ _id: Types.ObjectId; name: string; quantity: number }>([
          { $match: match },
          { $unwind: '$orderItems' },
          {
            $match: {
              'orderItems.product': { $type: 'objectId' },
              'orderItems.name': { $type: 'string' },
            },
          },
          {
            $group: {
              _id: '$orderItems.product',
              name: {
                $top: {
                  sortBy: { createdAt: -1, _id: -1 },
                  output: '$orderItems.name',
                },
              },
              quantity: { $sum: '$orderItems.quantity' },
            },
          },
          { $sort: { quantity: -1, _id: 1 } },
          { $limit: 5 },
        ])
        .option({ maxTimeMS: 5000 }),
      users.countDocuments().hint('_id_'),
      products.countDocuments().hint('_id_'),
      products.countDocuments({ stock: { $gt: 0, $lte: lowStock } }),
      products.countDocuments({ stock: { $lte: 0 } }),
    ]);
    const totals: Record<Order['status'], number> = {
      pending: 0,
      shipped: 0,
      delivered: 0,
    };
    const daily = new Map<string, number>(
      Array.from({ length }, (_, index) => [
        new Date(start.getTime() + index * dayMs).toISOString().slice(0, 10),
        0,
      ]),
    );
    let orderCount = 0;
    let cents = 0;
    for (const group of groups) {
      if (Object.hasOwn(totals, group._id.status))
        totals[group._id.status] += group.count;
      orderCount += group.count;
      cents += group.cents;
      daily.set(group._id.date, (daily.get(group._id.date) ?? 0) + group.cents);
    }
    return {
      range,
      revenue: cents / 100,
      orderCount,
      customerCount,
      productCount,
      lowStockCount,
      outOfStockCount,
      ordersByStatus: totals,
      revenueByDay: [...daily.entries()].map(([date, value]) => ({
        date,
        revenue: value / 100,
      })),
      topProducts: top.map((item) => ({
        id: String(item._id),
        name: item.name,
        quantity: item.quantity,
      })),
    };
  }
  return { customers, stats };
}
export type AdminInsights = ReturnType<typeof adminInsights>;
