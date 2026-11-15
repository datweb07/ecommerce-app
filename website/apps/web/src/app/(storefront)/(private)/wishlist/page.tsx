import type { Metadata } from 'next';
import { PageContainer, PageHeader } from '@/components/common/page';
import { WishlistContent } from '@/components/customer/wishlist';
import { t } from '@/lib/i18n';
import { pageNumber } from '@/lib/customer';
import type { RouteQuery } from '@/lib/url-state';
export const metadata: Metadata = { title: t('nav', 'wishlist') };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<RouteQuery>;
}) {
  return (
    <PageContainer className="space-y-6">
      <PageHeader title={t('nav', 'wishlist')} />
      <WishlistContent page={pageNumber((await searchParams).page)} />
    </PageContainer>
  );
}
