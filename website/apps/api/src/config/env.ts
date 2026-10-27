import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import { z } from 'zod';

const optionalSecret = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.string().optional(),
);
const httpUrl = z.url().refine((value) => /^https?:/.test(value));

export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  HOST: z.string().default('127.0.0.1'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
  MONGODB_URI: z
    .string()
    .refine((value) => /^mongodb(?:\+srv)?:\/\//.test(value))
    .default(
      'mongodb://127.0.0.1:27018/storefront_web?replicaSet=rs0&directConnection=true',
    ),
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:3000')
    .transform((value) => value.split(',').map((origin) => origin.trim()))
    .pipe(
      z
        .array(
          httpUrl.refine((value) => {
            try {
              return new URL(value).origin === value;
            } catch {
              return false;
            }
          }),
        )
        .min(1),
    ),
  CURRENCY: z
    .string()
    .regex(/^[a-z]{3}$/)
    .default('usd'),
  SHIPPING_FEE_CENTS: z.coerce
    .number()
    .int()
    .nonnegative()
    .max(1_000_000)
    .default(1000),
  TAX_RATE: z.coerce.number().min(0).max(1).default(0.08),
  CLERK_PUBLISHABLE_KEY: optionalSecret,
  CLERK_SECRET_KEY: optionalSecret,
  CLERK_WEBHOOK_SIGNING_SECRET: optionalSecret,
  ADMIN_EMAIL: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.email().optional(),
  ),
  STRIPE_SECRET_KEY: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.string().startsWith('sk_test_').optional(),
  ),
  STRIPE_WEBHOOK_SECRET: optionalSecret,
  CLOUDINARY_CLOUD_NAME: optionalSecret,
  CLOUDINARY_API_KEY: optionalSecret,
  CLOUDINARY_API_SECRET: optionalSecret,
  WEB_ORIGIN: httpUrl.default('http://localhost:3000'),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(values: Record<string, string | undefined>): Env {
  const parsed = envSchema.safeParse(values);
  if (!parsed.success) {
    // Never include supplied values (database URIs and keys) in errors.
    throw new Error(
      `Invalid environment: ${[...new Set(parsed.error.issues.map((issue) => issue.path.join('.')))].join(', ')}`,
    );
  }
  return parsed.data;
}

export function loadEnv(): Env {
  config({
    path: fileURLToPath(new URL('../../../../.env', import.meta.url)),
    quiet: true,
  });
  return parseEnv(process.env);
}
