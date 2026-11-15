import { objectId } from '@storefront/shared';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { AdminOrderDetail } from '../../../../components/admin/orders';
import { t } from '../../../../lib/i18n';
export const metadata: Metadata = { title: t('admin', 'orderDetail') };
export default async function OrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const result = objectId.safeParse((await params).id);
  if (!result.success) notFound();
  return <AdminOrderDetail id={result.data} />;
}
