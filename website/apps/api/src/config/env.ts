import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import { z } from 'zod';

const optionalSecret = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.string().optional(),
);
const httpUrl = z.url().refine((value) => /^https?:/.test(value));
const hostedOrigin = (value: string) => {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      url.origin === value &&
      !/^(localhost|127\.|0\.|\[|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)|\.localhost$|\*/i.test(
        url.hostname,
      )
    );
  } catch {
    return false;
  }
};

export const envSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    DEPLOY_ENV: z.enum(['local', 'staging', 'production']).optional(),
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(3).default(0),
    MONGO_MAX_POOL_SIZE: z.coerce.number().int().min(1).max(100).default(20),
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
    CURRENCY: z.literal('usd').default('usd'),
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
    ADMIN_LOW_STOCK: z.coerce.number().int().min(1).max(1_000_000).default(5),
    ADMIN_BANNER_MAX_COUNT: z.coerce.number().int().min(1).max(50).default(10),
    ADMIN_PRODUCT_MAX_IMAGES: z.coerce.number().int().min(1).max(20).default(5),
    ADMIN_IMAGE_MAX_BYTES: z.coerce
      .number()
      .int()
      .min(1)
      .max(20 * 1024 * 1024)
      .default(5 * 1024 * 1024),
    WEB_ORIGIN: httpUrl.default('http://localhost:3000'),
    CART_MAX_QUANTITY: z.preprocess(
      (value) => (value === '' ? undefined : value),
      z.coerce.number().int().min(1).max(1000).default(25),
    ),
    ADDRESS_MAX_COUNT: z.preprocess(
      (value) => (value === '' ? undefined : value),
      z.coerce.number().int().min(1).max(100).default(10),
    ),
  })
  .superRefine((env, context) => {
    const reject = (key: keyof typeof env) =>
      context.addIssue({
        code: 'custom',
        path: [key],
        message: 'Invalid deployment setting',
      });
    if (env.NODE_ENV === 'production' && !env.DEPLOY_ENV) reject('DEPLOY_ENV');
    if (!env.DEPLOY_ENV || env.DEPLOY_ENV === 'local') {
      if (env.NODE_ENV === 'production') {
        if (
          !/^mongodb:\/\/(?:127\.0\.0\.1|localhost|mongo)(?::\d+)?\//i.test(
            env.MONGODB_URI,
          )
        )
          reject('MONGODB_URI');
        if (env.CLERK_PUBLISHABLE_KEY?.startsWith('pk_live_'))
          reject('CLERK_PUBLISHABLE_KEY');
        if (env.CLERK_SECRET_KEY?.startsWith('sk_live_'))
          reject('CLERK_SECRET_KEY');
      }
      return;
    }
    if (env.NODE_ENV !== 'production') reject('NODE_ENV');
    if (env.HOST !== '0.0.0.0') reject('HOST');
    if (!hostedOrigin(env.WEB_ORIGIN)) reject('WEB_ORIGIN');
    if (
      !env.CORS_ORIGINS.every(hostedOrigin) ||
      !env.CORS_ORIGINS.includes(env.WEB_ORIGIN) ||
      (env.DEPLOY_ENV === 'production' && env.CORS_ORIGINS.length !== 1)
    )
      reject('CORS_ORIGINS');
    const database =
      env.DEPLOY_ENV === 'production' ? 'web_prod' : 'web_staging';
    try {
      const mongo = new URL(env.MONGODB_URI);
      if (
        mongo.protocol !== 'mongodb+srv:' ||
        !mongo.hostname.endsWith('.mongodb.net') ||
        mongo.pathname !== '/' + database ||
        mongo.searchParams.has('directConnection') ||
        /^(?:false|0)$/i.test(mongo.searchParams.get('retryWrites') ?? '') ||
        /^(?:false|0)$/i.test(mongo.searchParams.get('tls') ?? '') ||
        /^(?:false|0)$/i.test(mongo.searchParams.get('ssl') ?? '') ||
        mongo.searchParams.has('tlsAllowInvalidCertificates') ||
        mongo.searchParams.has('tlsInsecure') ||
        (mongo.searchParams.has('w') &&
          mongo.searchParams.get('w') !== 'majority')
      )
        reject('MONGODB_URI');
    } catch {
      reject('MONGODB_URI');
    }
    const clerkMode = env.DEPLOY_ENV === 'production' ? 'live' : 'test';
    if (
      !new RegExp('^pk_' + clerkMode + '_[A-Za-z0-9_-]+$').test(
        env.CLERK_PUBLISHABLE_KEY ?? '',
      )
    )
      reject('CLERK_PUBLISHABLE_KEY');
    if (
      !new RegExp('^sk_' + clerkMode + '_[A-Za-z0-9_-]+$').test(
        env.CLERK_SECRET_KEY ?? '',
      )
    )
      reject('CLERK_SECRET_KEY');
    if (!/^whsec_\S+$/.test(env.CLERK_WEBHOOK_SIGNING_SECRET ?? ''))
      reject('CLERK_WEBHOOK_SIGNING_SECRET');
    for (const key of [
      'ADMIN_EMAIL',
      'CLOUDINARY_CLOUD_NAME',
      'CLOUDINARY_API_KEY',
      'CLOUDINARY_API_SECRET',
    ] as const) {
      if (!env[key]?.trim()) reject(key);
    }
    // Live checkout needs a separate, verified activation. The adapter currently only accepts test events.
    if (env.DEPLOY_ENV === 'production') {
      if (env.STRIPE_SECRET_KEY) reject('STRIPE_SECRET_KEY');
      if (env.STRIPE_WEBHOOK_SECRET) reject('STRIPE_WEBHOOK_SECRET');
    } else {
      if (!/^sk_test_\S+$/.test(env.STRIPE_SECRET_KEY ?? ''))
        reject('STRIPE_SECRET_KEY');
      if (!/^whsec_\S+$/.test(env.STRIPE_WEBHOOK_SECRET ?? ''))
        reject('STRIPE_WEBHOOK_SECRET');
    }
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
  if (process.env.NODE_ENV !== 'production') {
    config({
      path: fileURLToPath(new URL('../../../../.env', import.meta.url)),
      quiet: true,
    });
  }
  return parseEnv(process.env);
}
