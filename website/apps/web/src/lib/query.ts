import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './api/transport';

export const queryKeys = {
  products: (query?: object) => ['products', query] as const,
  product: (id: string) => ['product', id] as const,
  categories: ['categories'] as const,
  me: ['me'] as const,
  cart: ['cart'] as const,
  wishlist: (query?: object) =>
    query ? (['wishlist', 'list', query] as const) : (['wishlist'] as const),
  wishlistMembership: (id: string) => ['wishlist', 'membership', id] as const,
  wishlistList: () => ['wishlist', 'list'] as const,
  addresses: ['addresses'] as const,
  checkout: (id: string) => ['checkout', id] as const,
  orders: (query?: object) =>
    query ? (['orders', query] as const) : (['orders'] as const),
  order: (id: string) => ['order', id] as const,
  reviews: (id: string) => ['reviews', id] as const,
  notifications: (query?: object) =>
    query ? (['notifications', query] as const) : (['notifications'] as const),
};

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: (count, error) =>
          count < 1 &&
          !(
            error instanceof ApiError &&
            error.status >= 400 &&
            error.status < 500
          ),
      },
      mutations: { retry: false },
    },
  });
}
