import { adminStatsQuery } from '@storefront/shared';
import { Dashboard } from '../../components/admin/dashboard';
import type { RouteQuery } from '../../lib/url-state';
export default async function AdminHome({
  searchParams,
}: {
  searchParams: Promise<RouteQuery>;
}) {
  const { range } = await searchParams;
  const parsed = adminStatsQuery.safeParse({ range });
  return <Dashboard range={parsed.success ? parsed.data.range : '30d'} />;
}
