import type { Metadata } from 'next';
import { PageHeader } from '@/components/common/page';
import { t } from '@/lib/i18n';
import { pageNumber } from '@/lib/customer';
import type { RouteQuery } from '@/lib/url-state';
import { Orders } from '@/components/customer/orders';
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<RouteQuery>;
}) {
  return (
    <section className="min-w-0 space-y-5">
      <PageHeader title={t('account', 'orders')} />
      <Orders page={pageNumber((await searchParams).page)} />
    </section>
  );
}
export const metadata: Metadata = { title: t('account', 'orders') };
