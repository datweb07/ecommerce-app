'use client';

import { adminProductQuery } from '@storefront/shared';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useApiClient } from '../../lib/api/browser';
import { adminFilters, adminKey } from '../../lib/admin/query';
import { formatMoney } from '../../lib/money';
import { t } from '../../lib/i18n';
import type { RouteQuery } from '../../lib/url-state';
import { ProductImage } from '../catalogue/product-image';
import { Button } from '../ui/button';
import {
  AdminData,
  AdminFilters,
  AdminPagination,
  AdminTable,
  AdminTitle,
} from './data';

export const productPath = '/admin/products';
const labels = {
  available: 'available',
  low: 'lowStock',
  out: 'outStock',
} as const;
const color = {
  available: 'delivered',
  low: 'pending',
  out: 'failed',
} as const;
export function StockStatus({ status }: { status: keyof typeof labels }) {
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap">
      <span
        aria-hidden="true"
        data-status={color[status]}
        className="size-1.5 rounded-control bg-current"
      />
      {t('admin', labels[status])}
    </span>
  );
}
const stocks = [
  ['all', t('admin', 'all')],
  ['low', t('admin', 'lowStock')],
  ['out', t('admin', 'outStock')],
] as const;
const sorts = [
  ['newest', t('admin', 'newest')],
  ['price', t('admin', 'priceAscending')],
  ['stock', t('admin', 'stockAscending')],
  ['name', t('admin', 'nameAscending')],
] as const;

export function AdminProducts({ search }: { search: RouteQuery }) {
  const api = useApiClient();
  const filters = adminFilters(adminProductQuery, search, [
    'page',
    'limit',
    'q',
    'category',
    'stockStatus',
    'sort',
  ]);
  const products = useQuery({
    queryKey: adminKey('products', filters),
    queryFn: () => api.admin.products(filters),
  });
  const categories = useQuery({
    queryKey: ['categories'],
    queryFn: api.categories.list,
  });
  const categoryOptions = Array.from(
    new Set([
      ...(categories.data?.items ?? []),
      ...(filters.category ? [filters.category] : []),
    ]),
  );
  return (
    <>
      <AdminTitle
        title={t('admin', 'products')}
        action={
          <Button asChild>
            <Link href={productPath + '/new'}>{t('admin', 'addProduct')}</Link>
          </Button>
        }
      />
      <AdminFilters
        path={productPath}
        values={filters}
        key={JSON.stringify(filters)}
        fields={[
          { name: 'q', label: t('admin', 'productSearch') },
          {
            name: 'category',
            label: t('admin', 'category'),
            options: [
              ['', t('admin', 'all')],
              ...categoryOptions.map((name) => [name, name] as const),
            ],
          },
          {
            name: 'stockStatus',
            label: t('admin', 'stockStatus'),
            options: stocks,
          },
          { name: 'sort', label: t('admin', 'sort'), options: sorts },
        ]}
      />
      <AdminData result={products}>
        {(data) => (
          <>
            <AdminTable
              label={t('admin', 'products')}
              rows={data.items}
              columns={[
                {
                  label: t('admin', 'product'),
                  cell: (row) => (
                    <Link
                      href={productPath + '/' + row.id}
                      className="inline-flex items-center gap-3 underline-offset-4 hover:underline"
                    >
                      <span className="relative block size-12 shrink-0 overflow-hidden rounded-control">
                        <ProductImage
                          source={row.images[0]}
                          sizes="48px"
                          alt=""
                          className="object-cover"
                        />
                      </span>
                      {row.name}
                    </Link>
                  ),
                },
                { label: t('admin', 'category'), cell: (row) => row.category },
                {
                  label: t('admin', 'price'),
                  cell: (row) => formatMoney(row.price),
                  numeric: true,
                },
                {
                  label: t('admin', 'stock'),
                  cell: (row) => row.stock,
                  numeric: true,
                },
                {
                  label: t('admin', 'status'),
                  cell: (row) => <StockStatus status={row.stockStatus} />,
                },
              ]}
            />
            <AdminPagination path={productPath} filters={filters} data={data} />
          </>
        )}
      </AdminData>
    </>
  );
}
