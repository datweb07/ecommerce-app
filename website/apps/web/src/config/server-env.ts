import 'server-only';
import { parseEnv, serverSchema } from './env-schema';
import { publicEnv } from './public-env';

export const serverEnv = parseEnv(serverSchema, {
  API_INTERNAL_URL: process.env.API_INTERNAL_URL ?? 'http://127.0.0.1:4000',
  CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
  CURRENCY: process.env.CURRENCY ?? 'usd',
  CART_MAX_QUANTITY: process.env.CART_MAX_QUANTITY || undefined,
});

if (
  Boolean(serverEnv.CLERK_SECRET_KEY) !==
  Boolean(publicEnv.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)
) {
  throw new Error(
    'Cần khai báo cùng lúc CLERK_SECRET_KEY và NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.',
  );
}
