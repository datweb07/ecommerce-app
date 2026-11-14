import { ArrowRight, LayoutGrid, UserRound } from 'lucide-react';
import Link from 'next/link';
import { PageContainer } from '../components/common/page';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/panels';
import { t } from '../lib/i18n';

export default function HomePage() {
  return (
    <PageContainer className="space-y-6">
      <section className="grid min-h-72 items-center gap-8 rounded-panel border border-border bg-muted px-6 py-10 sm:px-11 sm:py-14">
        <div className="max-w-2xl space-y-4">
          <p className="text-sm font-semibold text-primary">
            {t('common', 'preview')}
          </p>
          <h1 className="text-4xl font-extrabold tracking-tight text-balance sm:text-6xl">
            Mua sắm cùng ShopEase
          </h1>
          <p className="max-w-md leading-relaxed text-muted-foreground">
            Cửa hàng trực tuyến đang được xây dựng. Bạn có thể xem trước cách
            điều hướng trên website.
          </p>
          <Button asChild>
            <Link href="/products">
              {t('nav', 'products')} <ArrowRight size={17} />
            </Link>
          </Button>
        </div>
      </section>
      <div className="grid gap-4 sm:grid-cols-2">
        {[
          {
            label: t('nav', 'products'),
            text: 'Duyệt các mục trong cửa hàng.',
            href: '/products',
            Icon: LayoutGrid,
          },
          {
            label: t('nav', 'account'),
            text: 'Hồ sơ, địa chỉ và đơn hàng.',
            href: '/account',
            Icon: UserRound,
          },
        ].map(({ label, text, href, Icon }) => (
          <Card key={href} className="p-0">
            <Link
              href={href}
              prefetch={href === '/account' ? false : null}
              className="flex items-center gap-4 rounded-panel p-5 hover:bg-muted"
            >
              <span className="grid size-11 shrink-0 place-items-center rounded-control bg-muted text-primary">
                <Icon size={20} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-bold">{label}</span>
                <span className="text-sm text-muted-foreground">{text}</span>
              </span>
              <ArrowRight size={17} />
            </Link>
          </Card>
        ))}
      </div>
    </PageContainer>
  );
}
