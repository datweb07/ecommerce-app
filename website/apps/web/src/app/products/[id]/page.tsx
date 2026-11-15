import { objectId } from '@storefront/shared';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache, Suspense } from 'react';
import {
  Breadcrumb,
  PageContainer,
  Section,
} from '../../../components/common/page';
import { EmptyState, LoadingSkeleton } from '../../../components/common/states';
import { Price } from '../../../components/common/storefront';
import { RatingStars } from '../../../components/common/rating-stars';
import { CatalogueError } from '../../../components/catalogue/catalogue-error';
import { Gallery } from '../../../components/catalogue/gallery';
import { ProductGrid } from '../../../components/catalogue/product-grid';
import { Purchase } from '../../../components/catalogue/purchase';
import { Badge } from '../../../components/ui/panels';
import { Pagination } from '../../../components/ui/pagination';
import { publicEnv } from '../../../config/public-env';
import { serverEnv } from '../../../config/server-env';
import { apiResult } from '../../../lib/api/result';
import { serverApi } from '../../../lib/api/server';
import { ApiError } from '../../../lib/api/transport';
import {
  boundedPageCount,
  normalizeCatalogue,
} from '../../../lib/catalogue-query';
import { t } from '../../../lib/i18n';
import { productImageUrl } from '../../../lib/product-image-url';
import type { RouteQuery } from '../../../lib/url-state';

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<RouteQuery>;
};
const productPath = (id: string) => '/products/' + id;
const dateFormat = new Intl.DateTimeFormat('vi-VN', {
  dateStyle: 'medium',
  timeZone: 'UTC',
});
const readProduct = cache(async (id: string) => {
  const parsed = objectId.safeParse(id);
  if (!parsed.success) notFound();
  return apiResult(
    serverApi.products.detail(parsed.data).catch((error: unknown) => {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }),
  );
});
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const result = await readProduct((await params).id);
  if (!result.ok || !result.data)
    return { title: t('detail', 'title'), robots: { index: false } };
  const product = result.data;
  const description = product.description.trim().slice(0, 160);
  const url = productPath(product.id);
  const images = product.images.flatMap((raw) => {
    const image = productImageUrl(raw);
    return image ? [{ url: image, alt: product.name }] : [];
  });
  return {
    title: product.name,
    description,
    alternates: { canonical: url },
    openGraph: { title: product.name, description, url, images },
  };
}

async function Reviews({ id, page }: { id: string; page: string }) {
  const result = await apiResult(
    serverApi.products.reviews(id, { page, limit: '10' }),
  );
  if (!result.ok) return <CatalogueError message={result.message} />;
  const data = result.data;
  return (
    <>
      {data.items.length ? (
        <ul className="divide-y divide-border border-y border-border">
          {data.items.map((review, index) => (
            <li key={index} className="grid gap-2 py-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">{review.displayName}</p>
                {review.createdAt && (
                  <time
                    dateTime={review.createdAt}
                    className="text-sm text-muted-foreground"
                  >
                    {dateFormat.format(new Date(review.createdAt))}
                  </time>
                )}
              </div>
              <RatingStars value={review.rating} />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title={t('detail', 'noReviews')} />
      )}
      <Pagination
        pathname={productPath(id)}
        page={data.page}
        totalPages={boundedPageCount(data.total, data.limit)}
      />
    </>
  );
}
async function Related({ id }: { id: string }) {
  const result = await apiResult(serverApi.products.related(id));
  if (!result.ok) return <CatalogueError message={result.message} />;
  return result.data.items.length ? (
    <ProductGrid products={result.data.items} />
  ) : (
    <EmptyState title={t('detail', 'noRelated')} />
  );
}

export default async function ProductPage({ params, searchParams }: Props) {
  const result = await readProduct((await params).id);
  if (!result.ok)
    return (
      <PageContainer className="space-y-5">
        <h1 className="text-section font-medium">{t('detail', 'title')}</h1>
        <CatalogueError message={result.message} />
      </PageContainer>
    );
  if (!result.data) notFound();
  const product = result.data;
  const page =
    normalizeCatalogue({ page: (await searchParams).page }).page ?? '1';
  const imageUrls = product.images.flatMap((source) => {
    const url = productImageUrl(source);
    return url ? [url] : [];
  });
  const stock = Math.floor(product.stock);
  const stockText =
    stock <= 0
      ? t('catalogue', 'outOfStock')
      : stock <= 5
        ? t('detail', 'lowStock')
        : t('catalogue', 'inStock');
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description,
    sku: product.id,
    ...(imageUrls.length ? { image: imageUrls } : {}),
    offers: {
      '@type': 'Offer',
      price: product.price,
      priceCurrency: serverEnv.CURRENCY.toUpperCase(),
      url: new URL(productPath(product.id), publicEnv.NEXT_PUBLIC_SITE_URL)
        .href,
      availability:
        'https://schema.org/' + (stock > 0 ? 'InStock' : 'OutOfStock'),
    },
    ...(product.totalReviews > 0
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: product.averageRating,
            reviewCount: product.totalReviews,
          },
        }
      : {}),
  };
  return (
    <PageContainer className="space-y-10 lg:space-y-section">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replaceAll('<', '\\u003c'),
        }}
      />
      <Breadcrumb
        items={[
          { label: t('nav', 'home'), href: '/' },
          { label: t('nav', 'products'), href: '/products' },
          {
            label: product.category,
            href: '/products?category=' + encodeURIComponent(product.category),
          },
          { label: product.name },
        ]}
      />
      <div className="grid items-start gap-8 lg:grid-cols-[1.25fr_0.75fr] lg:gap-16">
        <Gallery key={product.id} name={product.name} images={imageUrls} />
        <div className="space-y-7 lg:sticky lg:top-24">
          <div className="space-y-3">
            <Badge>{stockText}</Badge>
            <h1 className="text-title leading-tight font-medium tracking-tight wrap-anywhere">
              {product.name}
            </h1>
            <div className="text-heading text-foreground">
              <Price amount={product.price} currency={serverEnv.CURRENCY} />
            </div>
            <p className="whitespace-pre-line text-muted-foreground">
              {product.description}
            </p>
          </div>
          <Purchase
            key={product.id}
            product={product}
            cartMax={serverEnv.CART_MAX_QUANTITY}
          />
        </div>
      </div>
      <Section>
        <h2 className="text-section font-medium">{t('detail', 'reviews')}</h2>
        <div className="flex flex-wrap items-center gap-3">
          <RatingStars value={product.averageRating} />
          <p className="text-sm text-muted-foreground">
            {product.totalReviews} {t('detail', 'reviewCount')}
          </p>
        </div>
        <Suspense key={page} fallback={<LoadingSkeleton />}>
          <Reviews id={product.id} page={page} />
        </Suspense>
      </Section>
      <Section>
        <h2 className="text-section font-medium">{t('detail', 'related')}</h2>
        <Suspense fallback={<LoadingSkeleton variant="card" />}>
          <Related id={product.id} />
        </Suspense>
      </Section>
    </PageContainer>
  );
}
