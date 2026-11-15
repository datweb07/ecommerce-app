import { Suspense } from 'react';
import { ArrowRight, CreditCard, PackageCheck, Truck } from 'lucide-react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { PageContainer, Section } from '@/components/common/page';
import { FanCards } from '@/components/common/fan-cards';
import { PinnedScroll } from '@/components/common/pinned-scroll';
import { HeroObject, PackageScene } from '@/components/scene/scene-3d';
import { Globe } from '@/components/globe/globe';
import { EmptyState, LoadingSkeleton } from '@/components/common/states';
import { Button } from '@/components/ui/button';
import { ProductGrid } from '@/components/catalogue/product-grid';
import { CatalogueError } from '@/components/catalogue/catalogue-error';
import { apiFetch, serverApi } from '@/lib/api/server';
import { getBanners } from '@/lib/api/banners';
import { BannerCarousel } from '@/components/catalogue/banner-carousel';
import { apiResult } from '@/lib/api/result';
import { t } from '@/lib/i18n';
import { shoppingSteps, storeBenefits } from '@/config/site';
import { globeConfig } from '@/config/globe';
import { publicEnv } from '@/config/public-env';

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

async function HomeBanners() {
  const banners = await getBanners(apiFetch);
  return <BannerCarousel banners={banners} />;
}

async function FeaturedCategories() {
  const result = await apiResult(serverApi.categories.list());
  if (!result.ok) return <CatalogueError message={result.message} />;
  const { items } = result.data;
  if (!items.length)
    return <EmptyState title={t('catalogue', 'noCategories')} />;
  return (
    <ul className="grid grid-cols-2 gap-x-6 gap-y-4 border-t border-border pt-5 md:grid-cols-4 md:gap-x-10">
      {items.slice(0, 8).map((category) => (
        <li key={category}>
          <Link
            href={{ pathname: '/products', query: { category } }}
            className="block py-2 text-heading font-medium wrap-anywhere underline-offset-4 hover:underline"
          >
            {category}
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
  const marker = publicEnv.NEXT_PUBLIC_GLOBE_ENABLED
    ? globeConfig.markers[0]
    : undefined;
  const icons = {
    shipping: Truck,
    payment: CreditCard,
    tracking: PackageCheck,
  };
  return (
    <PageContainer className="space-y-section lg:space-y-section-lg">
      <section
        className={
          marker
            ? 'grid items-center gap-x-10 gap-y-5 border-b border-border py-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,45%)]'
            : 'flex min-h-[22rem] items-center border-b border-border py-14 sm:min-h-[28rem] sm:py-20'
        }
      >
        <div className="max-w-3xl space-y-6">
          <h1 className="text-title leading-[1.04] font-medium tracking-[-0.045em] text-balance sm:text-display">
            {t('home', 'title')}
          </h1>
          <p className="max-w-lg text-body text-muted-foreground">
            {t('home', 'intro')}
          </p>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <Button asChild>
              <Link href="/products">
                {t('home', 'explore')}{' '}
                <ArrowRight size={16} strokeWidth={1.5} aria-hidden="true" />
              </Link>
            </Button>
            <Link
              href="#home-categories"
              className="text-label underline underline-offset-4"
            >
              {t('home', 'stay')}
            </Link>
          </div>
        </div>
        {marker && <Globe config={globeConfig} marker={marker} />}
      </section>
      <Suspense fallback={null}>
        <HomeBanners />
      </Suspense>
      <Section id="home-categories" className="scroll-mt-24">
        <h2 className="text-section font-medium tracking-tight">
          {t('home', 'stay')}
        </h2>
        <Suspense fallback={<LoadingSkeleton variant="card" />}>
          <FeaturedCategories />
        </Suspense>
      </Section>
      {(['newest', 'bestselling'] as const).map((sort) => (
        <Section key={sort}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-section font-medium tracking-tight">
              {t('home', sort === 'newest' ? 'new' : 'popular')}
            </h2>
            <Link
              className="py-2 text-label text-muted-foreground underline underline-offset-4 hover:text-foreground"
              href={{ pathname: '/products', query: { sort } }}
            >
              {t('catalogue', 'viewAll')}{' '}
            </Link>
          </div>
          <Suspense fallback={<LoadingSkeleton variant="card" />}>
            <ProductShelf sort={sort} />
          </Suspense>
        </Section>
      ))}
      <PinnedScroll
        id="home-shopping-guide"
        title={t('shoppingGuide', 'heading')}
        skipTarget="home-benefits"
        skipLabel={t('shoppingGuide', 'skip')}
        steps={shoppingSteps}
        visual={<PackageScene className="w-full" />}
      />
      <HeroObject className="mx-auto hidden w-64 lg:block" />
      <FanCards
        id="home-benefits"
        items={storeBenefits.map(({ icon, title, description }) => {
          const Icon = icons[icon];
          return {
            id: icon,
            title,
            description,
            icon: <Icon size={22} strokeWidth={1.5} />,
          };
        })}
      />
    </PageContainer>
  );
}
