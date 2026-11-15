'use client';
import { useQuery } from '@tanstack/react-query';
import { adminCustomersQuery } from '@storefront/shared';
import { useApiClient } from '../../lib/api/browser';
import { adminDate, adminFilters, adminKey } from '../../lib/admin/query';
import { t } from '../../lib/i18n';
import { formatMoney } from '../../lib/money';
import type { RouteQuery } from '../../lib/url-state';
import {
  AdminData,
  AdminFilters,
  AdminPagination,
  AdminTable,
  AdminTitle,
} from './data';

export function AdminCustomers({ search }: { search: RouteQuery }) {
  const path = '/admin/customers';
  const filters = adminFilters(adminCustomersQuery, search, [
    'page',
    'limit',
    'q',
  ]);
  const api = useApiClient().admin;
  const state = useQuery({
    queryKey: adminKey('customers', filters),
    queryFn: () => api.customers(filters),
  });
  return (
    <>
      <AdminTitle title={t('admin', 'customers')} />
      <AdminFilters
        key={JSON.stringify(filters)}
        path={path}
        values={filters}
        fields={[{ name: 'q', label: t('admin', 'customerSearch') }]}
      />
      <AdminData result={state}>
        {(data) => (
          <>
            <AdminTable
              label={t('admin', 'customers')}
              rows={data.items}
              columns={[
                { label: t('admin', 'name'), cell: (row) => row.name },
                { label: t('admin', 'email'), cell: (row) => row.email },
                {
                  label: t('admin', 'joined'),
                  cell: (row) => adminDate(row.createdAt),
                },
                {
                  label: t('admin', 'orderCount'),
                  cell: (row) => row.orderCount,
                  numeric: true,
                },
                {
                  label: t('admin', 'totalSpent'),
                  cell: (row) => formatMoney(row.totalSpent),
                  numeric: true,
                },
              ]}
            />
            <AdminPagination path={path} filters={filters} data={data} />
          </>
        )}
      </AdminData>
    </>
  );
}
