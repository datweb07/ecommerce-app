import type { Metadata } from 'next';
import { PageContainer, PageHeader } from '@/components/common/page';
import { Checkout } from '@/components/customer/checkout';
import { t } from '@/lib/i18n';
export const metadata: Metadata = { title: t('customer', 'checkout') };
export default function Page() {
  return (
    <PageContainer className="space-y-5">
      <PageHeader title={t('customer', 'checkout')} />
      <Checkout />
    </PageContainer>
  );
}
