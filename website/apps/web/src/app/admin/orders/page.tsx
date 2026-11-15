import type { Metadata } from 'next';
import { AdminOrders } from '../../../components/admin/orders';
import type { RouteQuery } from '../../../lib/url-state';
import { t } from '../../../lib/i18n';
export const metadata: Metadata = { title: t('admin', 'orders') };
export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<RouteQuery>;
}) {
  return <AdminOrders search={await searchParams} />;
}
