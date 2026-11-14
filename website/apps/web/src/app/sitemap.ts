import type { MetadataRoute } from 'next';
import { publicEnv } from '../config/public-env';
import { apiResult } from '../lib/api/result';
import { serverApi } from '../lib/api/server';

export const revalidate = 60;
const maxPages = 10;
const limit = '100';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const urls = new Map<string, MetadataRoute.Sitemap[number]>();
  const put = (path: string) => {
    const url = new URL(path, publicEnv.NEXT_PUBLIC_SITE_URL).href;
    urls.set(url, { url });
  };
  put('/');
  put('/products');
  for (let page = 1; page <= maxPages; page++) {
    const result = await apiResult(
      serverApi.products.list({ page: String(page), limit }),
    );
    if (!result.ok) break;
    for (const item of result.data.items) put('/products/' + item.id);
    if (result.data.page * result.data.limit >= result.data.total) break;
  }
  return Array.from(urls.values());
}
