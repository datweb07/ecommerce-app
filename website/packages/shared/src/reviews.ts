import { z } from 'zod';
import { objectId } from './auth.js';

const rating = z.number().int().min(1).max(5);
export const reviewCreate = z.strictObject({
  productId: objectId,
  orderId: objectId,
  rating,
});
export const reviewPatch = z.strictObject({ rating });
export const ownReviewDto = z.object({
  id: objectId,
  productId: objectId,
  orderId: objectId,
  rating,
  createdAt: z.iso.datetime().nullable(),
});
