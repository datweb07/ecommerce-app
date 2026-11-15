import type { Metadata } from 'next';
import type { RouteQuery } from '../../../lib/url-state';
import { AdminProducts } from '../../../components/admin/products';
import { t } from '../../../lib/i18n';
export const metadata: Metadata = { title: t('admin', 'products') };
export default async function Products({
  searchParams,
}: {
  searchParams: Promise<RouteQuery>;
}) {
  return <AdminProducts search={await searchParams} />;
}
