'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useApiClient } from '../../lib/api/browser';
import { cartReady, cartSubtotal, type Cart } from '../../lib/customer';
import { queryKeys } from '../../lib/query';
import { t } from '../../lib/i18n';
import { ProductImage } from '../catalogue/product-image';
import { ConfirmDialog } from '../common/confirm-dialog';
import { QuantityInput } from '../common/quantity-input';
import { EmptyState, LoadingSkeleton } from '../common/states';
import { Price } from '../common/storefront';
import { Button } from '../ui/button';
import { Card } from '../ui/panels';
import { toastApiError } from '../ui/sonner';
import { CustomerError } from './states';

type Change =
  | { kind: 'set'; id: string; quantity: number; version: number }
  | { kind: 'remove'; id: string }
  | { kind: 'clear' };

function CartQuantity({
  item,
  version,
  max,
  busy,
  change,
  edit,
}: {
  item: Cart['items'][number];
  version: number;
  max: number;
  busy: boolean;
  change: (quantity: number, version: number) => void;
  edit: (editing: boolean) => void;
}) {
  const [draft, setDraft] = useState<{ quantity: number; version: number }>();
  useEffect(() => {
    if (!draft || busy) return;
    const timer = setTimeout(() => change(draft.quantity, draft.version), 350);
    return () => clearTimeout(timer);
  }, [busy, change, draft]);
  return (
    <fieldset disabled={busy}>
      <legend className="sr-only">{t('customer', 'quantity')}</legend>
      <QuantityInput
        value={draft?.quantity ?? item.quantity}
        max={max}
        onChange={(quantity) => {
          setDraft(
            quantity === item.quantity
              ? undefined
              : { quantity, version: draft?.version ?? version },
          );
          edit(quantity !== item.quantity);
        }}
      />
    </fieldset>
  );
}

export function CartPageContent({ max }: { max: number }) {
  const api = useApiClient();
  const client = useQueryClient();
  const cart = useQuery({ queryKey: queryKeys.cart, queryFn: api.cart.get });
  const [editing, setEditing] = useState<string>();
  const [revision, setRevision] = useState(0);
  const update = useMutation({
    mutationFn: (change: Change) =>
      change.kind === 'clear'
        ? api.cart.clear()
        : change.kind === 'remove'
          ? api.cart.remove(change.id)
          : api.cart.update(change.id, {
              version: change.version,
              quantity: change.quantity,
            }),
    onMutate: async (change) => {
      await client.cancelQueries({ queryKey: queryKeys.cart });
      const previous = client.getQueryData<Cart>(queryKeys.cart);
      if (previous)
        client.setQueryData<Cart>(queryKeys.cart, {
          ...previous,
          items:
            change.kind === 'clear'
              ? []
              : change.kind === 'remove'
                ? previous.items.filter((item) => item.productId !== change.id)
                : previous.items.map((item) =>
                    item.productId === change.id
                      ? {
                          ...item,
                          quantity: change.quantity,
                          status: 'available',
                        }
                      : item,
                  ),
        });
      return previous;
    },
    onSuccess: (data) => client.setQueryData(queryKeys.cart, data),
    onError: (error, _, previous) => {
      if (previous) client.setQueryData(queryKeys.cart, previous);
      toastApiError(error);
    },
    onSettled: async () => {
      await client.invalidateQueries({ queryKey: queryKeys.cart });
      setRevision((value) => value + 1);
      setEditing(undefined);
    },
  });
  if (cart.isPending) return <LoadingSkeleton />;
  if (cart.isError)
    return (
      <CustomerError error={cart.error} retry={() => void cart.refetch()} />
    );
  const data = cart.data;
  const busy = update.isPending || Boolean(editing);
  if (!data.items.length)
    return (
      <EmptyState
        title={t('customer', 'emptyCart')}
        action={
          <Button asChild>
            <Link href="/products">{t('home', 'explore')}</Link>
          </Button>
        }
      />
    );
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1fr_19rem]">
      <ul className="grid gap-3">
        {data.items.map((item) => {
          const name = item.product?.name ?? t('customer', 'deleted');
          const limit = Math.min(max, Math.floor(item.product?.stock ?? 0));
          return (
            <li key={item.productId}>
              <Card className="flex flex-wrap items-center gap-4">
                <div className="relative size-20 shrink-0 overflow-hidden rounded-control">
                  <ProductImage
                    source={item.product?.images[0]}
                    alt={name}
                    sizes="80px"
                    className="object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  {item.product ? (
                    <Link
                      href={'/products/' + item.productId}
                      className="font-medium hover:underline"
                    >
                      {name}
                    </Link>
                  ) : (
                    <p className="font-medium">{name}</p>
                  )}
                  {item.product && (
                    <p>
                      <Price amount={item.product.price} />
                    </p>
                  )}
                  <p className="text-sm text-muted-foreground">
                    {t('customer', 'quantity')} {item.quantity}
                  </p>
                  {item.status !== 'available' && (
                    <p className="text-sm font-semibold text-destructive">
                      {t('customer', item.status)}
                    </p>
                  )}
                </div>
                {limit > 0 && (
                  <CartQuantity
                    key={`${revision}:${item.productId}`}
                    item={item}
                    version={data.version}
                    max={limit}
                    busy={
                      update.isPending ||
                      Boolean(editing && editing !== item.productId)
                    }
                    edit={(active) =>
                      setEditing(active ? item.productId : undefined)
                    }
                    change={(quantity, version) =>
                      update.mutate({
                        kind: 'set',
                        id: item.productId,
                        version,
                        quantity,
                      })
                    }
                  />
                )}
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    update.mutate({ kind: 'remove', id: item.productId })
                  }
                >
                  {t('customer', 'remove')}
                </Button>
              </Card>
            </li>
          );
        })}
      </ul>
      <Card className="grid gap-3">
        <h2 className="font-medium">{t('customer', 'subtotal')}</h2>
        <Price amount={cartSubtotal(data)} />
        <p className="text-sm text-muted-foreground">{t('customer', 'fees')}</p>
        {!cartReady(data) && (
          <p className="text-sm text-destructive">{t('customer', 'fixCart')}</p>
        )}
        {cartReady(data) && !busy ? (
          <Button asChild>
            <Link href="/checkout">{t('customer', 'checkout')}</Link>
          </Button>
        ) : (
          <Button disabled>{t('customer', 'checkout')}</Button>
        )}
        <ConfirmDialog
          title={t('customer', 'clearCart')}
          description={t('customer', 'clearCartHint')}
          trigger={
            <Button disabled={busy} variant="ghost">
              {t('customer', 'clearCart')}
            </Button>
          }
          onConfirm={() => update.mutate({ kind: 'clear' })}
        />
      </Card>
    </div>
  );
}
