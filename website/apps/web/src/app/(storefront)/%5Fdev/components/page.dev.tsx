import type { Metadata } from 'next';
import { Showcase } from '@/components/common/showcase';
import { serverEnv } from '@/config/server-env';
import { toSearchParams, type RouteQuery } from '@/lib/url-state';

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function ComponentsPage({
  searchParams,
}: {
  searchParams: Promise<RouteQuery>;
}) {
  const params = toSearchParams(await searchParams);
  const requestedPage = Number(params.get('page') ?? '1');
  const page =
    Number.isInteger(requestedPage) && requestedPage >= 1 && requestedPage <= 3
      ? requestedPage
      : 1;
  return (
    <Showcase
      currency={serverEnv.CURRENCY}
      page={page}
      search={params.toString()}
    />
  );
}
