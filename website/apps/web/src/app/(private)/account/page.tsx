import type { Metadata } from 'next';
import { PageHeader } from '@/components/common/page';
import { Identity } from '@/components/customer/profile';
import { t } from '@/lib/i18n';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
export const metadata: Metadata = { title: t('account', 'overview') };
export default function Page() {
  return (
    <section className="min-w-0 space-y-5">
      <PageHeader title={t('account', 'overview')} />
      <Identity />
      <div className="flex flex-wrap gap-2">
        {(
          [
            'profile',
            'addresses',
            'orders',
            'notifications',
            'security',
          ] as const
        ).map((section) => (
          <Button key={section} asChild variant="outline">
            <Link href={`/account/${section}`}>{t('account', section)}</Link>
          </Button>
        ))}
      </div>
    </section>
  );
}
