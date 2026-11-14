import { objectId } from '@storefront/shared';
import Link from 'next/link';
import type { Metadata } from 'next';
import { PageContainer, PageHeader } from '@/components/common/page';
import { EmptyState } from '@/components/common/states';
import { Button } from '@/components/ui/button';
import { CheckoutReturn } from '@/components/customer/checkout-return';
import { t } from '@/lib/i18n';
import type { RouteQuery } from '@/lib/url-state';
export const metadata: Metadata = { title: t('checkout', 'returnTitle') };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<RouteQuery>;
}) {
  const checkout = objectId.safeParse((await searchParams).checkoutId);
  return (
    <PageContainer className="space-y-5">
      <PageHeader title={t('checkout', 'returnTitle')} />
      {checkout.success ? (
        <CheckoutReturn id={checkout.data} />
      ) : (
        <EmptyState
          title={t('checkout', 'missing')}
          action={
            <Button asChild>
              <Link href="/cart">{t('checkout', 'backCart')}</Link>
            </Button>
          }
        />
      )}
    </PageContainer>
  );
}
