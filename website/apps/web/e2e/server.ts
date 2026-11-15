import { spawn } from 'node:child_process';
import { cp, mkdir, readFile, symlink, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { basename, join, relative, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  apiRoot,
  appRoot,
  e2eCache,
  pathsFor,
  roleEmail,
  workspace,
} from './paths.ts';
import { seedE2E } from './seed.ts';
import {
  apiOrigin,
  assertSafeDatabase,
  assertSafeEnvironment,
  checkUploadAccount,
  clerkFrontendHost,
  databaseName,
  missingFor,
  requireRunId,
  webOrigin,
  type Suite,
} from './safety.ts';

assertSafeEnvironment(process.env);
const id = requireRunId(process.env);
const paths = pathsFor(id);
const suites = (process.env.STOREFRONT_E2E_SUITES ?? '').split(',');
if (
  !suites.length ||
  suites.some((name) => !['public', 'auth', 'payment', 'upload'].includes(name))
)
  throw new Error('Cần chọn project bằng pnpm e2e.');
for (const suite of suites as Suite[]) {
  const missing = missingFor(suite, process.env);
  if (missing.length) throw new Error('Thiếu biến E2E: ' + missing.join(', '));
}
const clerk = suites.some((name) => name !== 'public');
if (clerk) clerkFrontendHost(process.env);
const take = (names: string[]) =>
  Object.fromEntries(names.map((name) => [name, process.env[name]]));
if (suites.includes('upload')) checkUploadAccount(process.env);
const requireApi = createRequire(join(apiRoot, 'package.json'));
const requireWeb = createRequire(import.meta.url);
const nextBin = requireWeb.resolve('next/dist/bin/next');
const osEnv = take([
  'PATH',
  'Path',
  'SYSTEMROOT',
  'SystemRoot',
  'TEMP',
  'TMP',
  'HOME',
  'USERPROFILE',
  'LOCALAPPDATA',
  'APPDATA',
  'COMSPEC',
  'ComSpec',
  'PATHEXT',
]);
const clerkEnv = clerk
  ? take(['CLERK_SECRET_KEY', 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY'])
  : {};
const webEnv: NodeJS.ProcessEnv = {
  ...osEnv,
  ...clerkEnv,
  NODE_ENV: 'production',
  NEXT_TELEMETRY_DISABLED: '1',
  NEXT_PUBLIC_API_URL: apiOrigin,
  API_INTERNAL_URL: apiOrigin,
  NEXT_PUBLIC_SITE_URL: webOrigin,
};

const {
  MongoMemoryReplSet,
}: {
  MongoMemoryReplSet: {
    create(
      options: object,
    ): Promise<{ getUri(db: string): string; stop(): Promise<unknown> }>;
  };
} = requireApi('mongodb-memory-server');
const { Types }: { Types: { ObjectId: new (value: string) => unknown } } =
  requireApi('mongoose');
const compiled = (file: string) =>
  pathToFileURL(join(apiRoot, 'dist', file)).href;
const { parseEnv }: { parseEnv(input: NodeJS.ProcessEnv): unknown } =
  await import(compiled('config/env.js'));
interface Api {
  listen(options: { host: string; port: number }): Promise<string>;
  close(): Promise<unknown>;
}
const {
  buildApp,
}: { buildApp(env: unknown, options: { logger: false }): Promise<Api> } =
  await import(compiled('app.js'));
const {
  openDataConnection,
}: {
  openDataConnection(
    uri: string,
  ): Promise<{ db: Parameters<typeof seedE2E>[1]; close(): Promise<unknown> }>;
} = await import(compiled('scripts/product-data.js'));

async function copyWeb() {
  await mkdir(paths.project, { recursive: true });
  for (const folder of ['src', 'public'])
    await cp(join(appRoot, folder), join(paths.project, folder), {
      recursive: true,
      filter: (source) => !basename(source).startsWith('.env'),
    });
  for (const file of ['package.json', 'postcss.config.mjs', 'next.config.ts'])
    await cp(join(appRoot, file), join(paths.project, file));
  const tsconfig = JSON.parse(
    await readFile(join(appRoot, 'tsconfig.json'), 'utf8'),
  );
  await writeFile(
    join(paths.project, 'tsconfig.json'),
    JSON.stringify({
      ...tsconfig,
      extends: relative(paths.project, join(workspace, 'tsconfig.base.json'))
        .split(sep)
        .join('/'),
      include: [
        'next-env.d.ts',
        'src/**/*.ts',
        'src/**/*.tsx',
        '.next/types/**/*.ts',
      ],
    }),
  );
  await symlink(
    join(appRoot, 'node_modules'),
    join(paths.project, 'node_modules'),
    process.platform === 'win32' ? 'junction' : 'dir',
  );
}

let app: Api | undefined;
let child: ReturnType<typeof spawn> | undefined;
let database: Awaited<ReturnType<typeof MongoMemoryReplSet.create>> | undefined;
let cleanup: Promise<void> | undefined;
function close() {
  return (cleanup ??= (async () => {
    child?.kill();
    try {
      await app?.close();
    } finally {
      await database?.stop();
    }
  })());
}
process.once('SIGTERM', () => {
  void close().finally(() => process.exit());
});
process.once('SIGINT', () => {
  void close().finally(() => process.exit());
});

function next(args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const running = spawn(process.execPath, [nextBin, ...args], {
      cwd: paths.project,
      env: webEnv,
      stdio: 'inherit',
      windowsHide: true,
    });
    child = running;
    running.once('error', reject);
    running.once('exit', (code) =>
      code === 0
        ? resolve()
        : reject(new Error('Next E2E kết thúc với mã ' + code)),
    );
  });
}

try {
  await mkdir(paths.mongo, { recursive: true, mode: 0o700 });
  database = await MongoMemoryReplSet.create({
    binary: { version: '8.0.17', downloadDir: join(e2eCache, '..', 'mongodb') },
    instanceOpts: [{ dbPath: paths.mongo, ip: '127.0.0.1' }],
    replSet: {
      count: 1,
      storageEngine: 'wiredTiger',
      args: ['--wiredTigerCacheSizeGB', '0.25'],
    },
  });
  const uri = database.getUri(databaseName);
  assertSafeDatabase(uri);
  const db = await openDataConnection(uri);
  try {
    await seedE2E(uri, db.db, (value) => new Types.ObjectId(value));
  } finally {
    await db.close();
  }
  app = await buildApp(
    parseEnv({
      NODE_ENV: process.env.STOREFRONT_E2E_ZAP === '1' ? 'production' : 'test',
      MONGODB_URI: uri,
      WEB_ORIGIN: webOrigin,
      CORS_ORIGINS: webOrigin,
      ...(clerk
        ? {
            CLERK_PUBLISHABLE_KEY: clerkEnv.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
            CLERK_SECRET_KEY: clerkEnv.CLERK_SECRET_KEY,
            ADMIN_EMAIL: roleEmail('admin', id),
            ...take(['CLERK_WEBHOOK_SIGNING_SECRET']),
          }
        : {}),
      ...(suites.includes('payment')
        ? take(['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'])
        : {}),
      ...(suites.includes('upload')
        ? take([
            'CLOUDINARY_CLOUD_NAME',
            'CLOUDINARY_API_KEY',
            'CLOUDINARY_API_SECRET',
          ])
        : {}),
    }),
    { logger: false },
  );
  const api = new URL(apiOrigin);
  await app.listen({ host: api.hostname, port: Number(api.port) });
  await writeFile(join(paths.privateDir, 'mongo-uri'), uri, { mode: 0o600 });
  await copyWeb();
  if (process.env.STOREFRONT_E2E_ANALYZE === '1') {
    await next(['experimental-analyze', '--output']);
    await cp(
      join(paths.project, '.next', 'diagnostics', 'analyze'),
      join(paths.root, 'bundle'),
      { recursive: true },
    );
  }
  await next(['build']);
  const storefront = new URL(webOrigin);
  await next([
    'start',
    '--hostname',
    storefront.hostname,
    '--port',
    storefront.port,
  ]);
} finally {
  await close();
}
