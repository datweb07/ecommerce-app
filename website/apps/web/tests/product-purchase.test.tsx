// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import {
  Purchase,
  PurchaseControls,
} from '../src/components/catalogue/purchase';
import type { Product } from '../src/components/catalogue/product-grid';
import { queryKeys } from '../src/lib/query';

const mocks = vi.hoisted(() => ({
  env: {
    NEXT_PUBLIC_CLERK_SIGN_IN_URL: '/sign-in',
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: '',
  },
  getToken: async () => 'mock-token',
}));
vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({
    isLoaded: true,
    isSignedIn: true,
    getToken: mocks.getToken,
  }),
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('../src/config/public-env', () => ({
  publicEnv: {
    ...mocks.env,
    get NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY() {
      return mocks.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
    },
    NEXT_PUBLIC_API_URL: 'http://localhost:4000',
  },
}));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  mocks.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = '';
});

it('rolls back signed-in cart and favorite changes when write requests fail', async () => {
  mocks.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'mock';
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const empty = { items: [], version: 0 };
  client.setQueryData(queryKeys.cart, empty);
  const requests: ((response: Response) => void)[] = [];
  const fetcher = vi.fn(async (request: URL, init?: RequestInit) => {
    expect(new Headers(init?.headers).get('Authorization')).toBe(
      'Bearer mock-token',
    );
    if (init?.method === 'GET' && request.pathname.endsWith('/wishlist')) {
      return Response.json({ items: [], page: 1, limit: 100, total: 0 });
    }
    return new Promise<Response>((resolve) => requests.push(resolve));
  });
  vi.stubGlobal('fetch', fetcher);
  render(
    <QueryClientProvider client={client}>
      <Purchase product={product} cartMax={25} />
    </QueryClientProvider>,
  );
  const add = screen.getByRole<HTMLButtonElement>('button', {
    name: 'Thêm vào giỏ',
  });
  await userEvent.click(add);
  await waitFor(() =>
    expect(client.getQueryData(queryKeys.cart)).toMatchObject({
      items: [{ quantity: 1 }],
    }),
  );
  expect(add.disabled).toBe(true);
  await waitFor(() => expect(requests).toHaveLength(1));
  requests.shift()?.(
    Response.json(
      {
        error: { code: 'INSUFFICIENT_STOCK', message: 'stock' },
        requestId: 'cart-test',
      },
      { status: 409 },
    ),
  );
  await waitFor(() =>
    expect(client.getQueryData(queryKeys.cart)).toEqual(empty),
  );
  const wish = screen.getByRole<HTMLButtonElement>('button', {
    name: 'Lưu yêu thích',
  });
  await waitFor(() => expect(wish.disabled).toBe(false));
  await userEvent.click(wish);
  await waitFor(() => expect(wish.getAttribute('aria-pressed')).toBe('true'));
  await waitFor(() => expect(requests).toHaveLength(1));
  requests.shift()?.(
    Response.json(
      {
        error: { code: 'BAD_REQUEST', message: 'wishlist' },
        requestId: 'wish-test',
      },
      { status: 400 },
    ),
  );
  await waitFor(() => expect(wish.getAttribute('aria-pressed')).toBe('false'));
  expect(fetcher).toHaveBeenCalledTimes(3);
});
const product: Product = {
  id: '700000000000000000000001',
  name: 'Tai nghe',
  price: 75,
  images: [],
  description: 'Tai nghe',
  stock: 6,
  category: 'Electronics',
  averageRating: 0,
  totalReviews: 0,
  createdAt: null,
};

it('disables cart and hides quantity for out-of-stock products', async () => {
  const add = vi.fn();
  render(
    <PurchaseControls
      product={{ ...product, stock: 0 }}
      cartMax={25}
      quantity={1}
      setQuantity={() => undefined}
      add={add}
      wish={() => undefined}
    />,
  );
  const button = screen.getByRole<HTMLButtonElement>('button', {
    name: 'Thêm vào giỏ',
  });
  expect(button.disabled).toBe(true);
  expect(screen.queryByRole('spinbutton')).toBeNull();
  await userEvent.click(button);
  expect(add).not.toHaveBeenCalled();
});
it('redirects an anonymous add to sign-in with the complete product URL', async () => {
  const assign = vi.fn();
  const origin = 'http://localhost:3000';
  const pathname = '/products/' + product.id;
  vi.stubGlobal('location', { assign, origin, pathname, search: '?page=2' });
  render(<Purchase product={product} cartMax={2} />);
  expect(screen.getByRole('spinbutton').getAttribute('max')).toBe('2');
  await userEvent.click(screen.getByRole('button', { name: 'Thêm vào giỏ' }));
  const url = new URL(String(assign.mock.calls[0]?.[0]));
  expect(url.pathname).toBe('/sign-in');
  expect(url.searchParams.get('redirect_url')).toBe(
    origin + pathname + '?page=2',
  );
});
