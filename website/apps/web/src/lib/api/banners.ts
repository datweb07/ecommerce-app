import { publicBannerList, sampleBanners } from '@storefront/shared';
import type { ApiRequest } from './transport';

export async function getBanners(request: ApiRequest) {
  try {
    const result = await request('/api/v1/banners', {
      schema: publicBannerList,
      next: { revalidate: 60, tags: ['banners'] },
    });
    return result.items;
  } catch {
    return sampleBanners;
  }
}
