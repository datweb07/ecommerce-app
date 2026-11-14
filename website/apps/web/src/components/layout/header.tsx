import { ShoppingBag } from 'lucide-react';
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
  SearchForm,
} from './header-client';

export async function Header() {
  await connection();
  const { items } = await serverApi.categories
    .list()
    .catch(() => ({ items: [] }));
  const categories = items.slice(0, 4);
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-2 sm:px-7 lg:gap-6">
        <MobileMenu categories={categories} />
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2.5 rounded-control text-lg font-extrabold tracking-tight"
        >
          <span className="grid size-9 place-items-center rounded-control bg-primary text-primary-foreground">
            <ShoppingBag size={19} />
          </span>
          {site.name}
        </Link>
        <div className="ml-2 hidden min-w-0 flex-1 lg:block">
          <SearchForm />
        </div>
        <div className="ml-auto min-w-0">
          {publicEnv.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ? (
            <HeaderActions />
          ) : (
            <GuestActions />
          )}
        </div>
      </div>
      <nav
        aria-label={t('nav', 'categories')}
        className="mx-auto hidden max-w-7xl items-center gap-6 px-7 pb-2 text-sm font-medium lg:flex"
      >
        <Link href="/products" className="rounded-control py-2 text-primary">
          {t('nav', 'products')}
        </Link>
        {categories.map((category) => (
          <Link
            key={category}
            href={{ pathname: '/products', query: { category } }}
            className="rounded-control py-2 text-muted-foreground hover:text-foreground"
          >
            {category}
          </Link>
        ))}
      </nav>
    </header>
  );
}
