import { Types, type ClientSession, type QueryFilter } from 'mongoose';
import type { z } from 'zod';
import type {
  Notification,
  NotificationKey,
  notificationModel,
} from '../../models/notification.js';
import type { orderModel } from '../../models/order.js';
import type { User } from '../../models/user.js';
import { ApiError } from '../../plugins/errors.js';
import { owner } from '../customer/service.js';
import { duplicateKey } from '../../models/webhook-event.js';
import type { notificationQuery } from './schemas.js';

type Occurrence = NotificationKey & { occurredAt: Date };

function view(row: Notification) {
  return {
    id: row._id.toString(),
    orderId: row.orderId.toString(),
    status: row.status,
    occurredAt: row.occurredAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    readAt: row.readAt?.toISOString() ?? null,
  };
}

export function notificationService(
  inbox: ReturnType<typeof notificationModel>,
  orders: ReturnType<typeof orderModel>,
) {
  async function record(
    { occurredAt, ...key }: Occurrence,
    session?: ClientSession,
  ) {
    try {
      await inbox.updateOne(
        key,
        { $setOnInsert: { occurredAt, createdAt: new Date(), readAt: null } },
        { upsert: true, ...(session ? { session } : {}) },
      );
    } catch (error) {
      // A concurrent poll may insert the same unique key first.
      if (session || !duplicateKey(error) || !(await inbox.exists(key)))
        throw error;
    }
  }

  async function reconcile(user: User) {
    const missing = await orders
      .aggregate<Occurrence>([
        {
          $match: {
            ...owner(user),
            $or: [
              { shippedAt: { $type: 'date' } },
              { deliveredAt: { $type: 'date' } },
            ],
          },
        },
        {
          $project: {
            userId: '$user',
            orderId: '$_id',
            events: [
              { status: 'shipped', occurredAt: '$shippedAt' },
              { status: 'delivered', occurredAt: '$deliveredAt' },
            ],
          },
        },
        { $unwind: '$events' },
        { $match: { 'events.occurredAt': { $type: 'date' } } },
        {
          $lookup: {
            from: inbox.collection.name,
            let: { orderId: '$orderId', status: '$events.status' },
            pipeline: [
              {
                $match: {
                  userId: user._id,
                  $expr: {
                    $and: [
                      { $eq: ['$orderId', '$$orderId'] },
                      { $eq: ['$status', '$$status'] },
                    ],
                  },
                },
              },
              { $project: { _id: 1 } },
            ],
            as: 'existing',
          },
        },
        { $match: { 'existing.0': { $exists: false } } },
        { $limit: 100 },
        {
          $project: {
            userId: 1,
            orderId: 1,
            status: '$events.status',
            occurredAt: '$events.occurredAt',
          },
        },
      ])
      .option({ maxTimeMS: 3000 });
    for (const row of missing) {
      // Aggregation includes the order _id unless explicitly excluded.
      await record({
        userId: row.userId,
        orderId: row.orderId,
        status: row.status,
        occurredAt: row.occurredAt,
      });
    }
  }

  async function list(user: User, query: z.infer<typeof notificationQuery>) {
    await reconcile(user);
    const filter: QueryFilter<Notification> = { userId: user._id };
    if (query.cursor) {
      const date = new Date(Number(query.cursor.slice(0, 13)));
      const id = new Types.ObjectId(query.cursor.slice(14));
      filter.$or = [
        { createdAt: { $lt: date } },
        { createdAt: date, _id: { $lt: id } },
      ];
    }
    const [rows, unreadCount] = await Promise.all([
      inbox
        .find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .limit(query.limit + 1)
        .lean(),
      inbox.countDocuments({ userId: user._id, readAt: null }),
    ]);
    const items = rows.slice(0, query.limit);
    const last = items.at(-1);
    return {
      items: items.map(view),
      unreadCount,
      nextCursor:
        rows.length > query.limit && last
          ? last.createdAt.getTime() + '.' + last._id.toString()
          : null,
    };
  }

  async function read(user: User, id: string) {
    const filter = { _id: id, userId: user._id };
    const row =
      (await inbox
        .findOneAndUpdate(
          { ...filter, readAt: null },
          { $set: { readAt: new Date() } },
          { returnDocument: 'after' },
        )
        .lean()) ?? (await inbox.findOne(filter).lean());
    if (!row)
      throw new ApiError(
        404,
        'NOTIFICATION_NOT_FOUND',
        'Không tìm thấy thông báo.',
      );
    return view(row);
  }

  async function readAll(user: User, cutoff: Date) {
    const result = await inbox.updateMany(
      { userId: user._id, readAt: null, createdAt: { $lt: cutoff } },
      { $set: { readAt: cutoff } },
    );
    return { readCount: result.modifiedCount, cutoff: cutoff.toISOString() };
  }

  return { list, read, readAll, record };
}
export type NotificationService = ReturnType<typeof notificationService>;
