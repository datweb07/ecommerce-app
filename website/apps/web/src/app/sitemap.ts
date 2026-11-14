import type { MetadataRoute } from 'next';
import { publicEnv } from '../config/public-env';
export default function sitemap(): MetadataRoute.Sitemap {
  return ['/', '/products'].map((path) => ({
    url: new URL(path, publicEnv.NEXT_PUBLIC_SITE_URL).href,
  }));
}
