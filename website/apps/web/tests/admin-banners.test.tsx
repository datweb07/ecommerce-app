// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { BannerEditor } from '../src/components/admin/banner-editor';
import { AdminBanners } from '../src/components/admin/banners';
import { initialTarget, targetPath } from '../src/lib/admin/banner-target';

const mock = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => mock }));
vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ getToken: async () => 'test-token' }),
}));
vi.mock('../src/lib/admin/revalidate', () => ({
  revalidateAdminStorefront: vi.fn(async () => true),
}));
vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

const id = '700000000000000000000001';
const date = '2026-02-02T15:30:00.000Z';
const imageDesktop = {
  url: '/banners/headphones-desktop.webp',
  width: 1200,
  height: 500,
  publicId: 'seed/desktop',
};
const imageMobile = {
  url: '/banners/headphones-mobile.webp',
  width: 540,
  height: 675,
  publicId: 'seed/mobile',
};
const banner = {
  id,
  imageDesktop,
  imageMobile,
  alt: 'Tai nghe phiên bản mới',
  title: 'Hàng vừa về',
  subtitle: null,
  ctaLabel: null,
  href: '/products',
  isActive: true,
  sortOrder: 0,
  startsAt: null,
  endsAt: null,
  createdAt: date,
  updatedAt: date,
};
const another = {
  ...banner,
  id: '700000000000000000000002',
  title: 'Bộ sưu tập mùa đông',
  sortOrder: 1,
};
function mount(children: ReactNode) {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(<QueryClientProvider client={client}>{children}</QueryClientProvider>);
}

it('normalizes allowed links and rejects external links and escaped authorities', () => {
  const origin = 'http://localhost:3000';
  expect(targetPath('product', id, origin)).toBe('/products/' + id);
  expect(targetPath('category', 'Áo khoác', origin)).toBe(
    '/products?category=%C3%81o+kho%C3%A1c',
  );
  expect(targetPath('custom', origin + '/products', origin)).toBe('/products');
  for (const href of [
    'https://evil.test/',
    '//evil.test',
    'javascript:alert(1)',
    '/a/..//evil.test',
    '/%2f/evil.test',
  ])
    expect(targetPath('custom', href, origin)).toBeNull();
  expect(initialTarget('/products/' + id)).toEqual({
    kind: 'product',
    value: id,
  });
  expect(initialTarget('/products?category=Summer&q=top')).toEqual({
    kind: 'custom',
    value: '/products?category=Summer&q=top',
  });
});

it('checks image dimensions before signature and previews the actual mobile asset in dark mode', async () => {
  const fetcher = vi.fn(async () => Response.json({ items: [] }));
  vi.stubGlobal('fetch', fetcher);
  vi.stubGlobal(
    'createImageBitmap',
    vi.fn(async () => ({ width: 100, height: 100, close: vi.fn() })),
  );
  mount(<BannerEditor banner={banner} />);
  const preview = screen.getByTestId('admin-banner-preview');
  expect(within(preview).getByRole('img').getAttribute('src')).toContain(
    'headphones-desktop',
  );
  await userEvent.selectOptions(
    screen.getByLabelText('Thiết bị xem trước'),
    'mobile',
  );
  await userEvent.selectOptions(
    screen.getByLabelText('Giao diện xem trước'),
    'dark',
  );
  expect(preview.classList.contains('dark')).toBe(true);
  expect(within(preview).getByRole('img').getAttribute('src')).toContain(
    'headphones-mobile',
  );
  await userEvent.upload(
    screen.getByLabelText(/Ảnh máy tính/),
    new File(['fixture'], 'fixture.png', { type: 'image/png' }),
  );
  await screen.findByText(
    'Không đọc được ảnh hoặc ảnh có kích thước, tỉ lệ chưa phù hợp.',
  );
  expect(fetcher).not.toHaveBeenCalled();
});

it('saves a real category target while preserving seed images and rejects a foreign URL', async () => {
  const fetcher = vi.fn(async (url: URL, options?: RequestInit) =>
    Response.json(
      url.pathname.endsWith('/categories')
        ? { items: ['Phụ kiện'] }
        : {
            ...banner,
            href: '/products?category=Ph%E1%BB%A5+ki%E1%BB%87n',
            options: options?.method,
          },
    ),
  );
  vi.stubGlobal('fetch', fetcher);
  mount(<BannerEditor banner={banner} />);
  const custom = screen.getByLabelText('Đường dẫn nội bộ');
  fireEvent.change(custom, { target: { value: 'https://other.example.test' } });
  await userEvent.click(screen.getByRole('button', { name: 'Lưu' }));
  await screen.findByText(
    'Hãy chọn sản phẩm, danh mục hoặc đường dẫn thuộc cửa hàng.',
  );
  expect(fetcher).not.toHaveBeenCalled();
  await userEvent.selectOptions(
    screen.getByRole('combobox', { name: 'Đích khi bấm' }),
    'category',
  );
  await screen.findByRole('option', { name: 'Phụ kiện' });
  await userEvent.selectOptions(
    screen.getByLabelText('Chọn danh mục'),
    'Phụ kiện',
  );
  await userEvent.click(screen.getByRole('button', { name: 'Lưu' }));
  await waitFor(() => {
    const patch = fetcher.mock.calls.find(
      ([, options]) => options?.method === 'PATCH',
    )?.[1];
    expect(JSON.parse(String(patch?.body))).toMatchObject({
      href: '/products?category=Ph%E1%BB%A5+ki%E1%BB%87n',
    });
    expect(JSON.parse(String(patch?.body))).not.toHaveProperty('imageDesktop');
  });
});

it('supports keyboard and pointer reorder through the same atomic endpoint', async () => {
  let rows = [banner, another];
  const fetcher = vi.fn(async (_url: URL, opts?: RequestInit) => {
    if (opts?.method === 'PUT') {
      const request = JSON.parse(String(opts.body)) as { ids: string[] };
      rows = request.ids.map((key) => (key === id ? banner : another));
      return Response.json(request);
    }
    return Response.json({ page: 1, limit: 50, total: 2, items: rows });
  });
  vi.stubGlobal('fetch', fetcher);
  mount(<AdminBanners />);
  const up = await screen.findByRole('button', {
    name: 'Lên · Bộ sưu tập mùa đông',
  });
  up.focus();
  await userEvent.keyboard('{Enter}');
  await waitFor(() =>
    expect(screen.getAllByRole('listitem')[0]?.textContent).toContain(
      'Bộ sưu tập mùa đông',
    ),
  );
  const first = screen.getAllByRole('listitem')[0];
  const second = screen.getAllByRole('listitem')[1];
  const drag = first?.querySelector('[draggable="true"]');
  if (!drag || !second) throw new Error('Drag controls missing');
  const dataTransfer = {
    setData: vi.fn(),
    effectAllowed: 'none',
    dropEffect: 'none',
  };
  fireEvent.dragStart(drag, { dataTransfer });
  fireEvent.dragOver(second, { dataTransfer });
  fireEvent.drop(second, { dataTransfer });
  await waitFor(() =>
    expect(screen.getAllByRole('listitem')[0]?.textContent).toContain(
      'Hàng vừa về',
    ),
  );
  expect(
    fetcher.mock.calls
      .filter(([, options]) => options?.method === 'PUT')
      .map(([, options]) => JSON.parse(String(options?.body))),
  ).toEqual([{ ids: [another.id, id] }, { ids: [id, another.id] }]);
});
