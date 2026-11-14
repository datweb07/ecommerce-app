import { z } from 'zod';
import { addressFields, objectId } from './auth.js';
import { cartVersion } from './customer.js';
import { pageInfo } from './products.js';

const cents = z.number().int().nonnegative().max(99_999_999);
export const checkoutInput = z.strictObject({
  addressId: objectId,
  version: cartVersion,
});
export const checkoutHeaders = z.object({
  'idempotency-key': z
    .string()
    .min(8)
    .max(128)
    .regex(/^[A-Za-z0-9_.:-]+$/),
});
export const stripeHeaders = z.object({
  'stripe-signature': z.string().min(1).max(4096),
});
export const checkoutQuote = z.object({
  currency: z.literal('usd'),
  subtotalCents: cents,
  shippingCents: cents,
  taxCents: cents,
  totalCents: cents,
});
export const checkoutStatus = z.object({
  id: objectId,
  status: z.enum(['pending', 'paid', 'expired', 'failed']),
  url: z.url().nullable(),
  expiresAt: z.iso.datetime(),
  orderId: objectId.nullable(),
  requiresReconciliation: z.boolean(),
});
export const orderDto = z.object({
  id: objectId,
  status: z.enum(['pending', 'shipped', 'delivered']),
  totalPrice: z.number(),
  createdAt: z.iso.datetime().nullable(),
  shippedAt: z.iso.datetime().nullable(),
  deliveredAt: z.iso.datetime().nullable(),
  items: z.array(
    z.object({
      productId: objectId,
      name: z.string(),
      price: z.number(),
      quantity: z.number(),
      image: z.string(),
      canReview: z.boolean(),
      review: z.object({ id: objectId, rating: z.number() }).nullable(),
    }),
  ),
  shippingAddress: z.object({
    fullName: z.string(),
    streetAddress: z.string(),
    city: z.string(),
    state: z.string(),
    zipCode: z.string(),
    phoneNumber: z.string(),
  }),
});
export const orderListDto = z.object({
  items: z.array(orderDto),
  ...pageInfo.shape,
});
export const checkoutShippingFields = addressFields.omit({
  label: true,
  isDefault: true,
});
