import { beforeEach, expect, it, vi } from 'vitest';
import { createApi } from '../src/lib/api/domains';
import { createTransport } from '../src/lib/api/transport';

const mock = vi.hoisted(() => ({
  admin: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error('NOT_FOUND');
  }),
  redirect: vi.fn((href: string) => {
    throw new Error(href);
  }),
}));
vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({
  notFound: mock.notFound,
  redirect: mock.redirect,
}));
vi.mock('../src/lib/api/server', () => ({
  serverApi: { admin: { me: mock.admin } },
}));
import { requireAdminPage } from '../src/lib/admin/guard';

const wire = vi.fn<typeof fetch>();
beforeEach(() => {
  mock.admin.mockReset();
  wire.mockReset();
  const api = createApi(
    createTransport({
      origin: 'http://localhost:4000',
      getToken: async () => 'fixture-token',
      fetcher: wire,
    }),
  );
  mock.admin.mockImplementation(api.admin.me);
});

it('calls the private endpoint and maps a non-admin to notFound', async () => {
  wire.mockResolvedValueOnce(
    Response.json(
      { error: { code: 'FORBIDDEN', message: 'Forbidden' }, requestId: 'test' },
      { status: 403 },
    ),
  );
  await expect(requireAdminPage()).rejects.toThrow('NOT_FOUND');
  expect(wire).toHaveBeenCalledWith(
    new URL('http://localhost:4000/api/v1/admin/me'),
    expect.objectContaining({
      cache: 'no-store',
      headers: expect.any(Headers),
    }),
  );
  expect(
    new Headers(wire.mock.calls[0]?.[1]?.headers).get('authorization'),
  ).toBe('Bearer fixture-token');
});

it('only allows verified admin DTOs and propagates API outages', async () => {
  const identity = { id: '700000000000000000000001', isAdmin: true };
  wire.mockResolvedValueOnce(Response.json(identity)).mockResolvedValueOnce(
    Response.json(
      {
        error: { code: 'UNAVAILABLE', message: 'Offline' },
        requestId: 'test',
      },
      { status: 503 },
    ),
  );
  await expect(requireAdminPage()).resolves.toEqual(identity);
  await expect(requireAdminPage()).rejects.toMatchObject({
    status: 503,
    requestId: 'test',
  });
});
