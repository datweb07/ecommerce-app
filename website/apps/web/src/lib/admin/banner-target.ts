import { bannerDestination, objectId } from '@storefront/shared';

export type TargetKind = 'product' | 'category' | 'custom';
export function targetPath(kind: TargetKind, value: string, origin: string) {
  if (kind === 'product') {
    const id = objectId.safeParse(value);
    return id.success ? '/products/' + id.data : null;
  }
  if (kind === 'category') {
    return value.trim().length > 0 && value.trim().length <= 100
      ? '/products?' + new URLSearchParams({ category: value.trim() })
      : null;
  }
  return bannerDestination(value.trim(), origin);
}

export function initialTarget(href: string): {
  kind: TargetKind;
  value: string;
} {
  const product = /^\/products\/([a-f\d]{24})$/i.exec(href)?.[1];
  if (product) return { kind: 'product', value: product };
  if (href.startsWith('/products?') && !href.includes('#')) {
    const params = new URLSearchParams(href.slice('/products?'.length));
    const category = params.get('category');
    if (params.size === 1 && category)
      return { kind: 'category', value: category };
  }
  return { kind: 'custom', value: href };
}
