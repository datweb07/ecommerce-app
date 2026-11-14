import { z } from 'zod';
import { addressFields, objectId } from './auth.js';
import { productDto } from './products.js';

export const cartVersion = z
  .number()
  .int()
  .nonnegative()
  .max(Number.MAX_SAFE_INTEGER);
const quantity = z.number().int().positive().max(1000);
export const cartAdd = z.strictObject({ productId: objectId, quantity });
export const cartPatch = z.strictObject({
  quantity,
  version: cartVersion.optional(),
});
export const cartDto = z.object({
  version: cartVersion,
  items: z.array(
    z.object({
      productId: objectId,
      quantity: z.number(),
      product: productDto.nullable(),
      status: z.enum([
        'available',
        'deleted',
        'out_of_stock',
        'insufficient_stock',
      ]),
    }),
  ),
});
export const addressDto = addressFields.extend({ id: objectId }).strip();
export const addressCreate = addressFields.extend({
  isDefault: z.boolean().default(false),
});
export const addressPatch = addressFields
  .partial()
  .refine((value) => Object.keys(value).length > 0);
export const addressListDto = z.object({ items: z.array(addressDto) });
