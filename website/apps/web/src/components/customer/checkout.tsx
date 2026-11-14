'use client';
import { useAuth } from '@clerk/nextjs';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';
import { useApiClient } from '../../lib/api/browser';
import { ApiError } from '../../lib/api/transport';
import {
  checkoutIntent,
  intentStorageKey,
  readIntent,
  stripeCheckoutUrl,
  type CheckoutIntent,
} from '../../lib/checkout-intent';
import { cartReady } from '../../lib/customer';
import { t } from '../../lib/i18n';
import { queryKeys } from '../../lib/query';
import { EmptyState, LoadingSkeleton } from '../common/states';
import { Price } from '../common/storefront';
import { Button } from '../ui/button';
import { Card } from '../ui/panels';
import { AddressDialog, AddressLines } from './addresses';
import { CustomerError } from './states';

export function Checkout() {
  const { userId } = useAuth();
  return userId ? (
    <CheckoutSteps key={userId} userId={userId} />
  ) : (
    <LoadingSkeleton variant="form" />
  );
}

function CheckoutSteps({ userId }: { userId: string }) {
  const api = useApiClient();
  const router = useRouter();
  const client = useQueryClient();
  const cart = useQuery({
    queryKey: queryKeys.cart,
    queryFn: api.cart.get,
    staleTime: 0,
  });
  const addresses = useQuery({
    queryKey: queryKeys.addresses,
    queryFn: api.addresses.list,
  });
  const [selected, setSelected] = useState<string>();
  const [intent, setIntent] = useState<CheckoutIntent | null>(null);
  const [stockIssues, setStockIssues] = useState<string[]>([]);
  const defaultAddress =
    addresses.data?.items.find((address) => address.isDefault) ??
    addresses.data?.items[0];
  const addressId =
    addresses.data?.items.find((address) => address.id === selected)?.id ??
    defaultAddress?.id;
  const conflict = async (error: unknown) => {
    if (!(error instanceof ApiError)) return;
    if (
      [
        'CART_CHANGED',
        'INSUFFICIENT_STOCK',
        'PRODUCT_UNAVAILABLE',
        'EMPTY_CART',
      ].includes(error.code)
    ) {
      const latest = await cart.refetch();
      setStockIssues(
        latest.data?.items.flatMap((item) =>
          item.status === 'available'
            ? []
            : [item.product?.name ?? t('customer', 'deleted')],
        ) ?? [],
      );
    }
  };
  const quote = useMutation({
    mutationFn: api.checkout.quote,
    onError: conflict,
  });
  const create = useMutation({
    mutationFn: async (attempt: CheckoutIntent) => {
      localStorage.setItem(intentStorageKey(userId), JSON.stringify(attempt));
      return api.checkout.createSession(attempt.input, attempt.key);
    },
    onSuccess: (session, attempt) => {
      try {
        localStorage.setItem(
          intentStorageKey(userId),
          JSON.stringify({ ...attempt, sessionId: session.id }),
        );
      } catch {
        /* The original attempt is already stored. */
      }
      void client.invalidateQueries({ queryKey: queryKeys.cart });
      const url =
        session.status === 'pending' && !session.requiresReconciliation
          ? stripeCheckoutUrl(session.url)
          : null;
      if (url) location.assign(url);
      else
        router.push(
          '/checkout/return?checkoutId=' + encodeURIComponent(session.id),
        );
    },
    onError: async (error, attempt) => {
      if (
        error instanceof ApiError &&
        [
          'CART_CHANGED',
          'INSUFFICIENT_STOCK',
          'PRODUCT_UNAVAILABLE',
          'EMPTY_CART',
          'ADDRESS_NOT_FOUND',
          'INVALID_ADDRESS',
          'INVALID_QUANTITY',
          'INVALID_TOTAL',
        ].includes(error.code)
      ) {
        try {
          if (readIntent(localStorage, userId)?.key === attempt.key)
            localStorage.removeItem(intentStorageKey(userId));
        } catch {
          /* Storage can be unavailable. */
        }
      }
      await conflict(error);
    },
  });
  // Read storage on demand so hydration has the same initial UI as SSR.
  const resume = () => {
    const saved = readIntent(localStorage, userId);
    if (saved) {
      setIntent(saved);
      create.mutate(saved);
    } else setResumeMissing(true);
  };
  const [resumeMissing, setResumeMissing] = useState(false);
  const cartLink = (
    <Button variant="outline" asChild>
      <Link href="/cart">{t('checkout', 'backCart')}</Link>
    </Button>
  );
  if (cart.isPending || addresses.isPending)
    return <LoadingSkeleton variant="form" />;
  if (cart.isError)
    return (
      <CustomerError error={cart.error} retry={() => void cart.refetch()} />
    );
  if (addresses.isError)
    return (
      <CustomerError
        error={addresses.error}
        retry={() => void addresses.refetch()}
      />
    );
  const quoteMatches =
    quote.variables?.version === cart.data.version &&
    quote.variables?.addressId === addressId;
  const canQuote = cartReady(cart.data);
  const ready = quoteMatches && canQuote ? quote.data : undefined;
  const error = create.error ?? quote.error;
  return (
    <div className="mx-auto grid max-w-3xl gap-5">
      <Card className="grid gap-3">
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={create.isPending || quote.isPending}
            onClick={resume}
          >
            {t('checkout', 'resume')}
          </Button>
          {cartLink}
        </div>
        {resumeMissing && (
          <p role="status" className="text-sm text-muted-foreground">
            {t('checkout', 'noResume')}
          </p>
        )}
        {error != null && (
          <CustomerError
            error={error}
            retry={() => {
              if (create.error && intent && readIntent(localStorage, userId))
                create.mutate(intent);
              else if (addressId && canQuote) {
                create.reset();
                quote.mutate({ addressId, version: cart.data.version });
              } else {
                create.reset();
                quote.reset();
                void cart.refetch();
              }
            }}
          />
        )}
        {stockIssues.length > 0 && (
          <ul className="list-inside list-disc text-sm text-destructive">
            {stockIssues.map((name, index) => (
              <li key={index}>{name}</li>
            ))}
          </ul>
        )}
      </Card>
      {!canQuote ? (
        <EmptyState
          title={t(
            'checkout',
            cart.data.items.length ? 'invalidCart' : 'emptyCart',
          )}
          action={cartLink}
        />
      ) : (
        <>
          <Card className="space-y-4">
            <fieldset
              className="grid gap-3"
              disabled={create.isPending || quote.isPending}
            >
              <legend className="mb-3 text-xl font-bold">
                {t('checkout', 'addressStep')}
              </legend>
              {!addresses.data.items.length && (
                <p>{t('account', 'noAddress')}</p>
              )}
              {addresses.data.items.map((address) => (
                <label
                  key={address.id}
                  className="flex items-start gap-3 rounded-control border border-border p-3"
                >
                  <input
                    type="radio"
                    name="shipping-address"
                    className="mt-1"
                    checked={addressId === address.id}
                    onChange={() => {
                      setSelected(address.id);
                      quote.reset();
                      create.reset();
                      setStockIssues([]);
                    }}
                  />
                  <div>
                    <span className="font-bold">{address.label}</span>
                    <AddressLines value={address} />
                  </div>
                </label>
              ))}
            </fieldset>
            <div className="flex flex-wrap gap-2">
              <AddressDialog
                onCreated={(id) => {
                  setSelected(id);
                  quote.reset();
                  create.reset();
                }}
              />
              <Button
                disabled={
                  !addressId ||
                  !addresses.data.items.some(
                    (address) => address.id === addressId,
                  ) ||
                  quote.isPending ||
                  create.isPending
                }
                onClick={() => {
                  if (addressId) {
                    create.reset();
                    setStockIssues([]);
                    quote.mutate({ addressId, version: cart.data.version });
                  }
                }}
              >
                {t('checkout', 'quote')}
              </Button>
            </div>
          </Card>
          {quote.isPending && <LoadingSkeleton variant="form" />}
          {ready && (
            <Card className="grid gap-4">
              <h2 className="text-xl font-bold">
                {t('checkout', 'reviewStep')}
              </h2>
              <dl className="grid gap-2">
                {(
                  [
                    'subtotalCents',
                    'shippingCents',
                    'taxCents',
                    'totalCents',
                  ] as const
                ).map((key) => (
                  <div key={key} className="flex justify-between gap-3">
                    <dt>{t('checkout', key)}</dt>
                    <dd>
                      <Price
                        amount={ready[key]}
                        unit="cents"
                        currency={ready.currency}
                      />
                    </dd>
                  </div>
                ))}
              </dl>
              <h2 className="text-xl font-bold">{t('checkout', 'payStep')}</h2>
              <Button
                disabled={create.isPending || !addressId}
                className="justify-self-start"
                onClick={() => {
                  if (!addressId) return;
                  const next = checkoutIntent(
                    { addressId, version: cart.data.version },
                    readIntent(localStorage, userId),
                  );
                  setIntent(next);
                  create.mutate(next);
                }}
              >
                {t('checkout', 'pay')}
              </Button>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
