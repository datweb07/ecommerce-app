import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { parseEnv, publicSchema, serverSchema } from '../src/config/env-schema';
import {
  ApiError,
  apiErrorMessage,
  createTransport,
  newIdempotencyKey,
} from '../src/lib/api/transport';
import { createApi } from '../src/lib/api/domains';
import { formatMoney } from '../src/lib/money';
import { toSearchParams, withPage } from '../src/lib/url-state';
import { verifyOpenApi } from '../src/lib/api/openapi-contract';

describe('web config and values', () => {
  it('names missing public variables and rejects malformed internal origin', () => {
    expect(() => parseEnv(publicSchema, {})).toThrow(/NEXT_PUBLIC_SITE_URL/);
    expect(() =>
      parseEnv(serverSchema, {
        API_INTERNAL_URL: 'file:///private',
        CURRENCY: 'usd',
      }),
    ).toThrow(/API_INTERNAL_URL/);
  });
  it('formats USD major units and integer cents consistently', () => {
    expect(formatMoney(10.05)).toBe('$10.05');
    expect(formatMoney(49)).toBe('$49');
    expect(formatMoney(4950, { unit: 'cents' })).toBe('$49.50');
    expect(formatMoney(49000, { currency: 'vnd' }).replace(/\s/g, '')).toBe(
      '49.000₫',
    );
    expect(formatMoney(1005, { unit: 'cents' })).toBe(formatMoney(10.05));
    expect(() => formatMoney(1005.2, { unit: 'cents' })).toThrow(RangeError);
  });
  it('retains filters and repeated query parameters while changing page', () => {
    const params = toSearchParams({
      q: 'máy ảnh',
      category: ['A', 'B'],
      page: '2',
    });
    expect(withPage('/products', params.toString(), 3)).toMatch(
      /category=A&category=B&page=3$/,
    );
    expect(withPage('/products', 'page=2', 1)).toBe('/products');
  });
  it('generates distinct idempotency keys and reports a missing OpenAPI operation', () => {
    expect(newIdempotencyKey()).not.toBe(newIdempotencyKey());
    expect(() => verifyOpenApi({ paths: {} })).toThrow('GET /api/v1/products');
  });
});

const origin = 'http://localhost:4000';
const schema = z.object({ done: z.boolean() });
const errorResponse = (status: number, code = 'UNAUTHORIZED') =>
  Response.json(
    {
      error: { code, message: 'internal message', details: { issue: true } },
      requestId: 'err-123',
    },
    { status },
  );

describe('API transport', () => {
  it('sends Bearer and request ID, forcing private no-store', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ done: true }));
    const apiFetch = createTransport({
      origin,
      getToken: async () => 'test',
      fetcher,
    });
    await expect(
      apiFetch('/api/v1/cart', {
        schema,
        private: true,
        next: { revalidate: 60 },
      }),
    ).resolves.toEqual({ done: true });
    const init = fetcher.mock.calls[0]?.[1];
    expect(init?.cache).toBe('no-store');
    expect(init?.next).toBeUndefined();
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer test');
    expect(new Headers(init?.headers).get('X-Request-Id')).toMatch(
      /^[a-f0-9-]{36}$/,
    );
  });
  it('uses stable cache headers for server catalogue and validates DTOs', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ items: ['Home'] }))
      .mockResolvedValueOnce(Response.json({ categories: ['Home'] }));
    const api = createApi(createTransport({ origin, fetcher }));
    await expect(api.categories.list()).resolves.toEqual({ items: ['Home'] });
    const init = fetcher.mock.calls[0]?.[1];
    expect(init?.next).toEqual({
      revalidate: 60,
      tags: ['catalogue', 'categories'],
    });
    expect(new Headers(init?.headers).has('X-Request-Id')).toBe(false);
    await expect(api.categories.list()).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    });
  });
  it('maps backend error details while showing safe Vietnamese text', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(errorResponse(409, 'CART_CHANGED'));
    const apiFetch = createTransport({ origin, fetcher });
    await expect(apiFetch('/api/v1/cart', { schema })).rejects.toMatchObject({
      code: 'CART_CHANGED',
      status: 409,
      details: { issue: true },
      requestId: 'err-123',
    });
    expect(
      apiErrorMessage(new ApiError(409, 'CART_CHANGED', 'internal message')),
    ).toContain('Giỏ hàng đã thay đổi');
    expect(
      apiErrorMessage(new ApiError(429, 'LIMIT', 'internal message')),
    ).toContain('quá nhanh');
  });
  it('refreshes a browser token once on 401 and preserves idempotency', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(errorResponse(401))
      .mockResolvedValueOnce(Response.json({ done: true }));
    const getToken = vi
      .fn()
      .mockResolvedValueOnce('old')
      .mockResolvedValueOnce('new');
    const onUnauthorized = vi.fn();
    const request = createTransport({
      origin,
      browser: true,
      getToken,
      onUnauthorized,
      fetcher,
    });
    await request('/api/v1/checkout/sessions', {
      schema,
      method: 'POST',
      private: true,
      idempotencyKey: 'same-key',
    });
    expect(getToken).toHaveBeenLastCalledWith({ skipCache: true });
    expect(onUnauthorized).not.toHaveBeenCalled();
    expect(
      fetcher.mock.calls.map(([, init]) =>
        new Headers(init?.headers).get('Idempotency-Key'),
      ),
    ).toEqual(['same-key', 'same-key']);
    expect(
      new Headers(fetcher.mock.calls[1]?.[1]?.headers).get('Authorization'),
    ).toBe('Bearer new');
  });
  it('redirects only after the refreshed request is rejected', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => errorResponse(401));
    const onUnauthorized = vi.fn();
    const request = createTransport({
      origin,
      browser: true,
      getToken: async () => 'token',
      onUnauthorized,
      fetcher,
    });
    await expect(
      request('/api/v1/me', { schema, private: true }),
    ).rejects.toMatchObject({ status: 401 });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });
  it('normalizes a network failure', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new TypeError('offline'));
    const request = createTransport({ origin, fetcher });
    await expect(
      request('/api/v1/categories', { schema }),
    ).rejects.toMatchObject({ code: 'NETWORK' });
  });
});
