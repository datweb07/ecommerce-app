import { errorResponseSchema } from '@storefront/shared';
import type { z } from 'zod';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly requestId?: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const messages: Record<number, string> = {
  400: 'Kiểm tra lại thông tin đã nhập.',
  401: 'Vui lòng đăng nhập lại để tiếp tục.',
  403: 'Bạn không có quyền thực hiện thao tác này.',
  404: 'Không tìm thấy nội dung yêu cầu.',
  409: 'Dữ liệu đã thay đổi. Vui lòng tải lại và thử lại.',
  422: 'Kiểm tra lại thông tin đã nhập.',
  429: 'Bạn thao tác quá nhanh. Vui lòng thử lại sau.',
};
export function apiErrorMessage(error: unknown) {
  if (!(error instanceof ApiError)) return 'Đã xảy ra lỗi. Vui lòng thử lại.';
  const message =
    error.code === 'CART_CHANGED'
      ? 'Giỏ hàng đã thay đổi. Tải lại giỏ hàng để tiếp tục.'
      : error.code === 'NETWORK'
        ? 'Không kết nối được. Kiểm tra mạng và thử lại.'
        : error.code === 'TIMEOUT'
          ? 'Yêu cầu quá thời gian. Vui lòng thử lại.'
          : (messages[error.status] ??
            'Dịch vụ tạm gián đoạn. Vui lòng thử lại.');
  return process.env.NODE_ENV === 'development' && error.requestId
    ? `${message} (Mã yêu cầu: ${error.requestId})`
    : message;
}

export type ApiOptions<S extends z.ZodType> = {
  schema: S;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | undefined;
  private?: boolean;
  query?: Record<string, string | number | boolean | undefined> | undefined;
  body?: unknown;
  idempotencyKey?: string | undefined;
  next?: { revalidate: number; tags?: string[] };
};
export type ApiRequest = <S extends z.ZodType>(
  path: string,
  options: ApiOptions<S>,
) => Promise<z.output<S>>;
export type TokenGetter = (options?: {
  skipCache?: boolean;
}) => Promise<string | null>;
export const newIdempotencyKey = () => crypto.randomUUID();

export function createTransport({
  origin,
  getToken,
  onUnauthorized,
  browser = false,
  fetcher = fetch,
}: {
  origin: string;
  getToken?: TokenGetter | undefined;
  onUnauthorized?: (() => void) | undefined;
  browser?: boolean;
  fetcher?: typeof fetch;
}): ApiRequest {
  return async (path, options) => {
    if (!path.startsWith('/api/v1/')) throw new TypeError('Invalid API path.');
    const url = new URL(path, origin);
    if (
      url.origin !== new URL(origin).origin ||
      !url.pathname.startsWith('/api/v1/')
    )
      throw new TypeError('Invalid API URL.');
    for (const [key, value] of Object.entries(options.query ?? {})) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
    const requestId = crypto.randomUUID();
    const headers = new Headers({ Accept: 'application/json' });
    const cacheable = !browser && !options.private && Boolean(options.next);
    if (!cacheable) headers.set('X-Request-Id', requestId);
    if (options.body !== undefined)
      headers.set('Content-Type', 'application/json');
    if (options.idempotencyKey)
      headers.set('Idempotency-Key', options.idempotencyKey);
    const signal = AbortSignal.timeout(10_000);
    const send = async (token?: string | null) => {
      if (token) headers.set('Authorization', `Bearer ${token}`);
      try {
        return await fetcher(url, {
          method: options.method ?? 'GET',
          headers: new Headers(headers),
          body:
            options.body === undefined ? null : JSON.stringify(options.body),
          credentials: 'omit',
          redirect: 'error',
          signal,
          ...(options.private || browser || !options.next
            ? { cache: 'no-store' }
            : { next: options.next }),
        });
      } catch {
        const code = signal.aborted ? 'TIMEOUT' : 'NETWORK';
        throw new ApiError(0, code, code, requestId);
      }
    };
    let response: Response | undefined;
    if (options.private) {
      const token = await getToken?.();
      if (token) response = await send(token);
      if (onUnauthorized && (!response || response.status === 401)) {
        const refreshed = await getToken?.({ skipCache: true });
        if (refreshed) response = await send(refreshed);
        if (!refreshed || response?.status === 401) onUnauthorized();
      }
    } else {
      response = await send();
    }
    if (!response)
      throw new ApiError(401, 'UNAUTHORIZED', 'Missing session', requestId);
    const responseId = response.headers.get('x-request-id') ?? requestId;
    const body: unknown = await response.json().catch(() => {
      if (signal.aborted)
        throw new ApiError(0, 'TIMEOUT', 'Request timed out', responseId);
      return undefined;
    });
    if (!response.ok) {
      const parsed = errorResponseSchema.safeParse(body);
      throw new ApiError(
        response.status,
        parsed.data?.error.code ?? 'HTTP_ERROR',
        parsed.data?.error.message ?? response.statusText,
        parsed.data?.requestId ?? responseId,
        parsed.data?.error.details,
      );
    }
    const parsed = options.schema.safeParse(body);
    if (!parsed.success)
      throw new ApiError(
        502,
        'INVALID_RESPONSE',
        'API contract mismatch',
        responseId,
      );
    return parsed.data;
  };
}
