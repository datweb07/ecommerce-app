import { pagination, productQuery } from '@storefront/shared';
import type { ProductFilters } from './api/domains';
import type { RouteQuery } from './url-state';

export const cataloguePageSize = 12;
export const maxSearchLength = 80;
export const catalogueSort = [
  'newest',
  'price',
  'rating',
  'bestselling',
] as const;
const fields = [
  'q',
  'category',
  'minPrice',
  'maxPrice',
  'minRating',
  'inStock',
  'sort',
] as const;

export function normalizeCatalogue(query: RouteQuery): ProductFilters {
  const input: ProductFilters = {};
  for (const key of fields) {
    const value = query[key];
    if (typeof value !== 'string') continue;
    const candidate = value.trim();
    if (!candidate || (key === 'sort' && candidate === 'newest')) continue;
    if (productQuery.safeParse({ [key]: candidate }).success)
      Object.assign(input, { [key]: candidate });
  }
  if (
    input.minPrice &&
    input.maxPrice &&
    Number(input.minPrice) > Number(input.maxPrice)
  ) {
    delete input.minPrice;
    delete input.maxPrice;
  }
  const limit =
    typeof query.limit === 'string' &&
    pagination.safeParse({ limit: query.limit }).success
      ? query.limit
      : String(cataloguePageSize);
  if (limit !== String(cataloguePageSize)) input.limit = limit;
  if (
    typeof query.page === 'string' &&
    query.page !== '1' &&
    pagination.safeParse({ page: query.page, limit }).success
  )
    input.page = query.page;
  return input;
}

export function catalogueSearch(query: ProductFilters) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) params.set(key, value);
  }
  return params.toString();
}

export function catalogueHref(query: ProductFilters) {
  const search = catalogueSearch(query);
  return search ? '/products?' + search : '/products';
}

export function catalogueSeo(query: ProductFilters) {
  const noindex = Boolean(
    query.q ||
    query.minPrice ||
    query.maxPrice ||
    query.minRating ||
    query.inStock ||
    query.sort ||
    query.limit,
  );
  const canonical = catalogueHref({
    ...(query.category ? { category: query.category } : {}),
    ...(!noindex && query.page ? { page: query.page } : {}),
  });
  return { canonical, noindex };
}

export function boundedPageCount(total: number, limit: number) {
  return Math.min(Math.ceil(total / limit), 501, Math.floor(10000 / limit) + 1);
}
