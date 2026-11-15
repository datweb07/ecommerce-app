import type { Metadata } from 'next';
import { Showcase } from '@/components/common/showcase';
import {
  HeroObject,
  PackageScene,
  EmptyObject3D,
} from '@/components/scene/scene-3d';
import { serverEnv } from '@/config/server-env';
import { globeConfig } from '@/config/globe';
import { Globe } from '@/components/globe/globe';
import { toSearchParams, type RouteQuery } from '@/lib/url-state';

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function ComponentsPage({
  searchParams,
}: {
  searchParams: Promise<RouteQuery>;
}) {
  const params = toSearchParams(await searchParams);
  const requestedPage = Number(params.get('page') ?? '1');
  const marker = globeConfig.markers[0];
  const page =
    Number.isInteger(requestedPage) && requestedPage >= 1 && requestedPage <= 3
      ? requestedPage
      : 1;
  return (
    <>
      <Showcase
        currency={serverEnv.CURRENCY}
        page={page}
        search={params.toString()}
      />
      <section className="mx-auto my-16 max-w-6xl px-4">
        <h2 className="text-section font-medium">Hình minh họa 3D</h2>
        <p className="mt-2 text-muted-foreground">
          Hàng dưới hiển thị ảnh tĩnh như khi bật giảm chuyển động.
        </p>
        <div className="mt-6 grid grid-cols-3 gap-4">
          <HeroObject />
          <PackageScene />
          <EmptyObject3D />
          <HeroObject staticOnly />
          <PackageScene staticOnly />
          <EmptyObject3D staticOnly />
        </div>
      </section>
      {marker && (
        <section className="mx-auto my-16 max-w-6xl px-4">
          <h2 className="text-section font-medium">Địa cầu</h2>
          <div className="grid gap-8 sm:grid-cols-2">
            <Globe config={globeConfig} marker={marker} />
            <Globe config={globeConfig} marker={marker} staticOnly />
          </div>
        </section>
      )}
    </>
  );
}
