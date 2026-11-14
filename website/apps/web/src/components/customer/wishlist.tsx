'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { productListDto } from '@storefront/shared';
import type { z } from 'zod';
import Link from 'next/link';
import { toast } from 'sonner';
import { useApiClient } from '../../lib/api/browser';
import { boundedPageCount } from '../../lib/catalogue-query';
import { queryKeys } from '../../lib/query';
import { t } from '../../lib/i18n';
import { ProductCard } from '../common/storefront';
import { EmptyState, LoadingSkeleton } from '../common/states';
import { Button } from '../ui/button';
import { Pagination } from '../ui/pagination';
import { toastApiError } from '../ui/sonner';
import { CustomerError } from './states';

type Wishlist = z.infer<typeof productListDto>;
export function WishlistContent({ page }: { page: number }) {
  const api = useApiClient();
  const client = useQueryClient();
  const filters = { page: String(page) };
  const key = queryKeys.wishlist(filters);
  const query = useQuery({
    queryKey: key,
    queryFn: () => api.wishlist.list(filters),
  });
  const remove = useMutation({
    mutationFn: api.wishlist.remove,
    onMutate: async (id) => {
      await client.cancelQueries({ queryKey: queryKeys.wishlist() });
      const previous = client.getQueriesData<Wishlist>({
        queryKey: queryKeys.wishlistList(),
      });
      client.setQueryData<Wishlist>(
        key,
        (data) =>
          data && {
            ...data,
            items: data.items.filter((item) => item.id !== id),
            total: Math.max(0, data.total - 1),
          },
      );
      return previous;
    },
    onError: (error, _, previous) => {
      previous?.forEach(([queryKey, data]) =>
        client.setQueryData(queryKey, data),
      );
      toastApiError(error);
    },
    onSuccess: (_, id) => {
      client.setQueryData(queryKeys.wishlistMembership(id), false);
    },
    onSettled: () =>
      client.invalidateQueries({ queryKey: queryKeys.wishlistList() }),
  });
  const add = useMutation({
    mutationFn: (productId: string) => api.cart.add({ productId, quantity: 1 }),
    onSuccess: (data) => {
      client.setQueryData(queryKeys.cart, data);
      toast.success(t('detail', 'added'));
    },
    onError: toastApiError,
    onSettled: () => client.invalidateQueries({ queryKey: queryKeys.cart }),
  });
  if (query.isPending) return <LoadingSkeleton variant="card" />;
  if (query.isError)
    return (
      <CustomerError error={query.error} retry={() => void query.refetch()} />
    );
  const { items, total, limit } = query.data;
  return (
    <div className="space-y-5">
      {!items.length && (
        <EmptyState
          title={t('customer', 'emptyWishlist')}
          action={
            <Button asChild>
              <Link href={page > 1 ? '/wishlist' : '/products'}>
                {page > 1 ? t('customer', 'firstPage') : t('home', 'explore')}
              </Link>
            </Button>
          }
        />
      )}
      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {items.map((item) => (
          <li key={item.id} className="flex min-w-0 flex-col gap-2">
            <ProductCard
              id={item.id}
              name={item.name}
              price={item.price}
              image={item.images[0]}
              stock={item.stock}
            />
            <Button
              disabled={add.isPending || remove.isPending || item.stock < 1}
              onClick={() => add.mutate(item.id)}
            >
              {t('detail', 'addCart')}
            </Button>
            <Button
              variant="outline"
              disabled={add.isPending || remove.isPending}
              onClick={() => remove.mutate(item.id)}
            >
              {t('customer', 'removeWishlist')}
            </Button>
          </li>
        ))}
      </ul>
      <Pagination
        pathname="/wishlist"
        page={page}
        totalPages={boundedPageCount(total, limit)}
      />
    </div>
  );
}
