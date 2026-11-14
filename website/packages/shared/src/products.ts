import { z } from 'zod';
import { objectId } from './auth.js';

const queryInteger = (max: number, fallback: number) =>
  z
    .string()
    .regex(/^[1-9]\d{0,5}$/)
    .transform(Number)
    .pipe(z.number().int().max(max))
    .optional()
    .transform((value) => value ?? fallback);
const queryNumber = z
  .string()
  .regex(/^\d{1,9}(?:\.\d{1,2})?$/)
  .transform(Number);
export const paginationFields = {
  page: queryInteger(501, 1),
  limit: queryInteger(100, 20),
};
export const pagination = z
  .strictObject(paginationFields)
  .refine((value) => (value.page - 1) * value.limit <= 10000);
export const productQuery = z
  .strictObject({
    ...paginationFields,
    q: z.string().trim().min(1).max(80).optional(),
    category: z.string().trim().min(1).max(100).optional(),
    minPrice: queryNumber.optional(),
    maxPrice: queryNumber.optional(),
    minRating: queryNumber.pipe(z.number().max(5)).optional(),
    inStock: z
      .enum(['true', 'false'])
      .transform((v) => v === 'true')
      .optional(),
    sort: z
      .enum(['newest', 'price', 'rating', 'bestselling'])
      .default('newest'),
  })
  .refine(
    (v) =>
      (v.page - 1) * v.limit <= 10000 &&
      (v.minPrice ?? 0) <= (v.maxPrice ?? Infinity),
  );
export const idParams = z.strictObject({ id: objectId });
export const productIdParams = z.strictObject({ productId: objectId });
export const pageInfo = z.object({
  page: z.number(),
  limit: z.number(),
  total: z.number(),
});
export const productDto = z.object({
  id: objectId,
  name: z.string(),
  description: z.string(),
  category: z.string(),
  price: z.number().nonnegative(),
  stock: z.number(),
  images: z.array(z.string()),
  averageRating: z.number(),
  totalReviews: z.number(),
  createdAt: z.iso.datetime().nullable(),
});
export const productListDto = z.object({
  items: z.array(productDto),
  ...pageInfo.shape,
});
export const relatedDto = z.object({ items: z.array(productDto) });
export const categoryListDto = z.object({ items: z.array(z.string()) });
export const publicReviewsDto = z.object({
  items: z.array(
    z.object({
      displayName: z.string(),
      rating: z.number(),
      createdAt: z.iso.datetime().nullable(),
    }),
  ),
  ...pageInfo.shape,
});
