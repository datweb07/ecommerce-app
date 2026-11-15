import { z } from 'zod';

const localPath = z.string().regex(/^\/(?![/\\])[^\s\\]*$/);
const httpOrigin = z
  .url()
  .refine((value) => {
    const url = new URL(value);
    return (
      ['http:', 'https:'].includes(url.protocol) &&
      !url.username &&
      !url.password &&
      url.pathname === '/' &&
      !url.search &&
      !url.hash
    );
  }, 'Phải là origin HTTP(S), không kèm đường dẫn')
  .transform((value) => new URL(value).origin);
const optionalKey = (pattern: RegExp) =>
  z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.string().regex(pattern).optional(),
  );
export const androidReleaseUrl = z
  .string()
  .trim()
  .regex(
    /^https:\/\/github\.com\/datweb07\/ecommerce-app\/releases\/(?:latest|tag\/[A-Za-z0-9][A-Za-z0-9._-]{0,99})\/?$/,
    'Dùng URL HTTPS trang phát hành GitHub của ShopEase.',
  );
export const publicSchema = z.object({
  NEXT_PUBLIC_MASCOT_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),
  NEXT_PUBLIC_API_URL: httpOrigin,
  NEXT_PUBLIC_SITE_URL: httpOrigin,
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: optionalKey(
    /^pk_(test|live)_[A-Za-z0-9_-]+$/,
  ),
  NEXT_PUBLIC_CLERK_SIGN_IN_URL: localPath,
  NEXT_PUBLIC_CLERK_SIGN_UP_URL: localPath,
  NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL: localPath,
  NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL: localPath,
});
export const serverSchema = z.object({
  API_INTERNAL_URL: httpOrigin,
  CLERK_SECRET_KEY: optionalKey(/^sk_(test|live)_[A-Za-z0-9_-]+$/),
  CURRENCY: z.enum(['usd']),
  CART_MAX_QUANTITY: z.coerce.number().int().min(1).max(1000).default(25),
  MOBILE_ANDROID_DOWNLOAD_URL: z.preprocess(
    (value) => (typeof value === 'string' && !value.trim() ? undefined : value),
    androidReleaseUrl.optional(),
  ),
});

export function parseEnv<T extends z.ZodType>(schema: T, input: unknown) {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw new Error(
      'Cấu hình web thiếu hoặc sai: ' +
        parsed.error.issues.map((issue) => issue.path.join('.')).join(', '),
    );
  }
  return parsed.data;
}
