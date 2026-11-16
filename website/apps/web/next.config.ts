import type { NextConfig } from 'next';
import {
  assertWebDeployment,
  cloudinaryImageName,
  isNonIndexableDeployment,
} from './src/config/deploy-env';

assertWebDeployment(process.env);

function apiOrigin() {
  try {
    const url = new URL(process.env.NEXT_PUBLIC_API_URL ?? '');
    return ['http:', 'https:'].includes(url.protocol) ? url.origin : '';
  } catch {
    return '';
  }
}

function clerkOrigin() {
  const key = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? '';
  const host = Buffer.from(
    key.replace(/^pk_(?:test|live)_/, ''),
    'base64url',
  ).toString('utf8');
  return /^[a-z\d](?:[a-z\d.-]*[a-z\d])?\$$/i.test(host)
    ? 'https://' + host.slice(0, -1)
    : '';
}

const production = process.env.NODE_ENV === 'production';
const hosted =
  process.env.DEPLOY_ENV === 'staging' ||
  process.env.DEPLOY_ENV === 'production';
const imageCloud = process.env.CLOUDINARY_IMAGE_CLOUD_NAME ?? '';
const enforcedPolicy =
  "base-uri 'self'; object-src 'none'; frame-ancestors 'none'";
const clerk = clerkOrigin();
const reportOnlyPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  `script-src 'self' ${clerk} https://challenges.cloudflare.com https://*.protect.clerk.com`,
  `connect-src 'self' ${apiOrigin()} ${clerk} https://*.protect.clerk.com:* https://api.cloudinary.com https://clerk-telemetry.com https://*.clerk-telemetry.com`,
  "img-src 'self' data: blob: https://res.cloudinary.com https://img.clerk.com https://images.clerk.dev https://images.unsplash.com",
  "style-src 'self'",
  "font-src 'self'",
  "worker-src 'self' blob:",
  'frame-src https://challenges.cloudflare.com https://*.protect.clerk.com',
].join('; ');

const nextConfig: NextConfig = {
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  pageExtensions:
    process.env.NODE_ENV === 'development'
      ? ['dev.tsx', 'tsx', 'ts']
      : ['tsx', 'ts'],
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          ...(production
            ? [
                {
                  key: 'Strict-Transport-Security',
                  value:
                    'max-age=' +
                    (hosted ? (process.env.WEB_HSTS_MAX_AGE ?? '300') : '300'),
                },
                {
                  key: 'Content-Security-Policy-Report-Only',
                  value: reportOnlyPolicy,
                },
              ]
            : []),
          ...(hosted
            ? [{ key: 'Content-Security-Policy', value: enforcedPolicy }]
            : []),
          ...(isNonIndexableDeployment(process.env)
            ? [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }]
            : []),
        ],
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        ...(cloudinaryImageName.test(imageCloud)
          ? { pathname: '/' + imageCloud + '/image/upload/**' }
          : {}),
      },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'img.clerk.com' },
      { protocol: 'https', hostname: 'images.clerk.dev' },
    ],
  },
};

export default nextConfig;
