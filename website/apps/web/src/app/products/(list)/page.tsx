import type { Metadata } from 'next';
import Link from 'next/link';
import { X } from 'lucide-react';
import {
  Breadcrumb,
  PageContainer,
  PageHeader,
} from '@/components/common/page';
import { EmptyState } from '@/components/common/states';
import { CatalogueError } from '@/components/catalogue/catalogue-error';
import { CatalogueFilters } from '@/components/catalogue/filters';
import { ProductGrid } from '@/components/catalogue/product-grid';
import { Button } from '@/components/ui/button';
import { Pagination } from '@/components/ui/pagination';
import { serverApi } from '@/lib/api/server';
import { apiResult } from '@/lib/api/result';
import type { ProductFilters } from '@/lib/api/domains';
import {
  boundedPageCount,
  catalogueHref,
  cataloguePageSize,
  catalogueSearch,
  catalogueSeo,
  normalizeCatalogue,
} from '@/lib/catalogue-query';
import { formatMoney } from '@/lib/money';
import { t } from '@/lib/i18n';
import type { RouteQuery } from '@/lib/url-state';

type Props = { searchParams: Promise<RouteQuery> };
export async function generateMetadata({
  searchParams,
}: Props): Promise<Metadata> {
  const query = normalizeCatalogue(await searchParams);
  const { canonical, noindex } = catalogueSeo(query);
  const title = query.category ?? t('nav', 'products');
  return {
    title: query.page
      ? `${title} · ${t('catalogue', 'page')} ${query.page}`
      : title,
    description: t('catalogue', 'description'),
    alternates: { canonical },
    ...(noindex ? { robots: { index: false, follow: true } } : {}),
  };
}
function AppliedFilters({ query }: { query: ProductFilters }) {
  const chips = [
    ['q', query.q],
    ['category', query.category],
    [
      'minPrice',
      query.minPrice
        ? `${t('catalogue', 'minPrice')} ${formatMoney(Number(query.minPrice))}`
        : undefined,
    ],
    [
      'maxPrice',
      query.maxPrice
        ? `${t('catalogue', 'maxPrice')} ${formatMoney(Number(query.maxPrice))}`
        : undefined,
    ],
    [
      'minRating',
      query.minRating
        ? `${query.minRating}+${' '}${t('catalogue', 'stars')}`
        : undefined,
    ],
    [
      'inStock',
      query.inStock
        ? t('catalogue', query.inStock === 'true' ? 'inStock' : 'outOfStock')
        : undefined,
    ],
    ['sort', query.sort ? t('catalogue', query.sort) : undefined],
  ] as const;
  if (!chips.some(([, label]) => label)) return null;
  return (
    <ul
      className="flex flex-wrap items-center gap-2"
      aria-label={t('catalogue', 'applied')}
    >
      {chips.map(([key, label]) => {
        if (!label) return null;
        const next = { ...query };
        delete next[key];
        delete next.page;
        return (
          <li key={key}>
            <Button
              asChild
              variant="outline"
              size="small"
              className="max-w-full wrap-anywhere whitespace-normal"
            >
              <Link
                href={catalogueHref(next)}
                aria-label={`${t('catalogue', 'removeFilter')} ${label}`}
              >
                {label}
                <X size={14} className="shrink-0" aria-hidden="true" />
              </Link>
            </Button>
          </li>
        );
      })}
      <li>
        <Button asChild size="small" variant="ghost">
          <Link href="/products">{t('catalogue', 'clear')}</Link>
        </Button>
      </li>
    </ul>
  );
}
export default async function ProductsPage({ searchParams }: Props) {
  const query = normalizeCatalogue(await searchParams);
  const [products, categories] = await Promise.all([
    apiResult(
      serverApi.products.list({ limit: String(cataloguePageSize), ...query }),
    ),
    apiResult(serverApi.categories.list()),
  ]);
  const search = catalogueSearch(query);
  const data = products.ok ? products.data : undefined;
  return (
    <PageContainer className="space-y-6">
      <Breadcrumb
        items={[
          { label: t('nav', 'home'), href: '/' },
          { label: t('nav', 'products') },
        ]}
      />
      <PageHeader
        title={query.category ?? t('nav', 'products')}
        description={t('catalogue', 'description')}
      />
      <div className="grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <CatalogueFilters
          query={query}
          categories={categories.ok ? categories.data.items : []}
        />
        <div className="min-w-0 space-y-5">
          {!categories.ok && <CatalogueError message={categories.message} />}
          <AppliedFilters query={query} />
          {!products.ok && <CatalogueError message={products.message} />}
          {data && (
            <>
              <p className="text-sm text-muted-foreground">
                {new Intl.NumberFormat('vi-VN').format(data.total)}{' '}
                {t('catalogue', 'results')}
              </p>
              {data.items.length > 0 ? (
                <ProductGrid products={data.items} />
              ) : (
                <EmptyState
                  title={t('catalogue', 'noResults')}
                  description={t('catalogue', 'emptyHint')}
                  action={
                    <Button asChild variant="outline">
                      <Link href={catalogueHref({})}>
                        {t('catalogue', 'clear')}
                      </Link>
                    </Button>
                  }
                />
              )}
              <Pagination
                pathname="/products"
                search={search}
                page={data.page}
                totalPages={boundedPageCount(data.total, data.limit)}
              />
            </>
          )}
        </div>
      </div>
    </PageContainer>
  );
}
