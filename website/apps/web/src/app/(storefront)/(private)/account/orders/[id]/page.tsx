import type { Metadata } from 'next';
import { PageHeader } from '@/components/common/page';
import { t } from '@/lib/i18n';
import { objectId } from '@storefront/shared';
import { notFound } from 'next/navigation';
import { OrderDetail } from '@/components/customer/orders';
import { serverApi } from '@/lib/api/server';
import { ApiError } from '@/lib/api/transport';
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const parsed = objectId.safeParse((await params).id);
  if (!parsed.success) notFound();
  const order = await serverApi.orders
    .detail(parsed.data)
    .catch((error: unknown) => {
      if (error instanceof ApiError && error.status === 404) notFound();
      return undefined;
    });
  return (
    <section className="min-w-0 space-y-5">
      <PageHeader title={t('orders', 'detail')} />
      <OrderDetail id={parsed.data} initial={order} />
    </section>
  );
}
export const metadata: Metadata = { title: t('account', 'orders') };
