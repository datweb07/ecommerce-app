import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { apiRoot, pathsFor } from './paths.ts';
import { assertSafeDatabase, requireRunId } from './safety.ts';

export async function queryPlans() {
  const paths = pathsFor(requireRunId(process.env));
  const uri = await readFile(join(paths.privateDir, 'mongo-uri'), 'utf8');
  assertSafeDatabase(uri);
  const appRequire = createRequire(join(apiRoot, 'package.json'));
  const { Types } = appRequire('mongoose') as {
    Types: { ObjectId: new (id: string) => unknown };
  };
  const { openDataConnection } = (await import(
    pathToFileURL(join(apiRoot, 'dist', 'scripts', 'product-data.js')).href
  )) as {
    openDataConnection(uri: string): Promise<{
      db: { command(document: object): Promise<Record<string, unknown>> };
      close(): Promise<void>;
    }>;
  };
  const connection = await openDataConnection(uri);
  try {
    const definitions = {
      catalogue: {
        find: 'products',
        filter: { category: 'Electronics' },
        sort: { price: 1, _id: 1 },
        limit: 12,
      },
      search: {
        find: 'products',
        filter: { name: { $regex: 'Sản phẩm', $options: 'i' } },
        sort: { createdAt: -1, _id: -1 },
        limit: 12,
      },
      customerOrders: {
        find: 'orders',
        filter: {
          $or: [
            { clerkId: 'user_test_fixture' },
            { user: new Types.ObjectId('730000000000000000000001') },
          ],
        },
        sort: { createdAt: -1, _id: -1 },
        limit: 20,
      },
      bestsellerSource: {
        aggregate: 'orders',
        pipeline: [
          { $match: { status: 'delivered' } },
          { $sort: { createdAt: -1, _id: -1 } },
          { $limit: 5000 },
          { $unwind: '$orderItems' },
          {
            $group: {
              _id: '$orderItems.product',
              quantity: { $sum: '$orderItems.quantity' },
            },
          },
          { $limit: 1000 },
        ],
        cursor: {},
      },
      adminStatsSource: {
        aggregate: 'orders',
        pipeline: [
          {
            $match: {
              createdAt: {
                $gte: new Date('2025-01-01Z'),
                $lt: new Date('2025-02-01Z'),
              },
            },
          },
          { $group: { _id: '$status', count: { $sum: 1 } } },
        ],
        cursor: {},
      },
    };
    const results = [];
    for (const [name, explain] of Object.entries(definitions)) {
      const result = await connection.db.command({
        explain,
        verbosity: 'executionStats',
        maxTimeMS: 5000,
      });
      results.push({ name, result });
    }
    return results;
  } finally {
    await connection.close();
  }
}
