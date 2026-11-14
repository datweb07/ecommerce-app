'use client';
import { useAuth } from '@clerk/nextjs';
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useApiClient } from '../../lib/api/browser';
import { dateTime, orderHref } from '../../lib/customer';
import { queryKeys, inboxPollMs } from '../../lib/query';
import { t } from '../../lib/i18n';
import { EmptyState, LoadingSkeleton } from '../common/states';
import { Button } from '../ui/button';
import { Badge, Card } from '../ui/panels';
import { toastApiError } from '../ui/sonner';
import { CustomerError } from './states';

export function Inbox() {
  const { userId } = useAuth();
  const api = useApiClient();
  const router = useRouter();
  const client = useQueryClient();
  const query = useInfiniteQuery({
    queryKey: queryKeys.inbox(),
    enabled: Boolean(userId),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      api.notifications.list(pageParam ? { cursor: pageParam } : {}),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    refetchInterval: inboxPollMs,
    refetchIntervalInBackground: false,
  });
  const invalidate = () =>
    client.invalidateQueries({ queryKey: queryKeys.notifications() });
  const change = useMutation({
    mutationFn: async (target: { id: string; orderId: string } | null) => {
      if (target) await api.notifications.markRead(target.id);
      else await api.notifications.markAllRead();
    },
    onSuccess: async (_, target) => {
      await invalidate();
      if (target) router.push(orderHref(target.orderId));
    },
    onError: toastApiError,
  });
  if (query.isPending) return <LoadingSkeleton />;
  if (query.isError && !query.data)
    return (
      <CustomerError error={query.error} retry={() => void query.refetch()} />
    );
  const pages = query.data?.pages ?? [];
  const items = Array.from(
    new Map(
      pages.flatMap((page) =>
        page.items.map((item) => [item.id, item] as const),
      ),
    ).values(),
  );
  const unread = pages[0]?.unreadCount ?? 0;
  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted-foreground">{t('inbox', 'hint')}</p>
      {query.isError && (
        <CustomerError error={query.error} retry={() => void query.refetch()} />
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p aria-live="polite">
          {unread} {t('inbox', 'unread')}
        </p>
        <Button
          variant="outline"
          disabled={change.isPending || unread === 0}
          onClick={() => change.mutate(null)}
        >
          {t('inbox', 'readAll')}
        </Button>
      </div>
      {!items.length && <EmptyState title={t('inbox', 'empty')} />}
      <ul className="grid gap-3">
        {items.map((item) => (
          <li key={item.id}>
            <Card className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <p className="font-bold">
                  {t('inbox', item.status)}{' '}
                  {!item.readAt && (
                    <Badge className="bg-primary text-primary-foreground">
                      {t('inbox', 'new')}
                    </Badge>
                  )}
                </p>
                <p className="text-sm break-all text-muted-foreground">
                  #{item.orderId}
                </p>
                <time
                  className="text-sm text-muted-foreground"
                  dateTime={item.occurredAt}
                >
                  {dateTime.format(new Date(item.occurredAt))}
                </time>
              </div>
              {item.readAt ? (
                <Button variant="outline" asChild>
                  <Link href={orderHref(item.orderId)}>
                    {t('checkout', 'viewOrder')}
                  </Link>
                </Button>
              ) : (
                <Button
                  variant="outline"
                  disabled={change.isPending}
                  onClick={() =>
                    change.mutate({ id: item.id, orderId: item.orderId })
                  }
                >
                  {t('inbox', 'readAndView')}
                </Button>
              )}
            </Card>
          </li>
        ))}
      </ul>
      {query.hasNextPage && (
        <Button
          className="justify-self-start"
          variant="outline"
          disabled={query.isFetching}
          onClick={() => void query.fetchNextPage()}
        >
          {t('inbox', 'more')}
        </Button>
      )}
    </div>
  );
}
