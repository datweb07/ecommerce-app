'use client';
import type { orderDto } from '@storefront/shared';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import type { z } from 'zod';
import { useApiClient } from '../../lib/api/browser';
import { ApiError } from '../../lib/api/transport';
import { boundedPageCount } from '../../lib/catalogue-query';
import { dateTime, orderHref } from '../../lib/customer';
import { t } from '../../lib/i18n';
import { queryKeys } from '../../lib/query';
import { ProductImage } from '../catalogue/product-image';
import { EmptyState, LoadingSkeleton } from '../common/states';
import { Price, StatusBadge } from '../common/storefront';
import { Pagination } from '../ui/pagination';
import { Card } from '../ui/panels';
import { AddressLines } from './addresses';
import { CustomerError } from './states';
import { ReviewEditor } from './review-editor';

export type Order = z.infer<typeof orderDto>;
function DateLabel({ date }: { date: string | null }) {
  return date ? (
    <time dateTime={date}>{dateTime.format(new Date(date))}</time>
  ) : (
    <span>{t('orders', 'unknownDate')}</span>
  );
}
export function Orders({ page }: { page: number }) {
  const api = useApiClient();
  const filters = { page: String(page) };
  const query = useQuery({
    queryKey: queryKeys.orders(filters),
    queryFn: () => api.orders.list(filters),
  });
  if (query.isPending) return <LoadingSkeleton />;
  if (query.isError)
    return (
      <CustomerError error={query.error} retry={() => void query.refetch()} />
    );
  return (
    <div className="grid gap-4">
      {query.data.items.length ? (
        <ul className="grid gap-3">
          {query.data.items.map((order) => (
            <li key={order.id}>
              <Card className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <Link
                    href={orderHref(order.id)}
                    className="font-bold break-all hover:underline"
                  >
                    #{order.id}
                  </Link>
                  <p className="text-sm text-muted-foreground">
                    <DateLabel date={order.createdAt} />
                  </p>
                </div>
                <StatusBadge kind="order" status={order.status} />
                <Price amount={order.totalPrice} />
              </Card>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          title={t('orders', 'empty')}
          action={
            page > 1 ? (
              <Link className="underline" href="/account/orders">
                {t('customer', 'firstPage')}
              </Link>
            ) : null
          }
        />
      )}
      <Pagination
        pathname="/account/orders"
        page={page}
        totalPages={boundedPageCount(query.data.total, query.data.limit)}
      />
    </div>
  );
}
export function OrderDetail({
  id,
  initial,
}: {
  id: string;
  initial?: Order | undefined;
}) {
  const api = useApiClient();
  const query = useQuery({
    queryKey: queryKeys.order(id),
    queryFn: () => api.orders.detail(id),
    ...(initial ? { initialData: initial } : {}),
  });
  if (query.isPending) return <LoadingSkeleton />;
  if (query.isError) {
    if (query.error instanceof ApiError && query.error.status === 404)
      return (
        <EmptyState
          title={t('orders', 'missing')}
          action={
            <Link className="underline" href="/account/orders">
              {t('account', 'orders')}
            </Link>
          }
        />
      );
    return (
      <CustomerError error={query.error} retry={() => void query.refetch()} />
    );
  }
  return <OrderSnapshot order={query.data} />;
}
export function OrderSnapshot({ order }: { order: Order }) {
  const timeline = [
    ['pending', order.createdAt],
    ['shipped', order.shippedAt],
    ['delivered', order.deliveredAt],
  ] as const;
  const current = timeline.findIndex(([state]) => state === order.status);
  return (
    <div className="grid gap-4">
      <Card className="grid gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-bold break-all">#{order.id}</h2>
          <StatusBadge kind="order" status={order.status} />
        </div>
        <ol className="grid gap-2 md:grid-cols-3">
          {timeline.map(([status, date], index) => (
            <li
              key={status}
              aria-current={status === order.status ? 'step' : undefined}
              className="grid gap-1 rounded-control border border-border p-3 text-sm"
            >
              <StatusBadge kind="order" status={status} />
              {index <= current ? (
                <DateLabel date={date} />
              ) : (
                <span>{t('orders', 'waiting')}</span>
              )}
            </li>
          ))}
        </ol>
      </Card>
      <Card className="grid gap-3">
        <h2 className="font-bold">{t('orders', 'shipping')}</h2>
        <AddressLines value={order.shippingAddress} />
      </Card>
      <Card className="grid gap-3">
        <h2 className="font-bold">{t('nav', 'products')}</h2>
        <ul className="divide-y divide-border">
          {order.items.map((item, index) => (
            <li key={item.productId + index} className="grid gap-3 py-3">
              <div className="flex items-start gap-3">
                <div className="relative size-16 shrink-0 overflow-hidden rounded-control">
                  <ProductImage
                    source={item.image}
                    alt={item.name}
                    sizes="64px"
                    className="object-cover"
                  />
                </div>
                <div className="min-w-0 space-y-1">
                  <p className="font-bold wrap-anywhere">{item.name}</p>
                  <p>
                    <Price amount={item.price} /> × {item.quantity}
                  </p>
                </div>
              </div>
              {(item.canReview || item.review) && (
                <ReviewEditor orderId={order.id} item={item} />
              )}
            </li>
          ))}
        </ul>
        <dl>
          <div className="flex justify-between gap-3 border-t border-border pt-3">
            <dt className="font-bold">{t('checkout', 'totalCents')}</dt>
            <dd>
              <Price amount={order.totalPrice} />
            </dd>
          </div>
        </dl>
      </Card>
    </div>
  );
}
