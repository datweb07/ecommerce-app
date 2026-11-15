// @vitest-environment jsdom
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { AdminCustomers } from '../src/components/admin/customers';
import { AdminOrderDetail } from '../src/components/admin/orders';
import { AdminReviews } from '../src/components/admin/reviews';

const mock = vi.hoisted(() => ({ push: vi.fn(), error: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mock.push }) }));
vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ getToken: async () => 'fixture-token' }),
}));
vi.mock('sonner', () => ({ toast: { error: mock.error, success: vi.fn() } }));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

const id = '700000000000000000000001';
const date = '2026-01-01T12:30:00.000Z';
function mount(children: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(<QueryClientProvider client={client}>{children}</QueryClientProvider>);
}

it('builds a shareable URL for a filter and keeps it on the next page', async () => {
  const fetcher = vi.fn(async () =>
    Response.json({
      page: 2,
      limit: 1,
      total: 3,
      items: [
        {
          id,
          name: 'An',
          email: 'an@example.test',
          createdAt: date,
          orderCount: 1,
          totalSpent: 49,
        },
      ],
    }),
  );
  vi.stubGlobal('fetch', fetcher);
  mount(
    <AdminCustomers
      search={{ q: 'an', page: '2', limit: '1', other: 'ignored' }}
    />,
  );
  expect(await screen.findByText('an@example.test')).toBeTruthy();
  expect(
    screen.getByRole('link', { name: 'Trang sau' }).getAttribute('href'),
  ).toBe('/admin/customers?page=3&limit=1&q=an');
  await userEvent.clear(screen.getByLabelText('Tên hoặc email'));
  await userEvent.type(screen.getByLabelText('Tên hoặc email'), 'Bình');
  await userEvent.click(screen.getByRole('button', { name: 'Áp dụng' }));
  expect(mock.push).toHaveBeenCalledWith(
    '/admin/customers?q=B%C3%ACnh&limit=1',
  );
  expect(fetcher).toHaveBeenCalledWith(
    expect.objectContaining({ search: '?page=2&limit=1&q=an' }),
    expect.objectContaining({ cache: 'no-store' }),
  );
});

it('only sends the next order status, confirms the action and refetches on a conflict', async () => {
  let status = 'pending';
  const fetcher = vi.fn(async (_url: URL, options?: RequestInit) => {
    if (options?.method === 'PATCH') {
      status = 'delivered';
      return Response.json(
        {
          error: { code: 'ORDER_STATUS_CONFLICT', message: 'Changed' },
          requestId: 'fixture',
        },
        { status: 409 },
      );
    }
    return Response.json({
      id,
      status,
      totalPrice: 25,
      itemCount: 1,
      createdAt: date,
      shippedAt: null,
      deliveredAt: null,
      items: [
        {
          productId: id,
          name: 'Tên lúc mua',
          price: 25,
          quantity: 1,
          image: '',
        },
      ],
      customer: null,
      shippingAddress: {
        fullName: 'An',
        streetAddress: '1 Đường A',
        city: 'Thành phố',
        state: 'Tỉnh',
        zipCode: '12345',
        phoneNumber: '1234567890',
      },
      paymentReference: null,
    });
  });
  vi.stubGlobal('fetch', fetcher);
  mount(<AdminOrderDetail id={id} />);
  expect(await screen.findByText('Tên lúc mua')).toBeTruthy();
  await userEvent.click(
    screen.getByRole('button', { name: 'Đánh dấu đang giao' }),
  );
  expect(
    fetcher.mock.calls.filter(([, opt]) => opt?.method === 'PATCH'),
  ).toHaveLength(0);
  await userEvent.click(
    within(screen.getByRole('alertdialog')).getByRole('button', {
      name: 'Đánh dấu đang giao',
    }),
  );
  await waitFor(() =>
    expect(
      fetcher.mock.calls.find(([, opt]) => opt?.method === 'PATCH')?.[1]?.body,
    ).toBe(JSON.stringify({ expectedStatus: 'pending', status: 'shipped' })),
  );
  await waitFor(() =>
    expect(
      screen.queryByRole('button', { name: 'Đánh dấu đang giao' }),
    ).toBeNull(),
  );
  expect(mock.error).toHaveBeenCalledWith(expect.stringContaining('tải lại'));
});

it('requires confirmation before deleting a review and refetches the list', async () => {
  let removed = false;
  const fetcher = vi.fn(async (_url: URL, options?: RequestInit) => {
    if (options?.method === 'DELETE') {
      removed = true;
      return Response.json({ deleted: true });
    }
    return Response.json({
      page: 1,
      limit: 20,
      total: removed ? 0 : 1,
      items: removed
        ? []
        : [
            {
              id,
              productId: id,
              productName: 'Mũ',
              displayName: 'Khách thử',
              rating: 5,
              createdAt: date,
            },
          ],
    });
  });
  vi.stubGlobal('fetch', fetcher);
  mount(<AdminReviews search={{ rating: '5' }} />);
  await screen.findByText('Khách thử');
  await userEvent.click(screen.getByRole('button', { name: 'Xóa' }));
  expect(removed).toBe(false);
  await userEvent.click(
    within(screen.getByRole('alertdialog')).getByRole('button', {
      name: 'Xóa',
    }),
  );
  await screen.findByText('Chưa có dữ liệu phù hợp.');
  expect(removed).toBe(true);
});
