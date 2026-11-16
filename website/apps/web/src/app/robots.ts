import type { MetadataRoute } from 'next';
import { publicEnv } from '../config/public-env';
import { privateRoots } from '../lib/auth-paths';
import { isNonIndexableDeployment } from '../config/deploy-env';
export default function robots(): MetadataRoute.Robots {
  if (isNonIndexableDeployment(process.env)) {
    return { rules: { userAgent: '*', disallow: '/' } };
  }
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [...privateRoots, '/sign-in', '/sign-up', '/_dev'],
    },
    sitemap: new URL('/sitemap.xml', publicEnv.NEXT_PUBLIC_SITE_URL).href,
  };
}
