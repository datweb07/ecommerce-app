import * as shared from '@storefront/shared';
import type { z } from 'zod';
import type { ApiOptions, ApiRequest } from './transport';

export type ProductFilters = z.input<typeof shared.productQuery>;
export type PageFilters = z.input<typeof shared.pagination>;
export type InboxFilters = z.input<typeof shared.notificationQuery>;
type Input<T extends z.ZodType> = z.input<T>;
const id = (value: string) => {
  // Encode dot-only values as a single invalid ObjectId without URL normalization.
  return value === '.' || value === '..' ? '%20' : encodeURIComponent(value);
};
const catalogue = { revalidate: 60, tags: ['catalogue'] };

export function createApi(request: ApiRequest) {
  const call = <S extends z.ZodType>(
    path: string,
    schema: S,
    options: Omit<ApiOptions<S>, 'schema'> = {},
  ) => request('/api/v1' + path, { ...options, schema });
  const read = <S extends z.ZodType>(
    path: string,
    schema: S,
    query?: ApiOptions<S>['query'],
  ) => call(path, schema, { private: true, query });
  const write = <S extends z.ZodType>(
    method: ApiOptions<S>['method'],
    path: string,
    schema: S,
    body?: unknown,
    idempotencyKey?: string,
  ) => call(path, schema, { method, private: true, body, idempotencyKey });
  return {
    products: {
      list: (query: ProductFilters = {}) =>
        call('/products', shared.productListDto, { query, next: catalogue }),
      detail: (value: string) =>
        call(`/products/${id(value)}`, shared.productDto, { next: catalogue }),
      related: (value: string) =>
        call(`/products/${id(value)}/related`, shared.relatedDto, {
          next: catalogue,
        }),
      reviews: (value: string, query: PageFilters = {}) =>
        call(`/products/${id(value)}/reviews`, shared.publicReviewsDto, {
          query,
          next: catalogue,
        }),
    },
    categories: {
      list: () =>
        call('/categories', shared.categoryListDto, {
          next: { revalidate: 60, tags: ['catalogue', 'categories'] },
        }),
    },
    me: {
      get: () => read('/me', shared.profileDto),
      update: (body: Input<typeof shared.profilePatch>) =>
        write('PATCH', '/me', shared.profileDto, body),
    },
    cart: {
      get: () => read('/cart', shared.cartDto),
      add: (body: Input<typeof shared.cartAdd>) =>
        write('POST', '/cart/items', shared.cartDto, body),
      update: (productId: string, body: Input<typeof shared.cartPatch>) =>
        write('PATCH', `/cart/items/${id(productId)}`, shared.cartDto, body),
      remove: (productId: string) =>
        write('DELETE', `/cart/items/${id(productId)}`, shared.cartDto),
      clear: () => write('DELETE', '/cart', shared.cartDto),
    },
    wishlist: {
      list: (query: PageFilters = {}) =>
        read('/wishlist', shared.productListDto, query),
      add: (productId: string) =>
        write('PUT', `/wishlist/${id(productId)}`, shared.acknowledgement),
      remove: (productId: string) =>
        write('DELETE', `/wishlist/${id(productId)}`, shared.acknowledgement),
    },
    addresses: {
      list: () => read('/addresses', shared.addressListDto),
      add: (body: Input<typeof shared.addressCreate>) =>
        write('POST', '/addresses', shared.addressListDto, body),
      update: (value: string, body: Input<typeof shared.addressPatch>) =>
        write('PATCH', `/addresses/${id(value)}`, shared.addressListDto, body),
      remove: (value: string) =>
        write('DELETE', `/addresses/${id(value)}`, shared.addressListDto),
    },
    checkout: {
      quote: (body: Input<typeof shared.checkoutInput>) =>
        write('POST', '/checkout/quote', shared.checkoutQuote, body),
      createSession: (body: Input<typeof shared.checkoutInput>, key: string) =>
        write('POST', '/checkout/sessions', shared.checkoutStatus, body, key),
      session: (value: string) =>
        read(`/checkout/sessions/${id(value)}`, shared.checkoutStatus),
    },
    orders: {
      list: (query: PageFilters = {}) =>
        read('/orders', shared.orderListDto, query),
      detail: (value: string) => read(`/orders/${id(value)}`, shared.orderDto),
    },
    reviews: {
      add: (body: Input<typeof shared.reviewCreate>) =>
        write('POST', '/reviews', shared.ownReviewDto, body),
      update: (value: string, body: Input<typeof shared.reviewPatch>) =>
        write('PATCH', `/reviews/${id(value)}`, shared.ownReviewDto, body),
      remove: (value: string) =>
        write('DELETE', `/reviews/${id(value)}`, shared.acknowledgement),
    },
    notifications: {
      list: (query: InboxFilters = {}) =>
        read('/notifications', shared.notificationInbox, query),
      markRead: (value: string) =>
        write(
          'PATCH',
          `/notifications/${id(value)}/read`,
          shared.notificationDto,
        ),
      markAllRead: () =>
        write('POST', '/notifications/read-all', shared.notificationReadAllDto),
    },
  };
}
