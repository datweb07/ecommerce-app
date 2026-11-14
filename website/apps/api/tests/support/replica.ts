import { mkdir, mkdtemp } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../src/app.js';
import { parseEnv } from '../../src/config/env.js';
import { openDataConnection } from '../../src/scripts/product-data.js';
import type { ClerkAdapter } from '../../src/plugins/clerk.js';

export const clerkFixture: ClerkAdapter = {
  async authenticate(header) {
    const token = header.slice(7);
    return /^user_[a-zA-Z]+$/.test(token) ? token : null;
  },
  async identity(id) {
    return {
      email: id + '@example.test',
      name: id,
      imageUrl: '',
      verified: !id.endsWith('Unverified'),
    };
  },
};
export const bearer = (id = 'user_A') => ({ authorization: 'Bearer ' + id });
export function replica(
  options: Parameters<typeof buildApp>[1] = {},
  values: Record<string, string> = {},
) {
  let mongo: MongoMemoryReplSet;
  let app: Awaited<ReturnType<typeof buildApp>>;
  let connection: Awaited<ReturnType<typeof openDataConnection>>;
  beforeAll(async () => {
    const cache = fileURLToPath(
      new URL('../../../../.cache/', import.meta.url),
    );
    await mkdir(cache, { recursive: true });
    const dbPath = await mkdtemp(join(cache, 'mongo-api-'));
    mongo = await MongoMemoryReplSet.create({
      instanceOpts: [{ dbPath }],
      replSet: {
        count: 1,
        storageEngine: 'wiredTiger',
        args: ['--wiredTigerCacheSizeGB', '0.25'],
      },
    });
    const uri = mongo.getUri('storefront_web');
    app = await buildApp(
      parseEnv({ ...values, NODE_ENV: 'test', MONGODB_URI: uri }),
      { logger: false, clerk: clerkFixture, ...options },
    );
    connection = await openDataConnection(uri);
    await app.ready();
  });
  afterAll(async () => {
    await app?.close();
    await connection?.close();
    await mongo?.stop({ doCleanup: true, force: true });
  });
  return {
    get app() {
      return app;
    },
    get db() {
      return connection;
    },
  };
}
