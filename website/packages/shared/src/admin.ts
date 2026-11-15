import { z } from 'zod';
import { objectId } from './auth.js';
import { pageInfo } from './products.js';
import { notificationStatus } from './notifications.js';

export const adminMeDto = z.object({ id: objectId, isAdmin: z.literal(true) });

export const orderStatus = z.enum(['pending', 'shipped', 'delivered']);
export const adminOrderPatch = z.strictObject({
  expectedStatus: orderStatus,
  status: notificationStatus,
});
export const adminOrderDto = z.object({
  id: objectId,
  status: orderStatus,
  totalPrice: z.number(),
  itemCount: z.number().nonnegative(),
  createdAt: z.iso.datetime().nullable(),
  shippedAt: z.iso.datetime().nullable(),
  deliveredAt: z.iso.datetime().nullable(),
});
export const adminOrderList = z.object({
  ...pageInfo.shape,
  items: z.array(adminOrderDto),
});

export const maxProductImageBytes = 5 * 1024 * 1024;
export const uploadSignatureInput = z.strictObject({
  sizeBytes: z.number().int().min(1).max(maxProductImageBytes),
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
});
export const uploadSignatureDto = z.object({
  uploadUrl: z.url(),
  apiKey: z.string(),
  signature: z.string(),
  expiresAt: z.iso.datetime(),
  maxBytes: z.literal(maxProductImageBytes),
  params: z.object({
    timestamp: z.number().int().positive(),
    asset_folder: z.literal('products'),
    public_id: z.string(),
    type: z.literal('upload'),
    overwrite: z.literal(false),
    allowed_formats: z.literal('jpg,jpeg,png,webp'),
  }),
});
