import type { Metadata } from 'next';
import { AdminReviews } from '../../../components/admin/reviews';
import type { RouteQuery } from '../../../lib/url-state';
import { t } from '../../../lib/i18n';
export const metadata: Metadata = { title: t('admin', 'reviews') };
export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<RouteQuery>;
}) {
  return <AdminReviews search={await searchParams} />;
}
