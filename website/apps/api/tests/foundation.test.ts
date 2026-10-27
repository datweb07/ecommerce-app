import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { z } from 'zod';
import { Types } from 'mongoose';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { errorResponseSchema } from '@storefront/shared';
import { buildApp } from '../src/app.js';
import { parseEnv } from '../src/config/env.js';
import {
  assertLocalWebTarget,
  importProducts,
  openDataConnection,
  sampleProducts,
  seedProducts,
} from '../src/scripts/product-data.js';

describe('foundation with a real isolated Mongo replica set', () => {
  let mongo: MongoMemoryReplSet;
  let app: Awaited<ReturnType<typeof buildApp>>;
  let uri: string;
  beforeAll(async () => {
    const cache = fileURLToPath(new URL('../../../.cache/', import.meta.url));
    await mkdir(cache, { recursive: true });
    const dbPath = await mkdtemp(join(cache, 'mongo-test-'));
    mongo = await MongoMemoryReplSet.create({
      instanceOpts: [{ dbPath }],
      replSet: {
        count: 1,
        storageEngine: 'wiredTiger',
        args: ['--wiredTigerCacheSizeGB', '0.25'],
      },
    });
    uri = mongo.getUri('storefront_web');
    app = await buildApp(parseEnv({ NODE_ENV: 'test', MONGODB_URI: uri }), {
      logger: false,
    });
    app.post(
      '/test/validation',
      {
        schema: {
          body: z.object({ count: z.number().int().positive() }).strict(),
          response: {
            200: z.object({ count: z.number() }),
            400: errorResponseSchema,
          },
        },
      },
      async (request) => request.body,
    );
    app.get('/test/failure', async () => {
      throw new Error('private-value-must-never-leak');
    });
    app.get(
      '/test/serialization',
      {
        schema: {
          response: { 200: z.object({ count: z.number().positive() }) },
        },
      },
      async () => ({ count: -1 }),
    );
    app.get(
      '/test/limited',
      { config: { rateLimit: { max: 1, timeWindow: '1 minute' } } },
      async () => ({ ok: true }),
    );
    await app.ready();
  });
  afterAll(async () => {
    await app?.close();
    await mongo?.stop({ doCleanup: true, force: true });
  });

  it('serves liveness/readiness with helmet and a propagated request id', async () => {
    for (const path of ['/health/live', '/health/ready']) {
      const response = await app.inject({
        url: path,
        headers: { 'x-request-id': 'test-request-123' },
      });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        status: 'ok',
        service: 'storefront-api',
        requestId: 'test-request-123',
      });
      expect(response.headers['x-request-id']).toBe('test-request-123');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
    }
    const unsafeId = await app.inject({
      url: '/health/live',
      headers: { 'x-request-id': 'bad id' },
    });
    expect(unsafeId.headers['x-request-id']).toMatch(/^[a-f0-9-]{36}$/);
  });
  it('allows only configured browser origins', async () => {
    const allowed = await app.inject({
      method: 'OPTIONS',
      url: '/health/live',
      headers: {
        origin: 'http://localhost:3000',
        'access-control-request-method': 'GET',
      },
    });
    expect(allowed.headers['access-control-allow-origin']).toBe(
      'http://localhost:3000',
    );
    const denied = await app.inject({
      url: '/health/live',
      headers: { origin: 'https://unexpected.example' },
    });
    expect(denied.headers['access-control-allow-origin']).toBeUndefined();
  });
  it('validates input and serializes errors without exposing internals', async () => {
    const invalid = await app.inject({
      method: 'POST',
      url: '/test/validation',
      payload: { count: -1 },
    });
    expect(invalid.statusCode).toBe(400);
    expect(errorResponseSchema.parse(invalid.json()).error.code).toBe(
      'BAD_REQUEST',
    );
    const valid = await app.inject({
      method: 'POST',
      url: '/test/validation',
      payload: { count: 2 },
    });
    expect(valid.json()).toEqual({ count: 2 });
    const failure = await app.inject('/test/failure');
    expect(failure.statusCode).toBe(500);
    expect(failure.body).not.toContain('private-value');
    const invalidResponse = await app.inject('/test/serialization');
    expect(invalidResponse.statusCode).toBe(500);
    expect(errorResponseSchema.parse(invalidResponse.json()).error.code).toBe(
      'INTERNAL_ERROR',
    );
    expect((await app.inject('/missing')).statusCode).toBe(404);
    const malformed = await app.inject({
      method: 'POST',
      url: '/test/validation',
      headers: { 'content-type': 'application/json' },
      payload: '{invalid',
    });
    expect(malformed.statusCode).toBe(400);
  });
  it('enforces request limits with the same error contract', async () => {
    await app.inject('/test/limited');
    const limited = await app.inject('/test/limited');
    expect(limited.statusCode).toBe(429);
    expect(errorResponseSchema.parse(limited.json()).error.code).toBe(
      'RATE_LIMITED',
    );
    const large = await app.inject({
      method: 'POST',
      url: '/test/validation',
      payload: { count: 1, padding: 'x'.repeat(1024 * 1024) },
    });
    expect(large.statusCode).toBe(413);
  });
  it('generates OpenAPI from real schemas and serves Swagger UI', async () => {
    const spec = await app.inject('/openapi.json');
    expect(spec.statusCode).toBe(200);
    expect(
      spec.json().paths['/health/ready'].get.responses['200'],
    ).toBeDefined();
    expect((await app.inject('/docs/')).statusCode).toBe(200);
  });
  it('supports transactions on the test replica set', async () => {
    const connection = await openDataConnection(uri);
    try {
      if (!connection.db) throw new Error('Missing database');
      const collection = connection.db.collection('transaction_probe');
      await collection.insertOne({ value: 0 });
      const session = await connection.startSession();
      try {
        session.startTransaction();
        await collection.updateOne({}, { $inc: { value: 1 } }, { session });
        await session.abortTransaction();
        expect((await collection.findOne())?.value).toBe(0);
      } finally {
        await session.endSession();
      }
    } finally {
      await connection.close();
    }
  });
  it('seeds eight legacy-compatible products idempotently without overwriting changes', async () => {
    expect((await seedProducts(uri)).upsertedCount).toBe(8);
    const connection = await openDataConnection(uri);
    try {
      const first = sampleProducts[0];
      if (!first) throw new Error('Missing fixture');
      await connection.db
        ?.collection('products')
        .updateOne({ _id: first._id }, { $set: { stock: 3 } });
      expect((await seedProducts(uri)).upsertedCount).toBe(0);
      expect(
        (
          await connection.db
            ?.collection('products')
            .findOne({ _id: first._id })
        )?.stock,
      ).toBe(3);
      expect(
        new Set(sampleProducts.map((product) => product.category)).size,
      ).toBe(4);
    } finally {
      await connection.close();
    }
  });
  it('imports source products read-only, defaults to dry-run and never overwrites target', async () => {
    const sourceUri = mongo.getUri('legacy_fixture');
    const source = await openDataConnection(sourceUri);
    try {
      if (!source.db || !sampleProducts[0]) throw new Error('Missing fixture');
      const collection = source.db.collection('products');
      await collection.insertOne({
        ...sampleProducts[0],
        name: 'Legacy fixture',
      });
      await collection.insertOne({
        ...sampleProducts[0],
        _id: new Types.ObjectId(),
        name: 'New imported product',
      });
      await collection.insertOne({ name: 'Invalid fixture' });
      const before = await collection.find().toArray();
      const dry = await importProducts(sourceUri, uri, {
        write: false,
        limit: 100,
      });
      expect(dry).toMatchObject({
        scanned: 3,
        valid: 2,
        invalid: 1,
        inserted: 0,
        dryRun: true,
      });
      const written = await importProducts(sourceUri, uri, {
        write: true,
        limit: 100,
      });
      expect(written.inserted).toBe(1);
      expect(
        (await importProducts(sourceUri, uri, { write: true, limit: 100 }))
          .inserted,
      ).toBe(0);
      expect(await collection.find().toArray()).toEqual(before);
      const target = await openDataConnection(uri);
      try {
        expect(
          (
            await target.db
              ?.collection('products')
              .findOne({ _id: sampleProducts[0]._id })
          )?.name,
        ).toBe(sampleProducts[0].name);
      } finally {
        await target.close();
      }
    } finally {
      await source.close();
    }
  });
  it('rejects remote/shared destinations for data tools', () => {
    expect(() =>
      assertLocalWebTarget('mongodb://example.com/storefront_web'),
    ).toThrow();
    expect(() =>
      assertLocalWebTarget('mongodb://localhost/mobile_db'),
    ).toThrow();
    expect(() =>
      assertLocalWebTarget('mongodb://127.0.0.1:27018/storefront_web'),
    ).not.toThrow();
  });
  it('hides development docs in production', async () => {
    const production = await buildApp(
      parseEnv({ NODE_ENV: 'production', MONGODB_URI: uri }),
      { logger: false },
    );
    try {
      expect((await production.inject('/openapi.json')).statusCode).toBe(404);
      expect((await production.inject('/docs')).statusCode).toBe(404);
    } finally {
      await production.close();
    }
  });
  it('reports database loss as 503 while keeping liveness available', async () => {
    await mongo.stop({ doCleanup: true, force: true });
    const ready = await app.inject('/health/ready');
    expect(ready.statusCode).toBe(503);
    expect(errorResponseSchema.parse(ready.json()).error.code).toBe(
      'UNAVAILABLE',
    );
    expect((await app.inject('/health/live')).statusCode).toBe(200);
  });
});
