import type { Metadata } from 'next';
import { AdminCustomers } from '../../../components/admin/customers';
import type { RouteQuery } from '../../../lib/url-state';
import { t } from '../../../lib/i18n';
export const metadata: Metadata = { title: t('admin', 'customers') };
export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<RouteQuery>;
}) {
  return <AdminCustomers search={await searchParams} />;
}
