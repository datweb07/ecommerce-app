import { pagination } from '@storefront/shared';
import type { cartDto } from '@storefront/shared';
import type { z } from 'zod';
export type Cart = z.infer<typeof cartDto>;
export const cartReady = (cart: Cart) =>
  cart.items.length > 0 &&
  cart.items.every((item) => item.status === 'available');
export const cartSubtotal = (cart: Cart) =>
  cart.items.reduce(
    (sum, item) => sum + (item.product?.price ?? 0) * item.quantity,
    0,
  );
export function pageNumber(value: unknown) {
  const parsed = pagination.safeParse({
    page: typeof value === 'string' ? value : undefined,
  });
  return parsed.success ? parsed.data.page : 1;
}
export const orderHref = (id: string) => '/account/orders/' + id;
export const dateTime = new Intl.DateTimeFormat('vi-VN', {
  dateStyle: 'medium',
  timeStyle: 'short',
});
