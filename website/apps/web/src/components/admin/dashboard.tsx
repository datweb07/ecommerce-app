'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import type { z } from 'zod';
import type { adminStatsDto } from '@storefront/shared';
import { useApiClient } from '../../lib/api/browser';
import { adminDate, adminKey } from '../../lib/admin/query';
import { formatMoney } from '../../lib/money';
import { StatusBadge } from '../common/storefront';
import { t } from '../../lib/i18n';
import { AdminData, AdminFilters, AdminTable, AdminTitle } from './data';

type Stats = z.infer<typeof adminStatsDto>;
type Range = Stats['range'];
const ranges: ReadonlyArray<readonly [Range, string]> = [
  ['7d', '7 ngày'],
  ['30d', '30 ngày'],
  ['90d', '90 ngày'],
];

function RevenueChart({ days }: { days: Stats['revenueByDay'] }) {
  const peak = Math.max(1, ...days.map(({ revenue }) => revenue));
  const points = days.map(
    ({ revenue }, index) =>
      [
        (index / Math.max(1, days.length - 1)) * 600,
        120 - (revenue / peak) * 104,
      ] as const,
  );
  return (
    <section className="space-y-4 border-b border-border pb-6">
      <h2 className="text-heading font-medium">{t('admin', 'revenueByDay')}</h2>
      <svg
        role="img"
        aria-label={t('admin', 'revenueByDay')}
        viewBox="0 0 600 128"
        className="h-32 w-full text-foreground sm:h-44"
        preserveAspectRatio="none"
      >
        <line
          x1="0"
          x2="600"
          y1="121"
          y2="121"
          stroke="var(--control-border)"
        />
        <polyline
          points={points.map((point) => point.join(',')).join(' ')}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <details className="text-sm">
        <summary className="cursor-pointer underline underline-offset-4">
          {t('admin', 'showChartData')}
        </summary>
        <dl className="mt-3 grid gap-x-8 sm:grid-cols-2">
          {days.map(({ date, revenue }) => (
            <div
              key={date}
              className="flex justify-between border-b border-border py-2"
            >
              <dt>{adminDate(date)}</dt>
              <dd>{formatMoney(revenue)}</dd>
            </div>
          ))}
        </dl>
      </details>
    </section>
  );
}

export function Dashboard({ range }: { range: Range }) {
  const api = useApiClient().admin;
  const stats = useQuery({
    queryKey: adminKey('stats', range),
    queryFn: () => api.stats({ range }),
  });
  const orders = useQuery({
    queryKey: adminKey('orders', { limit: '5' }),
    queryFn: () => api.orders({ limit: '5' }),
  });
  const low = useQuery({
    queryKey: adminKey('products', { stockStatus: 'low', limit: '5' }),
    queryFn: () =>
      api.products({ stockStatus: 'low', limit: '5', sort: 'stock' }),
  });
  const reconciliation = useQuery({
    queryKey: adminKey('reconciliation'),
    queryFn: () => api.reconciliation({ limit: '100' }),
  });
  return (
    <>
      <AdminTitle
        title={t('admin', 'dashboard')}
        description={t('admin', 'summaryHint')}
      />
      <AdminFilters
        key={range}
        path="/admin"
        values={{ range }}
        fields={[
          { name: 'range', label: t('admin', 'range'), options: ranges },
        ]}
      />
      <AdminData result={stats} variant="card">
        {(data) => (
          <>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-7 border-b border-border pb-6 sm:grid-cols-4">
              {(
                [
                  ['revenue', formatMoney(data.revenue)],
                  ['orders', data.orderCount],
                  ['customers', data.customerCount],
                  ['products', data.productCount],
                ] as const
              ).map(([label, value]) => (
                <div key={label}>
                  <dt className="text-sm text-muted-foreground">
                    {t('admin', label)}
                  </dt>
                  <dd className="mt-2 text-section font-medium tracking-tight tabular-nums">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
            <RevenueChart days={data.revenueByDay} />
            <div className="grid gap-7 md:grid-cols-2">
              <section>
                <h2 className="mb-3 text-heading font-medium">
                  {t('admin', 'ordersByStatus')}
                </h2>
                <ul>
                  {Object.entries(data.ordersByStatus).map(
                    ([status, count]) => (
                      <li
                        key={status}
                        className="flex items-center justify-between border-b border-border py-2 text-sm"
                      >
                        <StatusBadge
                          kind="order"
                          status={status as keyof Stats['ordersByStatus']}
                        />
                        <span>{count}</span>
                      </li>
                    ),
                  )}
                </ul>
              </section>
              <section>
                <h2 className="mb-3 text-heading font-medium">
                  {t('admin', 'topProducts')}
                </h2>
                <AdminTable
                  label={t('admin', 'topProducts')}
                  rows={data.topProducts}
                  columns={[
                    { label: t('admin', 'product'), cell: (row) => row.name },
                    {
                      label: t('admin', 'quantity'),
                      cell: (row) => row.quantity,
                      numeric: true,
                    },
                  ]}
                />
              </section>
            </div>
            <p className="text-sm text-muted-foreground">
              {t('admin', 'lowStock')} {data.lowStockCount} ·{' '}
              {t('admin', 'outStock')} {data.outOfStockCount}
            </p>
          </>
        )}
      </AdminData>
      <section className="space-y-3">
        <h2 className="text-heading font-medium">
          {t('admin', 'recentOrders')}
        </h2>
        <AdminData result={orders}>
          {({ items }) => (
            <AdminTable
              label={t('admin', 'recentOrders')}
              rows={items}
              columns={[
                {
                  label: t('admin', 'orderCode'),
                  cell: (row) => (
                    <Link
                      href={'/admin/orders/' + row.id}
                      className="underline underline-offset-4"
                    >
                      {row.id}
                    </Link>
                  ),
                },
                {
                  label: t('admin', 'status'),
                  cell: (row) => (
                    <StatusBadge kind="order" status={row.status} />
                  ),
                },
                {
                  label: t('admin', 'total'),
                  cell: (row) => formatMoney(row.totalPrice),
                  numeric: true,
                },
              ]}
            />
          )}
        </AdminData>
      </section>
      <section className="space-y-3">
        <h2 className="text-heading font-medium">{t('admin', 'lowStock')}</h2>
        <AdminData result={low}>
          {({ items }) => (
            <AdminTable
              label={t('admin', 'lowStock')}
              rows={items}
              columns={[
                {
                  label: t('admin', 'product'),
                  cell: (row) => (
                    <Link
                      href={'/admin/products/' + row.id}
                      className="underline underline-offset-4"
                    >
                      {row.name}
                    </Link>
                  ),
                },
                {
                  label: t('admin', 'stock'),
                  cell: (row) => row.stock,
                  numeric: true,
                },
              ]}
            />
          )}
        </AdminData>
      </section>
      <AdminData result={reconciliation}>
        {({ items, total }) =>
          items.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-heading font-medium">
                {t('admin', 'reconciliation')}
              </h2>
              <p className="text-sm text-muted-foreground">
                {t('admin', 'manualReconciliation')} ({total})
              </p>
              <AdminTable
                label={t('admin', 'reconciliation')}
                rows={items}
                columns={[
                  { label: t('admin', 'reference'), cell: (row) => row.id },
                  {
                    label: t('admin', 'payment'),
                    cell: (row) => row.paymentReference ?? '—',
                  },
                  {
                    label: t('admin', 'date'),
                    cell: (row) => adminDate(row.createdAt, true),
                  },
                  {
                    label: t('admin', 'total'),
                    cell: (row) =>
                      formatMoney(row.totalCents, {
                        unit: 'cents',
                        currency: row.currency,
                      }),
                    numeric: true,
                  },
                ]}
              />
            </section>
          )
        }
      </AdminData>
    </>
  );
}
