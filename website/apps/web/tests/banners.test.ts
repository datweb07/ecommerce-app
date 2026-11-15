import { expect, it, vi } from 'vitest';
import { sampleBanners } from '@storefront/shared';
import { getBanners } from '../src/lib/api/banners';
import { createTransport } from '../src/lib/api/transport';

it('loads the published banner DTO with a cache tag and respects an empty configuration', async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(Response.json({ items: [sampleBanners[0]] }))
    .mockResolvedValueOnce(Response.json({ items: [] }));
  const request = createTransport({ origin: 'http://localhost:4000', fetcher });
  await expect(getBanners(request)).resolves.toEqual([sampleBanners[0]]);
  await expect(getBanners(request)).resolves.toEqual([]);
  expect(fetcher).toHaveBeenCalledWith(
    new URL('http://localhost:4000/api/v1/banners'),
    expect.objectContaining({
      next: { revalidate: 60, tags: ['banners'] },
    }),
  );
});
it('uses sample banners for an unavailable or invalid response', async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce(Response.json({ items: [{}] }));
  const request = createTransport({ origin: 'http://localhost:4000', fetcher });
  await expect(getBanners(request)).resolves.toEqual(sampleBanners);
  await expect(getBanners(request)).resolves.toEqual(sampleBanners);
});
