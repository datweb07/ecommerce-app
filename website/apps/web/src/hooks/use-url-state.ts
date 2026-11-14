'use client';
import { usePathname, useSearchParams } from 'next/navigation';
import { withPage } from '../lib/url-state';
export function useUrlState() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  return {
    pathname,
    search,
    pageHref: (page: number) => withPage(pathname, search, page),
  };
}
