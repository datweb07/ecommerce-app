export const webOrigin = 'http://localhost:39420';
export const apiOrigin = 'http://127.0.0.1:39421';
export const databaseName = 'web_e2e';
export const projects = {
  public: [
    'public-chromium',
    'public-mobile',
    'public-firefox',
    'public-webkit',
  ],
  auth: ['auth-chromium', 'auth-mobile'],
  payment: ['payment-chromium'],
  upload: ['upload-chromium'],
} as const;
export type Suite = keyof typeof projects;
type Env = Record<string, string | undefined>;
const publishable = 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY';
const auth = [
  publishable,
  'CLERK_SECRET_KEY',
  'CLERK_WEBHOOK_SIGNING_SECRET',
] as const;
const payment = ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'] as const;
const upload = [
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
  'E2E_CLOUDINARY_CLOUD_NAME',
] as const;

export const inspectedNames = [
  ...auth,
  'CLERK_PUBLISHABLE_KEY',
  ...payment,
  ...upload,
  'ADMIN_EMAIL',
] as const;

export function missingFor(suite: Suite, env: Env) {
  const keys = {
    public: [],
    auth,
    payment: [...auth, ...payment],
    upload: [...auth, ...upload],
  }[suite];
  return keys.filter((key) => !env[key]?.trim());
}

export function assertSafeEnvironment(env: Env) {
  if (env.CLERK_API_URL && env.CLERK_API_URL !== 'https://api.clerk.com')
    throw new Error('Clerk E2E chỉ dùng Backend API chính thức.');
  for (const key of [...auth, 'CLERK_PUBLISHABLE_KEY', ...payment]) {
    if (/^(?:sk|pk|rk)_live_/i.test(env[key]?.trim() ?? ''))
      throw new Error('Khóa live bị từ chối: ' + key);
  }
  for (const key of [publishable, 'CLERK_PUBLISHABLE_KEY']) {
    const value = env[key]?.trim();
    if (value && !value.startsWith('pk_test_'))
      throw new Error('Cần khóa Clerk development: ' + key);
  }
  for (const key of ['CLERK_SECRET_KEY', 'STRIPE_SECRET_KEY']) {
    const value = env[key]?.trim();
    if (value && !value.startsWith('sk_test_'))
      throw new Error('Cần khóa test: ' + key);
  }
  for (const [key, allowed] of [
    ['E2E_WEB_ORIGIN', webOrigin],
    ['E2E_API_ORIGIN', apiOrigin],
  ] as const) {
    if (env[key] !== undefined && env[key] !== allowed)
      throw new Error('E2E chỉ chạy trên origin loopback cố định: ' + key);
  }
}

export function clerkFrontendHost(env: Env) {
  assertSafeEnvironment(env);
  const publicKey = env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const suffix = publicKey?.slice('pk_test_'.length);
  const host = suffix && Buffer.from(suffix, 'base64url').toString('utf8');
  if (
    !host ||
    !/^[a-z0-9][a-z0-9.-]*\.clerk\.(?:accounts\.dev|dev)\$$/i.test(host)
  )
    throw new Error(
      'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY phải thuộc domain development của Clerk.',
    );
  return host.slice(0, -1);
}

export function assertSafeDatabase(uri: string) {
  const url = new URL(uri);
  if (
    url.protocol !== 'mongodb:' ||
    url.hostname !== '127.0.0.1' ||
    url.pathname !== '/' + databaseName ||
    url.username ||
    url.password
  )
    throw new Error('E2E cần MongoDB loopback riêng ' + databaseName);
}

export function requireRunId(env: Env) {
  const id = env.STOREFRONT_E2E_RUN;
  if (!id || !/^[a-f0-9]{32}$/.test(id))
    throw new Error('Chạy qua pnpm e2e để tạo phiên test riêng.');
  return id;
}

export function checkUploadAccount(env: Env) {
  if (
    !env.E2E_CLOUDINARY_CLOUD_NAME ||
    env.CLOUDINARY_CLOUD_NAME !== env.E2E_CLOUDINARY_CLOUD_NAME
  )
    throw new Error(
      'CLOUDINARY_CLOUD_NAME phải khớp cloud test đã xác nhận trong E2E_CLOUDINARY_CLOUD_NAME.',
    );
}
