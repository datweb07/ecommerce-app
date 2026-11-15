import Stripe from 'stripe';
import type { Checkout } from '../../models/checkout.js';
import { ApiError } from '../../plugins/errors.js';
import { stripeEvent, stripeSession } from './schemas.js';
import type { z } from 'zod';

export type PaymentSession = z.infer<typeof stripeSession>;
export type PaymentEvent = {
  id: string;
  type: 'paid' | 'expired' | 'failed';
  session: PaymentSession;
};
export interface PaymentProvider {
  create(checkout: Checkout): Promise<PaymentSession>;
  retrieve(id: string): Promise<PaymentSession>;
  verify(raw: string, signature: string): Promise<PaymentEvent | null>;
}
const eventTypes = new Map<string, PaymentEvent['type']>([
  ['checkout.session.completed', 'paid'],
  ['checkout.session.async_payment_succeeded', 'paid'],
  ['checkout.session.async_payment_failed', 'failed'],
  ['checkout.session.expired', 'expired'],
]);

export function stripeProvider(
  key?: string,
  signingSecret?: string,
  client?: Stripe,
): PaymentProvider | undefined {
  if (!key || !signingSecret) return;
  const stripe =
    client ?? new Stripe(key, { maxNetworkRetries: 1, timeout: 8000 });
  let accountId: Promise<string> | undefined;
  function configuredAccountId() {
    accountId ??= stripe.accounts.retrieveCurrent().then(
      (account) => account.id,
      () => {
        accountId = undefined;
        throw new ApiError(
          503,
          'STRIPE_ACCOUNT_UNAVAILABLE',
          'Chưa thể xác minh tài khoản Stripe.',
        );
      },
    );
    return accountId;
  }
  return {
    async create(checkout) {
      const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] =
        checkout.items.map((item) => ({
          quantity: item.quantity,
          price_data: {
            currency: checkout.quote.currency,
            unit_amount: item.unitCents,
            product_data: { name: item.name },
          },
        }));
      const fees = checkout.quote.shippingCents + checkout.quote.taxCents;
      if (fees > 0)
        lineItems.push({
          quantity: 1,
          price_data: {
            currency: checkout.quote.currency,
            unit_amount: fees,
            product_data: { name: 'Shipping and tax' },
          },
        });
      const checkoutId = checkout._id.toString();
      const url = new URL('/checkout/return', checkout.returnOrigin);
      url.searchParams.set('checkoutId', checkoutId);
      const session = await stripe.checkout.sessions.create(
        {
          mode: 'payment',
          ui_mode: 'hosted_page',
          allowed_payment_method_types: ['card'],
          success_url: url.toString(),
          cancel_url: url.toString(),
          expires_at: Math.floor(checkout.expiresAt.getTime() / 1000),
          metadata: { checkoutId },
          line_items: lineItems,
        },
        { idempotencyKey: 'storefront-checkout-' + checkoutId },
      );
      return stripeSession.parse(session);
    },
    async retrieve(id) {
      return stripeSession.parse(await stripe.checkout.sessions.retrieve(id));
    },
    async verify(raw, signature) {
      let event: Stripe.Event;
      try {
        event = stripe.webhooks.constructEvent(raw, signature, signingSecret);
      } catch {
        throw new ApiError(
          400,
          'INVALID_WEBHOOK',
          'Chữ ký Stripe không hợp lệ.',
        );
      }
      const type = eventTypes.get(event.type);
      if (!type || event.livemode || event.account) return null;
      // Resolve the owner of our API key without routing the lookup using the event.
      if (event.context && event.context !== (await configuredAccountId()))
        return null;
      const parsed = stripeEvent.safeParse(event);
      if (!parsed.success)
        throw new ApiError(
          503,
          'UNREADABLE_STRIPE_EVENT',
          'Chưa thể xử lý sự kiện Stripe.',
        );
      return { id: parsed.data.id, type, session: parsed.data.data.object };
    },
  };
}
