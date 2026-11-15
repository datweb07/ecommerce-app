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
import { Checkout } from '../src/components/customer/checkout';
import { Inbox } from '../src/components/customer/inbox';
import { OrderDetail } from '../src/components/customer/orders';
import { focusManager } from '@tanstack/react-query';
import { OrderSnapshot, type Order } from '../src/components/customer/orders';
import {
  checkoutIntent,
  checkoutPollInterval,
  stripeCheckoutUrl,
} from '../src/lib/checkout-intent';
import { queryKeys } from '../src/lib/query';
import type { Cart } from '../src/lib/customer';
import type { ReactNode } from 'react';

const push = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
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
  localStorage.clear();
  focusManager.setFocused(undefined);
  push.mockClear();
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

it.each(['CART_CHANGED', 'INSUFFICIENT_STOCK'])(
  'refreshes cart and explains checkout conflict %s',
  async (code) => {
    const address = {
      id,
      label: 'Nhà',
      fullName: 'Khách',
      streetAddress: 'Một',
      city: 'Hai',
      state: 'Ba',
      zipCode: '40000',
      phoneNumber: '0900000000',
      isDefault: true,
    };
    let cartReads = 0;
    const fetcher = vi.fn(async (url: URL, init?: RequestInit) => {
      if (url.pathname.endsWith('/cart')) {
        cartReads++;
        return Response.json(
          cartReads === 1
            ? cart
            : {
                ...cart,
                version: 4,
                items: [{ ...cart.items[0], status: 'insufficient_stock' }],
              },
        );
      }
      if (url.pathname.endsWith('/addresses'))
        return Response.json({ items: [address] });
      if (url.pathname.endsWith('/quote'))
        return Response.json({
          currency: 'usd',
          subtotalCents: 1200,
          shippingCents: 1000,
          taxCents: 96,
          totalCents: 2296,
        });
      expect(JSON.parse(String(init?.body))).toEqual({
        addressId: id,
        version: 3,
      });
      expect(new Headers(init?.headers).get('Idempotency-Key')).toMatch(
        /^[a-f0-9-]{36}$/,
      );
      return Response.json(
        {
          error: { code, message: 'fixture error' },
          requestId: 'checkout-fixture',
        },
        { status: 409 },
      );
    });
    vi.stubGlobal('fetch', fetcher);
    mount(<Checkout />);
    await userEvent.click(
      await screen.findByRole('button', { name: 'Xem lại đơn hàng' }),
    );
    expect(await screen.findByText('$22.96')).toBeTruthy();
    await userEvent.click(
      screen.getByRole('button', { name: 'Thanh toán qua Stripe' }),
    );
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(await screen.findByText(product.name)).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: 'Thanh toán qua Stripe' }),
    ).toBeNull();
    expect(push).not.toHaveBeenCalled();
  },
);

it('creates, edits and deletes a rating from the order using the API', async () => {
  let currentReview: { id: string; rating: number } | null = null;
  const methods: string[] = [];
  const fetcher = vi.fn(async (url: URL, init?: RequestInit) => {
    if (url.pathname.includes('/orders/')) {
      return Response.json({
        ...order,
        items: [
          {
            ...order.items[0],
            canReview: !currentReview,
            review: currentReview,
          },
        ],
      });
    }
    methods.push(init?.method ?? '');
    if (init?.method === 'DELETE') {
      currentReview = null;
      return Response.json({ received: true });
    }
    const input = JSON.parse(String(init?.body));
    currentReview = { id, rating: input.rating };
    return Response.json(
      { ...currentReview, productId: id, orderId: id, createdAt: null },
      { status: init?.method === 'POST' ? 201 : 200 },
    );
  });
  vi.stubGlobal('fetch', fetcher);
  mount(<OrderDetail id={id} />);
  await userEvent.click(await screen.findByRole('radio', { name: '3 sao' }));
  await userEvent.click(screen.getByRole('button', { name: 'Gửi đánh giá' }));
  await waitFor(() =>
    expect(screen.getByRole('radio', { name: '3 sao' })).toHaveProperty(
      'checked',
      true,
    ),
  );
  const save = await screen.findByRole('button', { name: 'Lưu đánh giá' });
  await userEvent.click(screen.getByRole('radio', { name: '4 sao' }));
  await waitFor(() => expect(save).toHaveProperty('disabled', false));
  await userEvent.click(save);
  await waitFor(() => expect(methods).toEqual(['POST', 'PATCH']));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Xóa đánh giá' })).toHaveProperty(
      'disabled',
      false,
    ),
  );
  await userEvent.click(screen.getByRole('button', { name: 'Xóa đánh giá' }));
  await userEvent.click(screen.getByRole('button', { name: 'Xác nhận' }));
  await waitFor(() => expect(methods).toEqual(['POST', 'PATCH', 'DELETE']));
  expect(
    await screen.findByRole('button', { name: 'Gửi đánh giá' }),
  ).toBeTruthy();
});

it('reads one notification, navigates to the order, then marks remaining items read', async () => {
  const time = '2026-11-15T12:00:00.000Z';
  const other = '700000000000000000000002';
  const rows = [id, other].map((value) => ({
    id: value,
    orderId: id,
    status: 'shipped',
    occurredAt: time,
    createdAt: time,
    readAt: null as string | null,
  }));
  const fetcher = vi.fn(async (url: URL, init?: RequestInit) => {
    if (init?.method === 'PATCH') {
      rows[0]!.readAt = time;
      return Response.json(rows[0]);
    }
    if (init?.method === 'POST') {
      rows[1]!.readAt = time;
      return Response.json({ readCount: 1, cutoff: time });
    }
    return Response.json({
      items: rows,
      unreadCount: rows.filter((row) => !row.readAt).length,
      nextCursor: null,
    });
  });
  vi.stubGlobal('fetch', fetcher);
  mount(<Inbox />);
  const read = await screen.findAllByRole('button', {
    name: 'Đánh dấu đã đọc và xem đơn',
  });
  await userEvent.click(read[0]!);
  await waitFor(() =>
    expect(push).toHaveBeenCalledWith('/account/orders/' + id),
  );
  await userEvent.click(
    screen.getByRole('button', { name: 'Đánh dấu tất cả đã đọc' }),
  );
  await waitFor(() =>
    expect(screen.getByText('0 thông báo chưa đọc')).toBeTruthy(),
  );
  expect(
    screen.queryByRole('button', { name: 'Đánh dấu đã đọc và xem đơn' }),
  ).toBeNull();
});

it('replays the same checkout key and payload after an interrupted request and remount', async () => {
  const address = {
    id,
    label: 'Nhà',
    fullName: 'Khách',
    streetAddress: 'Một',
    city: 'Hai',
    state: 'Ba',
    zipCode: '40000',
    phoneNumber: '0900000000',
    isDefault: true,
  };
  const attempts: { key: string | null; body: BodyInit | null | undefined }[] =
    [];
  const fetcher = vi.fn(async (url: URL, init?: RequestInit) => {
    if (url.pathname.endsWith('/cart'))
      return Response.json(attempts.length ? { ...cart, version: 4 } : cart);
    if (url.pathname.endsWith('/addresses'))
      return Response.json({ items: [address] });
    if (url.pathname.endsWith('/quote'))
      return Response.json({
        currency: 'usd',
        subtotalCents: 1200,
        shippingCents: 1000,
        taxCents: 96,
        totalCents: 2296,
      });
    attempts.push({
      key: new Headers(init?.headers).get('Idempotency-Key'),
      body: init?.body,
    });
    if (attempts.length === 1) throw new TypeError('offline');
    return Response.json({ ...session, status: 'pending' });
  });
  vi.stubGlobal('fetch', fetcher);
  mount(<Checkout />);
  await userEvent.click(
    await screen.findByRole('button', { name: 'Xem lại đơn hàng' }),
  );
  await userEvent.click(
    await screen.findByRole('button', { name: 'Thanh toán qua Stripe' }),
  );
  expect(await screen.findByText(/Không kết nối được/)).toBeTruthy();
  cleanup();
  mount(<Checkout />);
  await userEvent.click(
    await screen.findByRole('button', {
      name: 'Thử lại phiên thanh toán trước',
    }),
  );
  await waitFor(() =>
    expect(push).toHaveBeenCalledWith('/checkout/return?checkoutId=' + id),
  );
  expect(attempts).toHaveLength(2);
  expect(attempts[1]).toEqual(attempts[0]);
  expect(JSON.parse(String(attempts[1]?.body))).toEqual({
    addressId: id,
    version: 3,
  });
});

it('does not poll the inbox while TanStack detects a hidden tab', async () => {
  focusManager.setFocused(false);
  const fetcher = vi.fn(async () =>
    Response.json({ items: [], unreadCount: 0, nextCursor: null }),
  );
  vi.stubGlobal('fetch', fetcher);
  vi.useFakeTimers();
  try {
    mount(<Inbox />);
    await vi.advanceTimersByTimeAsync(121_000);
    expect(fetcher).toHaveBeenCalledTimes(1);
    focusManager.setFocused(true);
    await vi.advanceTimersByTimeAsync(61_000);
    expect(fetcher.mock.calls.length).toBeGreaterThan(1);
  } finally {
    cleanup();
    vi.useRealTimers();
  }
});

it('keeps the order review editor available when the API rejects a rating', async () => {
  const fetcher = vi.fn(async (url: URL) => {
    if (url.pathname.includes('/orders/')) {
      return Response.json({
        ...order,
        items: [{ ...order.items[0], canReview: true }],
      });
    }
    return Response.json(
      {
        error: { code: 'REVIEW_INELIGIBLE', message: 'fixture' },
        requestId: 'review-fixture',
      },
      { status: 409 },
    );
  });
  vi.stubGlobal('fetch', fetcher);
  const { toast } = await import('sonner');
  mount(<OrderDetail id={id} />);
  await userEvent.click(await screen.findByRole('radio', { name: '3 sao' }));
  await userEvent.click(screen.getByRole('button', { name: 'Gửi đánh giá' }));
  await waitFor(() =>
    expect(toast.error).toHaveBeenCalledWith(
      'Chỉ đánh giá được sản phẩm thuộc đơn đã giao.',
    ),
  );
  expect(screen.getByRole('button', { name: 'Gửi đánh giá' })).toBeTruthy();
});
