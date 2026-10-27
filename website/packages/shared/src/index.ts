import { z } from 'zod';

export const errorResponseSchema = z.object({
  error: z.object({ code: z.string(), message: z.string() }),
  requestId: z.string(),
});

export const healthResponseSchema = z.object({
  status: z.enum(['ok', 'unavailable']),
  service: z.literal('storefront-api'),
  requestId: z.string(),
});

// Product interchange only: no business routes or models in phase 1.
export const productImportSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(20_000),
  price: z.number().finite().nonnegative(),
  stock: z.number().int().nonnegative(),
  category: z.string().trim().min(1).max(100),
  images: z
    .array(z.url().refine((url) => url.startsWith('https://')))
    .min(1)
    .max(10),
  averageRating: z.number().min(0).max(5).default(0),
  totalReviews: z.number().int().nonnegative().default(0),
});

export type ErrorResponse = z.infer<typeof errorResponseSchema>;
export type HealthResponse = z.infer<typeof healthResponseSchema>;
export type ImportedProduct = z.infer<typeof productImportSchema>;
