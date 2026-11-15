import type { Metadata } from 'next';
import { PageContainer, PageHeader } from '@/components/common/page';
import { CartPageContent } from '@/components/customer/cart';
import { t } from '@/lib/i18n';
import { serverEnv } from '@/config/server-env';
export const metadata: Metadata = { title: t('nav', 'cart') };
export default function Page() {
  return (
    <PageContainer className="space-y-6">
      <PageHeader title={t('nav', 'cart')} />
      <CartPageContent max={serverEnv.CART_MAX_QUANTITY} />
    </PageContainer>
  );
}
