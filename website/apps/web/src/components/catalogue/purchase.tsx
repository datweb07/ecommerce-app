'use client';
import { useAuth } from '@clerk/nextjs';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Heart, ShoppingCart } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import type { cartDto } from '@storefront/shared';
import type { z } from 'zod';
import { publicEnv } from '../../config/public-env';
import { useApiClient } from '../../lib/api/browser';
import { ApiError } from '../../lib/api/transport';
import { signInUrl } from '../../lib/auth-paths';
import { boundedPageCount } from '../../lib/catalogue-query';
import { t } from '../../lib/i18n';
import { queryKeys } from '../../lib/query';
import { QuantityInput } from '../common/quantity-input';
import { Button } from '../ui/button';
import { toastApiError } from '../ui/sonner';
import type { Product } from './product-grid';

type Props = { product: Product; cartMax: number };
type Cart = z.infer<typeof cartDto>;

export function signInForProduct() {
  return signInUrl(location.origin, location.pathname + location.search);
}
function GuestPurchase(props: Props) {
  const [quantity, setQuantity] = useState(1);
  const signIn = () => location.assign(signInForProduct());
  return (
    <PurchaseControls
      {...props}
      quantity={quantity}
      setQuantity={setQuantity}
      add={signIn}
      wish={signIn}
    />
  );
}

export function PurchaseControls({
  product,
  cartMax,
  quantity,
  setQuantity,
  add,
  wish,
  saved = false,
  cartPending = false,
  wishPending = false,
  disabled = false,
  retryWish,
}: Props & {
  quantity: number;
  setQuantity: (value: number) => void;
  add: () => void;
  wish: () => void;
  saved?: boolean;
  cartPending?: boolean;
  wishPending?: boolean;
  disabled?: boolean;
  retryWish?: () => void;
}) {
  const max = Math.max(0, Math.min(cartMax, Math.floor(product.stock)));
  return (
    <div className="space-y-4">
      {max > 0 && !disabled && (
        <QuantityInput
          value={Math.min(quantity, max)}
          onChange={setQuantity}
          max={max}
        />
      )}
      <div className="flex flex-wrap gap-2">
        <Button disabled={max === 0 || cartPending || disabled} onClick={add}>
          <ShoppingCart size={18} aria-hidden="true" />
          {t('detail', cartPending ? 'adding' : 'addCart')}
        </Button>
        <Button
          variant="outline"
          aria-pressed={saved}
          disabled={wishPending || disabled}
          onClick={wish}
        >
          <Heart
            size={18}
            aria-hidden="true"
            fill={saved ? 'currentColor' : 'none'}
          />
          {t('detail', saved ? 'saved' : 'save')}
        </Button>
        {retryWish && (
          <Button variant="ghost" onClick={retryWish}>
            {t('detail', 'retryWish')}
          </Button>
        )}
      </div>
    </div>
  );
}

function AuthenticatedPurchase({ product, cartMax }: Props) {
  const api = useApiClient();
  const client = useQueryClient();
  const [quantity, setQuantity] = useState(1);
  const wishKey = queryKeys.wishlistMembership(product.id);
  const wishQuery = useQuery({
    queryKey: wishKey,
    queryFn: async ({ signal }) => {
      const limit = 100;
      for (let page = 1; ; page++) {
        signal.throwIfAborted();
        const result = await api.wishlist.list({
          page: String(page),
          limit: String(limit),
        });
        if (result.items.some((item) => item.id === product.id)) return true;
        if (page * limit >= result.total) return false;
        if (page >= boundedPageCount(result.total, limit)) {
          throw new ApiError(
            400,
            'WISHLIST_RANGE',
            'Wishlist exceeds the supported offset.',
          );
        }
      }
    },
  });
  const addCart = useMutation({
    mutationFn: (count: number) =>
      api.cart.add({ productId: product.id, quantity: count }),
    onMutate: async (count) => {
      await client.cancelQueries({ queryKey: queryKeys.cart });
      const previous = client.getQueryData<Cart>(queryKeys.cart);
      if (previous) {
        const existing = previous.items.find(
          (item) => item.productId === product.id,
        );
        const item = {
          productId: product.id,
          product,
          quantity: (existing?.quantity ?? 0) + count,
          status: 'available' as const,
        };
        client.setQueryData<Cart>(queryKeys.cart, {
          ...previous,
          items: existing
            ? previous.items.map((row) =>
                row.productId === product.id ? item : row,
              )
            : [...previous.items, item],
        });
      }
      return previous;
    },
    onSuccess: (cart) => {
      client.setQueryData(queryKeys.cart, cart);
      toast.success(t('detail', 'added'));
    },
    onError: (error, _count, previous) => {
      if (previous) client.setQueryData(queryKeys.cart, previous);
      toastApiError(error);
    },
    onSettled: () => client.invalidateQueries({ queryKey: queryKeys.cart }),
  });
  const wish = useMutation({
    mutationFn: (save: boolean) =>
      save ? api.wishlist.add(product.id) : api.wishlist.remove(product.id),
    onMutate: async (save) => {
      await client.cancelQueries({ queryKey: wishKey });
      const previous = client.getQueryData<boolean>(wishKey);
      client.setQueryData(wishKey, save);
      return previous;
    },
    onError: (error, _save, previous) => {
      client.setQueryData(wishKey, previous ?? false);
      toastApiError(error);
    },
    onSettled: () =>
      client.invalidateQueries({ queryKey: [...queryKeys.wishlist(), 'list'] }),
  });
  return (
    <PurchaseControls
      product={product}
      cartMax={cartMax}
      quantity={quantity}
      setQuantity={setQuantity}
      cartPending={addCart.isPending}
      wishPending={wish.isPending || wishQuery.data === undefined}
      saved={wishQuery.data ?? false}
      add={() =>
        addCart.mutate(Math.min(quantity, cartMax, Math.floor(product.stock)))
      }
      wish={() => wish.mutate(!wishQuery.data)}
      {...(wishQuery.isError
        ? {
            retryWish: () => {
              void wishQuery.refetch();
            },
          }
        : {})}
    />
  );
}

function ClerkPurchase(props: Props) {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded)
    return (
      <PurchaseControls
        {...props}
        quantity={1}
        setQuantity={() => undefined}
        add={() => undefined}
        wish={() => undefined}
        disabled
      />
    );
  return isSignedIn ? (
    <AuthenticatedPurchase {...props} />
  ) : (
    <GuestPurchase {...props} />
  );
}
export function Purchase(props: Props) {
  return publicEnv.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ? (
    <ClerkPurchase {...props} />
  ) : (
    <GuestPurchase {...props} />
  );
}
