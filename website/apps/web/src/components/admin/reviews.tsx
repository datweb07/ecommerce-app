'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminReviewsQuery } from '@storefront/shared';
import Link from 'next/link';
import { toast } from 'sonner';
import { useApiClient } from '../../lib/api/browser';
import { adminDate, adminFilters, adminKey } from '../../lib/admin/query';
import { t } from '../../lib/i18n';
import type { RouteQuery } from '../../lib/url-state';
import { Button } from '../ui/button';
import { toastApiError } from '../ui/sonner';
import { ConfirmDialog } from '../common/confirm-dialog';
import { RatingStars } from '../common/rating-stars';
import {
  AdminData,
  AdminFilters,
  AdminPagination,
  AdminTable,
  AdminTitle,
} from './data';

const path = '/admin/reviews';
const ratings = [
  ['', t('admin', 'all')],
  ...['1', '2', '3', '4', '5'].map((rating) => [rating, rating] as const),
] as const;
export function AdminReviews({ search }: { search: RouteQuery }) {
  const filters = adminFilters(adminReviewsQuery, search, [
    'page',
    'limit',
    'productId',
    'rating',
  ]);
  const api = useApiClient().admin;
  const client = useQueryClient();
  const state = useQuery({
    queryKey: adminKey('reviews', filters),
    queryFn: () => api.reviews(filters),
  });
  const mutation = useMutation({
    mutationFn: api.deleteReview,
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: adminKey('reviews') });
      toast.success(t('admin', 'deleted'));
    },
    onError: toastApiError,
  });
  return (
    <>
      <AdminTitle title={t('admin', 'reviews')} />
      <AdminFilters
        key={JSON.stringify(filters)}
        path={path}
        values={filters}
        fields={[
          {
            name: 'productId',
            label: t('admin', 'product') + ' (ID)',
            maxLength: 24,
          },
          { name: 'rating', label: t('admin', 'rating'), options: ratings },
        ]}
      />
      <AdminData result={state}>
        {(data) => (
          <>
            <AdminTable
              label={t('admin', 'reviews')}
              rows={data.items}
              columns={[
                {
                  label: t('admin', 'product'),
                  cell: (row) =>
                    row.productName ? (
                      <Link
                        href={'/admin/products/' + row.productId}
                        className="underline underline-offset-4"
                      >
                        {row.productName}
                      </Link>
                    ) : (
                      row.productId
                    ),
                },
                {
                  label: t('admin', 'rating'),
                  cell: (row) => <RatingStars value={row.rating} />,
                },
                { label: t('admin', 'author'), cell: (row) => row.displayName },
                {
                  label: t('admin', 'date'),
                  cell: (row) => adminDate(row.createdAt),
                },
                {
                  label: t('admin', 'actions'),
                  cell: (row) => (
                    <ConfirmDialog
                      trigger={
                        <Button variant="ghost" disabled={mutation.isPending}>
                          {t('admin', 'delete')}
                        </Button>
                      }
                      title={t('admin', 'deleteReview')}
                      description={t('admin', 'deleteReviewHint')}
                      confirmLabel={t('admin', 'delete')}
                      onConfirm={() => {
                        if (!mutation.isPending) mutation.mutate(row.id);
                      }}
                    />
                  ),
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
