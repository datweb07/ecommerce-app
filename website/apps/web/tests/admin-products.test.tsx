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
import { ProductEditor } from '../src/components/admin/product-editor';

const mock = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  revalidate: vi.fn(),
  warning: vi.fn(),
  success: vi.fn(),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mock.push, replace: mock.replace }),
}));
vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ getToken: async () => 'fixture-token' }),
}));
vi.mock('../src/lib/admin/revalidate', () => ({
  revalidateAdminStorefront: mock.revalidate,
}));
vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: mock.success, warning: mock.warning },
}));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.resetAllMocks();
});

const id = '700000000000000000000001';
const asset = (name: string) => ({
  url: 'https://res.cloudinary.com/test/image/upload/' + name + '.png',
  publicId: 'products/' + name,
});
const images = [asset('one'), asset('two')];
type FixtureFetch = (url: URL, options?: RequestInit) => Promise<Response>;
const product = {
  id,
  name: 'Túi mua sắm',
  category: 'Túi',
  description: 'Mô tả sản phẩm',
  price: 12,
  stock: 10,
  images: images.map(({ url }) => url),
  imageAssets: images,
  totalReviews: 0,
  averageRating: 0,
  createdAt: null,
  stockStatus: 'available' as const,
};
function mount(children: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(<QueryClientProvider client={client}>{children}</QueryClientProvider>);
}
const fixtureSign = {
  uploadUrl: 'https://api.cloudinary.com/v1_1/test/image/upload',
  apiKey: 'fixture',
  signature: 'fixture',
  expiresAt: '2026-02-01T00:00:00.000Z',
  maxBytes: 5242880,
  params: {
    timestamp: 1,
    asset_folder: 'products',
    public_id: 'products/mock',
    type: 'upload',
    overwrite: false,
    allowed_formats: 'jpg,jpeg,png,webp,avif',
  },
};
it('blocks invalid fields and rejects invalid files and upload failure visibly', async () => {
  const fetcher = vi.fn(async (url: URL) =>
    Response.json(
      url.pathname.endsWith('signature') ? fixtureSign : { items: [] },
    ),
  );
  vi.stubGlobal('fetch', fetcher);
  class FailedUpload {
    upload = {};
    onerror?: () => void;
    open() {}
    send() {
      this.onerror?.();
    }
  }
  vi.stubGlobal('XMLHttpRequest', FailedUpload);
  mount(<ProductEditor />);
  await userEvent.click(screen.getByRole('button', { name: 'Lưu' }));
  expect((await screen.findAllByRole('alert')).length).toBeGreaterThan(0);
  const picker = screen.getByLabelText(/Chọn ảnh hoặc kéo thả/);
  await userEvent.upload(
    picker,
    new File(['text'], 'file.txt', { type: 'text/plain' }),
    { applyAccept: false },
  );
  await screen.findByText('Định dạng ảnh không được hỗ trợ.');
  await userEvent.upload(
    picker,
    new File(['image'], 'fixture.png', { type: 'image/png' }),
  );
  await screen.findByText(
    'Tải ảnh thất bại. Vui lòng chọn lại tệp để thử lại.',
  );
  expect(
    fetcher.mock.calls.filter(([url]) => url.pathname.endsWith('signature')),
  ).toHaveLength(1);
});
it('puts the selected cover first and retains successful save if revalidating fails', async () => {
  mock.revalidate.mockRejectedValueOnce(new Error('Offline'));
  const fetcher = vi.fn<FixtureFetch>(async (url) =>
    Response.json(
      url.pathname.endsWith('/categories')
        ? { items: ['Túi'] }
        : {
            ...product,
            imageAssets: [images[1], images[0]],
          },
    ),
  );
  vi.stubGlobal('fetch', fetcher);
  mount(<ProductEditor product={product} />);
  const [disabled, cover] = screen.getAllByRole('button', {
    name: 'Đặt làm ảnh bìa',
  });
  expect(disabled).toHaveProperty('disabled', true);
  if (!cover) throw new Error('Second image missing');
  await userEvent.click(cover);
  await userEvent.click(screen.getByRole('button', { name: 'Lưu' }));
  await waitFor(() => expect(mock.warning).toHaveBeenCalled());
  const patch = fetcher.mock.calls.find(
    ([, opts]) => opts?.method === 'PATCH',
  )?.[1];
  expect(JSON.parse(String(patch?.body))).toMatchObject({
    images: [images[1], images[0]],
  });
  expect(JSON.parse(String(patch?.body))).not.toHaveProperty('stock');
  expect(mock.success).toHaveBeenCalledWith('Đã lưu thay đổi.');
});
it('submits a signed stock delta and reason through the stock endpoint', async () => {
  mock.revalidate.mockResolvedValueOnce(true);
  const fetcher = vi.fn<FixtureFetch>(async (url) =>
    Response.json(
      url.pathname.endsWith('/categories')
        ? { items: [] }
        : { ...product, stock: 7 },
    ),
  );
  vi.stubGlobal('fetch', fetcher);
  mount(<ProductEditor product={product} />);
  await userEvent.click(screen.getByRole('button', { name: 'Điều chỉnh tồn' }));
  const dialog = within(screen.getByRole('dialog'));
  fireEvent.change(dialog.getByLabelText('Số lượng thay đổi (+/−)'), {
    target: { value: '-3' },
  });
  await userEvent.selectOptions(dialog.getByLabelText('Lý do'), 'damage');
  await userEvent.click(dialog.getByRole('button', { name: 'Lưu' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  const call = fetcher.mock.calls.find(([url]) =>
    url.pathname.endsWith('/stock'),
  );
  expect(call?.[1]).toMatchObject({
    method: 'POST',
    body: JSON.stringify({ delta: -3, reason: 'damage' }),
  });
});
