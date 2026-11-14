import { describe, expect, it } from 'vitest';
import {
  boundedPageCount,
  catalogueHref,
  catalogueSeo,
  normalizeCatalogue,
} from '../src/lib/catalogue-query';

describe('public catalogue URL', () => {
  it('keeps only valid filters and resets offset when beyond API capacity', () => {
    expect(
      normalizeCatalogue({
        q: '  tai nghe ',
        minPrice: '8.95',
        maxPrice: '20',
        minRating: '4',
        inStock: 'false',
        sort: 'price',
        category: ['A', 'B'],
        page: '501',
        limit: '100',
        extra: 'irrelevant',
      }),
    ).toEqual({
      q: 'tai nghe',
      minPrice: '8.95',
      maxPrice: '20',
      minRating: '4',
      inStock: 'false',
      sort: 'price',
      limit: '100',
    });
    expect(
      normalizeCatalogue({
        q: 'a'.repeat(81),
        minPrice: '80',
        maxPrice: '19',
        sort: 'invalid',
        page: '0',
      }),
    ).toEqual({});
  });
  it('round-trips category, preserves clean pagination canonical and noindexes deep filters', () => {
    const query = normalizeCatalogue({
      category: 'Đồ dùng & nhà cửa',
      page: '2',
    });
    expect(catalogueHref(query)).toContain(
      'category=%C4%90%E1%BB%93+d%C3%B9ng+%26+nh%C3%A0+c%E1%BB%ADa&page=2',
    );
    expect(catalogueSeo(query)).toEqual({
      canonical: catalogueHref(query),
      noindex: false,
    });
    expect(catalogueSeo({ ...query, q: 'bàn' })).toEqual({
      canonical: catalogueHref({ category: 'Đồ dùng & nhà cửa' }),
      noindex: true,
    });
    expect(boundedPageCount(20_000, 100)).toBe(101);
  });
});
