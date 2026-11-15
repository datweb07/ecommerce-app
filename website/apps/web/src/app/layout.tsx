import type { Metadata } from 'next';
import localFont from 'next/font/local';
import type { ReactNode } from 'react';
import { publicEnv } from '../config/public-env';
import { site } from '../config/site';
import { t } from '../lib/i18n';
import { Providers } from '../components/layout/providers';
import './globals.css';

const inter = localFont({
  src: [
    {
      path: '../../node_modules/@fontsource-variable/inter/files/inter-vietnamese-wght-normal.woff2',
      weight: '100 900',
    },
    {
      path: '../../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2',
      weight: '100 900',
    },
  ],
  display: 'swap',
  variable: '--font-inter',
});
export const metadata: Metadata = {
  metadataBase: new URL(publicEnv.NEXT_PUBLIC_SITE_URL),
  title: {
    default: 'ShopEase | Mua sắm trực tuyến',
    template: '%s | ShopEase',
  },
  description: site.description,
  openGraph: {
    title: site.name,
    siteName: site.name,
    description: site.description,
    locale: 'vi_VN',
    type: 'website',
  },
};
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi" suppressHydrationWarning className={inter.variable}>
      <body className="flex min-h-dvh flex-col">
        <Providers>
          <a
            href="#content"
            className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-70 focus:rounded-control focus:bg-card focus:p-3"
          >
            {t('nav', 'skip')}
          </a>
          {children}
        </Providers>
      </body>
    </html>
  );
}
