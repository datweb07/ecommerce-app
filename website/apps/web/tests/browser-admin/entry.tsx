import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { AdminShell } from '../../src/components/admin/shell';
import { Dashboard } from '../../src/components/admin/dashboard';
import { AdminProducts } from '../../src/components/admin/products';
import {
  ProductEditor,
  ProductEditorRoute,
} from '../../src/components/admin/product-editor';
import {
  AdminOrderDetail,
  AdminOrders,
} from '../../src/components/admin/orders';
import { AdminCustomers } from '../../src/components/admin/customers';
import { AdminReviews } from '../../src/components/admin/reviews';
import { AdminBanners } from '../../src/components/admin/banners';
import {
  BannerEditor,
  BannerEditorRoute,
} from '../../src/components/admin/banner-editor';
import type { RouteQuery } from '../../src/lib/url-state';

const url = new URL(location.href);
const search: RouteQuery = Object.fromEntries(url.searchParams);
const last = url.pathname.split('/').at(-1) ?? '';
function FixturePage() {
  if (url.pathname === '/admin') return <Dashboard range="30d" />;
  if (url.pathname === '/admin/products')
    return <AdminProducts search={search} />;
  if (url.pathname === '/admin/products/new') return <ProductEditor />;
  if (url.pathname.startsWith('/admin/products/'))
    return <ProductEditorRoute id={last} />;
  if (url.pathname === '/admin/orders') return <AdminOrders search={search} />;
  if (url.pathname.startsWith('/admin/orders/'))
    return <AdminOrderDetail id={last} />;
  if (url.pathname === '/admin/customers')
    return <AdminCustomers search={search} />;
  if (url.pathname === '/admin/reviews')
    return <AdminReviews search={search} />;
  if (url.pathname === '/admin/banners') return <AdminBanners />;
  if (url.pathname === '/admin/banners/new') return <BannerEditor />;
  return <BannerEditorRoute id={last} />;
}
const root = document.getElementById('app');
if (!root) throw new Error('Preview root missing');
createRoot(root).render(
  <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <a href="#content" className="sr-only focus:not-sr-only">
        Bỏ qua điều hướng
      </a>
      <AdminShell>
        <FixturePage />
      </AdminShell>
    </QueryClientProvider>
  </ThemeProvider>,
);
