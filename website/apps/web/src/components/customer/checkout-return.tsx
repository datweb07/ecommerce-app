'use client';
import { useAuth } from '@clerk/nextjs';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useApiClient } from '../../lib/api/browser';
import {
  checkoutPollInterval,
  intentStorageKey,
  readIntent,
  stripeCheckoutUrl,
} from '../../lib/checkout-intent';
import { orderHref } from '../../lib/customer';
import { t } from '../../lib/i18n';
import { queryKeys } from '../../lib/query';
import { EmptyState, LoadingSkeleton } from '../common/states';
import { StatusBadge } from '../common/storefront';
import { Button } from '../ui/button';
import { Card } from '../ui/panels';
import { CustomerError } from './states';

export function CheckoutReturn({ id }: { id: string }) {
  const { userId } = useAuth();
  return userId ? (
    <ReturnSession key={id + userId} id={id} userId={userId} />
  ) : (
    <LoadingSkeleton />
  );
}
function ReturnSession({ id, userId }: { id: string; userId: string }) {
  const api = useApiClient();
  const client = useQueryClient();
  const [started, setStarted] = useState(() => Date.now());
  const [timedOut, setTimedOut] = useState(false);
  const query = useQuery({
    queryKey: queryKeys.checkout(id),
    queryFn: () => api.checkout.session(id),
    staleTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
    refetchInterval: ({ state }) =>
      state.data?.status === 'pending' && !state.data.requiresReconciliation
        ? checkoutPollInterval(state.dataUpdateCount - 1, Date.now() - started)
        : false,
  });
  const session = query.data;
  const status = session?.status;
  const terminal =
    session && (session.status !== 'pending' || session.requiresReconciliation);
  useEffect(() => {
    const timer = setTimeout(() => setTimedOut(true), 90_000);
    return () => clearTimeout(timer);
  }, [started]);
  useEffect(() => {
    if (!terminal) return;
    if (status === 'paid') {
      void client.invalidateQueries({ queryKey: queryKeys.cart });
      void client.invalidateQueries({ queryKey: queryKeys.orders() });
      void client.invalidateQueries({ queryKey: queryKeys.notifications() });
    }
  }, [client, terminal, status]);
  const retry = () => {
    setStarted(Date.now());
    setTimedOut(false);
    void query.refetch();
  };
  const back = (
    <Button asChild variant="outline">
      <Link href="/cart">{t('checkout', 'backCart')}</Link>
    </Button>
  );
  if (query.isPending) return <LoadingSkeleton />;
  if (query.isError) return <CustomerError error={query.error} retry={retry} />;
  if (!session)
    return <EmptyState title={t('checkout', 'missing')} action={back} />;
  const hosted = stripeCheckoutUrl(session.url);
  const message = session.requiresReconciliation
    ? 'reconcile'
    : session.status === 'pending' && timedOut
      ? 'timeout'
      : session.status;
  const retryCheckout = () => {
    try {
      if (readIntent(localStorage, userId)?.sessionId === id)
        localStorage.removeItem(intentStorageKey(userId));
    } catch {
      /* Link still works without storage. */
    }
  };
  return (
    <Card className="mx-auto grid max-w-2xl justify-items-start gap-4">
      {!session.requiresReconciliation && (
        <StatusBadge kind="checkout" status={session.status} />
      )}
      <p role="status" className="font-semibold">
        {t('checkout', message)}
      </p>
      <p className="text-sm break-all text-muted-foreground">
        {t('checkout', 'reference')} {session.id}
      </p>
      <div className="flex flex-wrap gap-2">
        {!session.requiresReconciliation &&
          session.status === 'paid' &&
          session.orderId && (
            <Button asChild>
              <Link href={orderHref(session.orderId)}>
                {t('checkout', 'viewOrder')}
              </Link>
            </Button>
          )}
        {!terminal && hosted && (
          <Button asChild>
            <a href={hosted}>{t('checkout', 'continueStripe')}</a>
          </Button>
        )}
        {!terminal && (
          <Button variant="outline" disabled={query.isFetching} onClick={retry}>
            {t('common', 'retry')}
          </Button>
        )}
        {!session.requiresReconciliation &&
          ['expired', 'failed'].includes(session.status) && (
            <Button asChild>
              <Link href="/checkout" onClick={retryCheckout}>
                {t('checkout', 'retryPayment')}
              </Link>
            </Button>
          )}
        {back}
      </div>
    </Card>
  );
}
