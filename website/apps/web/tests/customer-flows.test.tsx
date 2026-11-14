// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import { CartPageContent } from '../src/components/customer/cart';
import { AddressForm } from '../src/components/customer/addresses';
import { CheckoutReturn } from '../src/components/customer/checkout-return';
import { OrderSnapshot, type Order } from '../src/components/customer/orders';
import {
  checkoutIntent,
  checkoutPollInterval,
  stripeCheckoutUrl,
} from '../src/lib/checkout-intent';
import { queryKeys } from '../src/lib/query';
import type { Cart } from '../src/lib/customer';
import type { ReactNode } from 'react';

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({
    userId: 'fixture-user',
    getToken: async () => 'fixture-token',
  }),
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const id = '700000000000000000000001';
const product = {
  id,
  name: 'Máy ảnh mẫu',
  description: '',
  images: [],
  stock: 10,
  price: 12,
  category: 'A',
  totalReviews: 0,
  averageRating: 0,
  createdAt: null,
};
const cart: Cart = {
  version: 3,
  items: [{ productId: id, product, status: 'available', quantity: 1 }],
};
function mount(children: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(<QueryClientProvider client={client}>{children}</QueryClientProvider>);
  return client;
}
it('blocks checkout when a cart item is missing', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      Response.json({
        version: 3,
        items: [
          { productId: id, product: null, status: 'deleted', quantity: 1 },
        ],
      }),
    ),
  );
  mount(<CartPageContent max={25} />);
  expect(
    await screen.findByRole('button', { name: 'Thanh toán' }),
  ).toHaveProperty('disabled', true);
  expect(screen.getAllByText('Sản phẩm đã bị xóa')).toHaveLength(2);
});
it('debounces absolute quantity, then rolls back and refetches on cart conflict', async () => {
  const resolve = vi.fn<(value: (response: Response) => void) => void>();
  const fetcher = vi.fn(async (_url: URL, init?: RequestInit) =>
    init?.method === 'PATCH'
      ? new Promise<Response>((respond) => resolve(respond))
      : Response.json(cart),
  );
  vi.stubGlobal('fetch', fetcher);
  const client = mount(<CartPageContent max={25} />);
  await userEvent.click(
    await screen.findByRole('button', { name: 'Tăng số lượng' }),
  );
  await waitFor(() =>
    expect(client.getQueryData(queryKeys.cart)).toMatchObject({
      items: [{ quantity: 2 }],
    }),
  );
  const patch = fetcher.mock.calls.find(([, init]) => init?.method === 'PATCH');
  expect(JSON.parse(String(patch?.[1]?.body))).toEqual({
    quantity: 2,
    version: 3,
  });
  resolve.mock.calls[0]?.[0](
    Response.json(
      {
        error: { code: 'CART_CHANGED', message: 'conflict' },
        requestId: 'fixture',
      },
      { status: 409 },
    ),
  );
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(3));
  await waitFor(() =>
    expect(client.getQueryData(queryKeys.cart)).toEqual(cart),
  );
});
it('validates address fields and submits the default flag', async () => {
  const save = vi.fn();
  render(<AddressForm busy={false} save={save} />);
  await userEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
  expect(
    await screen.findAllByText('Thông tin bắt buộc hoặc sai định dạng.'),
  ).toHaveLength(7);
  for (const label of [
    'Nhãn địa chỉ',
    'Người nhận',
    'Địa chỉ đường phố',
    'Thành phố',
    'Tỉnh hoặc bang',
    'Mã bưu chính',
  ]) {
    fireEvent.change(screen.getByLabelText(label), {
      target: { value: 'Hợp lệ' },
    });
  }
  fireEvent.change(screen.getByLabelText('Số điện thoại'), {
    target: { value: '0900123456' },
  });
  await userEvent.click(screen.getByRole('checkbox'));
  await userEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
  await waitFor(() =>
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ isDefault: true, phoneNumber: '0900123456' }),
      expect.anything(),
    ),
  );
});
it('reuses an identical checkout intent and changes key when cart or address changes', () => {
  const input = { addressId: id, version: 5 };
  const attempt = checkoutIntent(input, null);
  expect(checkoutIntent(input, attempt)).toEqual(attempt);
  expect(checkoutIntent({ ...input, version: 6 }, attempt).key).not.toBe(
    attempt.key,
  );
  expect(
    checkoutIntent({ ...input, addressId: '700000000000000000000002' }, attempt)
      .key,
  ).not.toBe(attempt.key);
  expect(stripeCheckoutUrl('https://example.com/pay')).toBeNull();
  expect(checkoutPollInterval(10, 89_000)).toBe(1000);
  expect(checkoutPollInterval(10, 90_000)).toBe(false);
});
const session = {
  id,
  url: null,
  expiresAt: '2026-11-15T12:00:00.000Z',
  orderId: null,
  requiresReconciliation: false,
};
it('changes pending to paid only after API confirms', async () => {
  const fetcher = vi
    .fn()
    .mockImplementationOnce(async () =>
      Response.json({ ...session, status: 'pending' }),
    )
    .mockImplementation(async () =>
      Response.json({ ...session, status: 'paid', orderId: id }),
    );
  vi.stubGlobal('fetch', fetcher);
  mount(<CheckoutReturn id={id} />);
  expect(await screen.findByText(/Đang chờ Stripe/)).toBeTruthy();
  expect(screen.queryByRole('link', { name: 'Xem đơn hàng' })).toBeNull();
  await userEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
  expect(
    (await screen.findByRole('link', { name: 'Xem đơn hàng' })).getAttribute(
      'href',
    ),
  ).toBe('/account/orders/' + id);
});
it('offers retry for an expired session', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json({ ...session, status: 'expired' })),
  );
  mount(<CheckoutReturn id={id} />);
  expect(
    await screen.findByRole('link', { name: 'Thử thanh toán lại' }),
  ).toBeTruthy();
  expect(screen.queryByRole('link', { name: 'Xem đơn hàng' })).toBeNull();
});
const order: Order = {
  id,
  status: 'delivered',
  totalPrice: 22,
  createdAt: null,
  shippedAt: null,
  deliveredAt: null,
  shippingAddress: {
    fullName: 'Khách thử',
    streetAddress: 'Một',
    city: 'Hai',
    state: 'Ba',
    zipCode: '10000',
    phoneNumber: '0900000000',
  },
  items: [
    {
      productId: id,
      name: 'Tên được lưu lúc mua',
      quantity: 1,
      price: 12,
      image: '',
      canReview: false,
      review: null,
    },
  ],
};
it('renders line items from order snapshots without fetching live products', () => {
  const fetcher = vi.fn();
  vi.stubGlobal('fetch', fetcher);
  render(<OrderSnapshot order={order} />);
  expect(screen.getByText('Tên được lưu lúc mua')).toBeTruthy();
  expect(fetcher).not.toHaveBeenCalled();
});
