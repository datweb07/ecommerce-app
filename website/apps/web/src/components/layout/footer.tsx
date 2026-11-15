import Link from 'next/link';
import { site } from '../../config/site';
import { t } from '../../lib/i18n';

export function Footer() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto grid max-w-7xl gap-8 px-5 py-12 sm:grid-cols-[2fr_1fr_1fr] sm:px-7">
        <div>
          <p className="text-heading font-medium">{site.name}</p>
          <p className="mt-2 max-w-xs text-sm text-muted-foreground">
            {site.description}
          </p>
          {site.contactEmail && (
            <a
              className="mt-2 inline-block text-sm text-primary underline"
              href={`mailto:${site.contactEmail}`}
            >
              {site.contactEmail}
            </a>
          )}
        </div>
        <div className="grid content-start gap-2 text-sm">
          <p className="font-medium">Mua sắm</p>
          <Link
            className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            href="/products"
          >
            {t('nav', 'products')}
          </Link>
          <Link
            className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            href="/wishlist"
            prefetch={false}
          >
            {t('nav', 'wishlist')}
          </Link>
        </div>
        <div className="grid content-start gap-2 text-sm">
          <p className="font-medium">{t('nav', 'account')}</p>
          <Link
            className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            href="/account/orders"
            prefetch={false}
          >
            Đơn hàng
          </Link>
          <Link
            className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            href="/account/security"
            prefetch={false}
          >
            Bảo mật
          </Link>
        </div>
      </div>
      <div className="border-t border-border px-5 py-4 text-center text-xs text-muted-foreground">
        © {new Date().getUTCFullYear()} {site.name}
      </div>
    </footer>
  );
}
