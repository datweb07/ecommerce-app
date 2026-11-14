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
export const publicSchema = z.object({
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
