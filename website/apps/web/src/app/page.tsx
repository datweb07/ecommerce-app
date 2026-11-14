import { Suspense } from 'react';
import { ArrowRight, CreditCard, PackageCheck, Truck } from 'lucide-react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { PageContainer, Section } from '../components/common/page';
import { EmptyState, LoadingSkeleton } from '../components/common/states';
import { Button } from '../components/ui/button';
import { ProductGrid } from '../components/catalogue/product-grid';
import { CatalogueError } from '../components/catalogue/catalogue-error';
import { serverApi } from '../lib/api/server';
import { apiResult } from '../lib/api/result';
import { t } from '../lib/i18n';
import { storeBenefits } from '../config/site';
import '../components/catalogue/home.css';

export const metadata: Metadata = {
  title: { absolute: t('home', 'title') },
  description: t('home', 'intro'),
  alternates: { canonical: '/' },
  openGraph: {
    title: t('home', 'title'),
    description: t('home', 'intro'),
    url: '/',
  },
};

async function FeaturedCategories() {
  const result = await apiResult(serverApi.categories.list());
  if (!result.ok) return <CatalogueError message={result.message} />;
  const { items } = result.data;
  if (!items.length)
    return <EmptyState title={t('catalogue', 'noCategories')} />;
  return (
    <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {items.slice(0, 8).map((category) => (
        <li key={category}>
          <Link
            href={{ pathname: '/products', query: { category } }}
            className="flex h-full items-center justify-between gap-2 rounded-panel border border-border bg-card px-4 py-5 text-sm font-semibold wrap-anywhere hover:bg-muted"
          >
            {category}
            <ArrowRight size={16} className="shrink-0" aria-hidden="true" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

async function ProductShelf({ sort }: { sort: 'newest' | 'bestselling' }) {
  const result = await apiResult(serverApi.products.list({ sort, limit: '4' }));
  if (!result.ok) return <CatalogueError message={result.message} />;
  const { items } = result.data;
  return items.length ? (
    <ProductGrid products={items} />
  ) : (
    <EmptyState title={t('catalogue', 'noProducts')} />
  );
}

export default function HomePage() {
  const icons = {
    shipping: Truck,
    payment: CreditCard,
    tracking: PackageCheck,
  };
  return (
    <PageContainer className="space-y-12 sm:space-y-16">
      <section className="home-hero overflow-hidden rounded-panel px-6 py-12 sm:px-12 sm:py-20">
        <div className="relative z-10 max-w-xl space-y-5">
          <h1 className="text-4xl font-extrabold tracking-tight text-balance sm:text-6xl">
            {t('home', 'title')}
          </h1>
          <p className="max-w-md text-base leading-relaxed sm:text-lg">
            {t('home', 'intro')}
          </p>
          <Button
            asChild
            className="bg-white text-[#17382b] hover:bg-[#e9f5ed]"
          >
            <Link href="/products">
              {t('home', 'explore')} <ArrowRight size={17} aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </section>
      <Section>
        <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
          {t('home', 'stay')}
        </h2>
        <Suspense fallback={<LoadingSkeleton variant="card" />}>
          <FeaturedCategories />
        </Suspense>
      </Section>
      {(['newest', 'bestselling'] as const).map((sort) => (
        <Section key={sort}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
              {t('home', sort === 'newest' ? 'new' : 'popular')}
            </h2>
            <Link
              className="inline-flex items-center gap-2 rounded-control py-2 text-sm font-semibold text-primary hover:underline"
              href={{ pathname: '/products', query: { sort } }}
            >
              {t('catalogue', 'viewAll')}{' '}
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
          <Suspense fallback={<LoadingSkeleton variant="card" />}>
            <ProductShelf sort={sort} />
          </Suspense>
        </Section>
      ))}
      <ul className="grid divide-y divide-border rounded-panel border border-border bg-card md:grid-cols-3 md:divide-x md:divide-y-0">
        {storeBenefits.map(({ icon, title, description }) => {
          const Icon = icons[icon];
          return (
            <li key={icon} className="flex items-start gap-4 p-5">
              <Icon className="shrink-0 text-primary" aria-hidden="true" />
              <div>
                <h2 className="font-bold">{title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {description}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </PageContainer>
  );
}
