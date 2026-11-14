import { checkoutInput, checkoutHeaders } from '@storefront/shared';
import { z } from 'zod';
import { newIdempotencyKey } from './api/transport';

const intentSchema = z.object({
  input: checkoutInput,
  key: checkoutHeaders.shape['idempotency-key'],
  sessionId: z.string().optional(),
});
export type CheckoutIntent = z.infer<typeof intentSchema>;
export const intentStorageKey = (userId: string) =>
  'shopease.checkout.' + userId;
export function readIntent(storage: Pick<Storage, 'getItem'>, userId: string) {
  try {
    const result = intentSchema.safeParse(
      JSON.parse(storage.getItem(intentStorageKey(userId)) ?? 'null'),
    );
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
export function checkoutIntent(
  input: CheckoutIntent['input'],
  previous: CheckoutIntent | null,
) {
  return previous?.input.version === input.version &&
    previous.input.addressId === input.addressId
    ? previous
    : { input, key: newIdempotencyKey() };
}
export function stripeCheckoutUrl(value: string | null) {
  if (!value || !URL.canParse(value)) return null;
  const url = new URL(value);
  return url.origin === 'https://checkout.stripe.com' &&
    !url.username &&
    !url.password
    ? url.href
    : null;
}
export function checkoutPollInterval(attempt: number, elapsed: number) {
  const remaining = 90_000 - elapsed;
  return remaining <= 0
    ? false
    : Math.min(remaining, 2_000 * 2 ** Math.min(attempt, 3));
}
