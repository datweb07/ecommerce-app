import { z } from 'zod';
import { objectId } from './auth.js';
import { pageInfo, paginationFields, productDto } from './products.js';
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

export const adminSearch = z.string().trim().min(1).max(100);
export const withinAdminPage = (query: { page: number; limit: number }) =>
  (query.page - 1) * query.limit <= 10_000;
export const imageAssetRef = z.strictObject({
  url: z.url().max(2048),
  publicId: z.string().max(200),
});
export const adminProductQuery = z
  .strictObject({
    ...paginationFields,
    q: adminSearch.optional(),
    category: z.string().trim().min(1).max(100).optional(),
    stockStatus: z.enum(['all', 'low', 'out']).default('all'),
    sort: z.enum(['newest', 'name', 'price', 'stock']).default('newest'),
  })
  .refine(withinAdminPage);
const productFields = {
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(20_000),
  category: z.string().trim().min(1).max(100),
  price: z.number().positive().max(1_000_000).multipleOf(0.01),
  images: z.array(imageAssetRef).min(1).max(20),
};
export const adminProductCreate = z.strictObject({
  ...productFields,
  stock: z.number().int().min(0).max(1_000_000),
});
export const adminProductPatch = z
  .strictObject(productFields)
  .partial()
  .refine((value) => Object.keys(value).length > 0);
export const adminStockInput = z.strictObject({
  delta: z
    .number()
    .int()
    .min(-1_000_000)
    .max(1_000_000)
    .refine((delta) => delta !== 0),
  reason: z.enum(['restock', 'inventory_count', 'damage', 'other']),
});
export const adminProductDto = productDto.extend({
  imageAssets: z.array(imageAssetRef),
  stockStatus: z.enum(['available', 'low', 'out']),
});
export const adminProductList = pageInfo.extend({
  items: z.array(adminProductDto),
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
