import { z } from 'zod';

export {
  checkoutInput,
  checkoutHeaders,
  stripeHeaders,
  checkoutQuote,
  checkoutStatus,
  orderDto,
  orderListDto,
  checkoutShippingFields,
} from '@storefront/shared';

export const stripeSession = z.object({
  id: z.string().startsWith('cs_test_'),
  status: z.enum(['open', 'complete', 'expired']).nullable(),
  payment_status: z.enum(['paid', 'unpaid', 'no_payment_required']),
  payment_intent: z
    .union([
      z.string().startsWith('pi_'),
      z.object({ id: z.string().startsWith('pi_') }),
    ])
    .nullish(),
  amount_total: z.number().int().nullable(),
  currency: z.string().nullable(),
  metadata: z.record(z.string(), z.string()).nullable(),
  url: z.url().nullable(),
  livemode: z.boolean(),
  mode: z.enum(['payment', 'setup', 'subscription']),
  expires_at: z.number().int(),
});
export const stripeEvent = z.object({
  id: z.string().startsWith('evt_').max(128),
  data: z.object({ object: stripeSession }),
});
