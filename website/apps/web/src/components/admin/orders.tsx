'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminOrdersQuery, adminOrderPatch } from '@storefront/shared';
import type { z } from 'zod';
import Link from 'next/link';
import { toast } from 'sonner';
import { useApiClient } from '../../lib/api/browser';
import { ApiError } from '../../lib/api/transport';
import { adminDate, adminFilters, adminKey } from '../../lib/admin/query';
import { t } from '../../lib/i18n';
import { formatMoney } from '../../lib/money';
import type { RouteQuery } from '../../lib/url-state';
import { Button } from '../ui/button';
import { toastApiError } from '../ui/sonner';
import { ConfirmDialog } from '../common/confirm-dialog';
import { ProductImage } from '../catalogue/product-image';
import { StatusBadge } from '../common/storefront';
import {
  AdminData,
  AdminFilters,
  AdminPagination,
  AdminTable,
  AdminTitle,
} from './data';

const orderPath = '/admin/orders';
const statuses = [
  ['', t('admin', 'all')],
  ['pending', 'Chờ xử lý'],
  ['shipped', 'Đang giao'],
  ['delivered', 'Đã giao'],
] as const;
type Status = z.infer<typeof adminOrderPatch>['expectedStatus'];
export function nextOrderStatus(status: Status) {
  if (status === 'pending') return 'shipped';
  if (status === 'shipped') return 'delivered';
  return null;
}

export function AdminOrders({ search }: { search: RouteQuery }) {
  const filters = adminFilters(adminOrdersQuery, search, [
    'page',
    'limit',
    'q',
    'status',
    'from',
    'to',
  ]);
  const api = useApiClient().admin;
  const state = useQuery({
    queryKey: adminKey('orders', filters),
    queryFn: () => api.orders(filters),
  });
  return (
    <>
      <AdminTitle title={t('admin', 'orders')} />
      <AdminFilters
        path={orderPath}
        values={filters}
        key={JSON.stringify(filters)}
        fields={[
          { name: 'q', label: t('admin', 'orderSearch') },
          { name: 'status', label: t('admin', 'status'), options: statuses },
          { name: 'from', label: t('admin', 'from'), type: 'date' },
          { name: 'to', label: t('admin', 'to'), type: 'date' },
        ]}
      />
      <AdminData result={state}>
        {(data) => (
          <>
            <AdminTable
              label={t('admin', 'orders')}
              rows={data.items}
              columns={[
                {
                  label: t('admin', 'orderCode'),
                  cell: (row) => (
                    <Link
                      href={orderPath + '/' + row.id}
                      className="underline underline-offset-4"
                    >
                      {row.id}
                    </Link>
                  ),
                },
                {
                  label: t('admin', 'date'),
                  cell: (row) => adminDate(row.createdAt, true),
                },
                {
                  label: t('admin', 'status'),
                  cell: (row) => (
                    <StatusBadge kind="order" status={row.status} />
                  ),
                },
                {
                  label: t('admin', 'quantity'),
                  cell: (row) => row.itemCount,
                  numeric: true,
                },
                {
                  label: t('admin', 'total'),
                  cell: (row) => formatMoney(row.totalPrice),
                  numeric: true,
                },
              ]}
            />
            <AdminPagination data={data} filters={filters} path={orderPath} />
          </>
        )}
      </AdminData>
    </>
  );
}

export function AdminOrderDetail({ id }: { id: string }) {
  const api = useApiClient().admin;
  const queryClient = useQueryClient();
  const key = adminKey('order', id);
  const info = useQuery({ queryKey: key, queryFn: () => api.order(id) });
  const mutation = useMutation({
    mutationFn: (body: z.input<typeof adminOrderPatch>) =>
      api.orderStatus(id, body),
    onSuccess: async (order) => {
      queryClient.setQueryData(key, (previous: typeof info.data) =>
        previous ? { ...previous, ...order } : previous,
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: adminKey('orders') }),
        queryClient.invalidateQueries({ queryKey: adminKey('stats') }),
      ]);
      toast.success(t('admin', 'saved'));
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 409) {
        toast.error(t('admin', 'orderConflict'));
        void info.refetch();
      } else toastApiError(error);
    },
  });
  return (
    <>
      <AdminTitle
        title={t('admin', 'orderDetail')}
        description={id}
        action={
          <Button asChild variant="outline">
            <Link href={orderPath}>{t('admin', 'orders')}</Link>
          </Button>
        }
      />
      <AdminData result={info}>
        {(order) => {
          const next = nextOrderStatus(order.status);
          const action =
            next === 'shipped' ? t('admin', 'ship') : t('admin', 'deliver');
          return (
            <div className="space-y-8">
              <div className="flex flex-wrap items-center justify-between gap-5">
                <StatusBadge kind="order" status={order.status} />
                {next && (
                  <ConfirmDialog
                    title={t('admin', 'statusConfirm')}
                    description={t('admin', 'statusHint')}
                    confirmLabel={action}
                    trigger={
                      <Button disabled={mutation.isPending}>{action}</Button>
                    }
                    onConfirm={() => {
                      if (!mutation.isPending)
                        mutation.mutate({
                          expectedStatus: order.status,
                          status: next,
                        });
                    }}
                  />
                )}
              </div>
              <div className="grid gap-6 border-b border-border pb-6 md:grid-cols-3">
                <section className="space-y-2">
                  <h2 className="text-heading font-medium">
                    {t('admin', 'shipping')}
                  </h2>
                  <address className="text-sm leading-relaxed text-muted-foreground not-italic">
                    {order.shippingAddress.fullName}
                    <br />
                    {order.shippingAddress.streetAddress}
                    <br />
                    {order.shippingAddress.city}, {order.shippingAddress.state}{' '}
                    {order.shippingAddress.zipCode}
                    <br />
                    {order.shippingAddress.phoneNumber}
                  </address>
                </section>
                <section className="space-y-2">
                  <h2 className="text-heading font-medium">
                    {t('admin', 'customer')}
                  </h2>
                  {order.customer ? (
                    <p className="text-sm break-all text-muted-foreground">
                      {order.customer.name}
                      <br />
                      {order.customer.email}
                    </p>
                  ) : (
                    <p>—</p>
                  )}
                  <p className="text-sm">
                    {t('admin', 'payment')} · {order.paymentReference ?? '—'}
                  </p>
                </section>
                <section className="space-y-2">
                  <h2 className="text-heading font-medium">
                    {t('admin', 'timeline')}
                  </h2>
                  <ol>
                    {(
                      [
                        ['pending', order.createdAt],
                        ['shipped', order.shippedAt],
                        ['delivered', order.deliveredAt],
                      ] as const
                    ).map(([status, date]) => (
                      <li
                        className="flex justify-between gap-2 border-b border-border py-2 text-sm"
                        key={status}
                      >
                        <StatusBadge kind="order" status={status} />
                        <span>{adminDate(date, true)}</span>
                      </li>
                    ))}
                  </ol>
                </section>
              </div>
              <section className="space-y-3">
                <h2 className="text-heading font-medium">
                  {t('admin', 'items')}
                </h2>
                <AdminTable
                  label={t('admin', 'items')}
                  rows={order.items.map((item, index) => ({
                    ...item,
                    id: item.productId + '-' + index,
                  }))}
                  columns={[
                    {
                      label: t('admin', 'product'),
                      cell: (row) => (
                        <div className="flex items-center gap-3">
                          <span className="relative block size-12 shrink-0">
                            <ProductImage
                              source={row.image}
                              sizes="48px"
                              alt=""
                              className="object-cover"
                            />
                          </span>
                          {row.name}
                        </div>
                      ),
                    },
                    {
                      label: t('admin', 'price'),
                      cell: (row) => formatMoney(row.price),
                      numeric: true,
                    },
                    {
                      label: t('admin', 'quantity'),
                      cell: (row) => row.quantity,
                      numeric: true,
                    },
                  ]}
                />
                <p className="text-right text-heading font-medium">
                  {t('admin', 'total')} · {formatMoney(order.totalPrice)}
                </p>
              </section>
            </div>
          );
        }}
      </AdminData>
    </>
  );
}
