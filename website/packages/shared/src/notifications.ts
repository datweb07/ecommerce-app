import { z } from 'zod';
import { objectId } from './auth.js';
import { paginationFields } from './products.js';

export const notificationStatus = z.enum(['shipped', 'delivered']);
export const notificationCursor = z.string().regex(/^\d{13}\.[a-f0-9]{24}$/);
export const notificationQuery = z.strictObject({
  cursor: notificationCursor.optional(),
  limit: paginationFields.limit,
});
export const notificationDto = z.object({
  id: objectId,
  orderId: objectId,
  status: notificationStatus,
  occurredAt: z.iso.datetime(),
  createdAt: z.iso.datetime(),
  readAt: z.iso.datetime().nullable(),
});
export const notificationInbox = z.object({
  items: z.array(notificationDto),
  unreadCount: z.number().int().nonnegative(),
  nextCursor: notificationCursor.nullable(),
});
export const notificationReadAllDto = z.object({
  readCount: z.number().int().nonnegative(),
  cutoff: z.iso.datetime(),
});
