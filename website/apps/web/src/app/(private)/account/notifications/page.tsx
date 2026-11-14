import type { Metadata } from 'next';
import { PageHeader } from '@/components/common/page';
import { Inbox } from '@/components/customer/inbox';
import { t } from '@/lib/i18n';
export const metadata: Metadata = { title: t('account', 'notifications') };
export default function Page() {
  return (
    <section className="min-w-0 space-y-5">
      <PageHeader title={t('account', 'notifications')} />
      <Inbox />
    </section>
  );
}
