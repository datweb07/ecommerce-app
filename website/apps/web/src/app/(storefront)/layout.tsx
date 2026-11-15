import type { ReactNode } from 'react';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { ScrollToTop } from '@/components/layout/scroll-to-top';

export default function StorefrontLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <>
      <Header />
      <main id="content" tabIndex={-1} className="flex-1">
        {children}
      </main>
      <Footer />
      <ScrollToTop />
    </>
  );
}
