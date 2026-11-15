import Link from 'next/link';
import { connection } from 'next/server';
import { serverApi } from '../../lib/api/server';
import { t } from '../../lib/i18n';
import { site } from '../../config/site';
import { publicEnv } from '../../config/public-env';
import {
  HeaderActions,
  GuestActions,
  MobileMenu,
  SearchControl,
} from './header-client';

export async function Header() {
  await connection();
  const { items } = await serverApi.categories
    .list()
    .catch(() => ({ items: [] }));
  const categories = items.slice(0, 4);
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background">
      <div className="mx-auto flex min-h-16 max-w-7xl items-center gap-1 px-3 sm:px-8 lg:grid lg:grid-cols-[1fr_auto_1fr] lg:gap-5">
        <div className="flex min-w-0 items-center gap-1">
          <MobileMenu categories={categories} />
          <Link
            href="/"
            className="shrink-0 text-body font-medium tracking-tight sm:text-heading"
          >
            {site.name}
          </Link>
        </div>
        <nav
          aria-label={t('nav', 'categories')}
          className="hidden items-center gap-5 text-label lg:flex"
        >
          <Link
            href="/products"
            className="py-2 underline-offset-4 hover:underline"
          >
            {t('nav', 'products')}
          </Link>
          {categories.map((category) => (
            <Link
              key={category}
              href={{ pathname: '/products', query: { category } }}
              className="max-w-24 truncate py-2 text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              {category}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex min-w-0 items-center">
          <SearchControl />
          {publicEnv.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ? (
            <HeaderActions />
          ) : (
            <GuestActions />
          )}
        </div>
      </div>
    </header>
  );
}
