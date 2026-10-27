import { productImportSchema, type ImportedProduct } from '@storefront/shared';
import mongoose from 'mongoose';

const image = (id: string) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=800&q=80`;
const samples = [
  [
    'Laptop di động',
    'Laptop gọn nhẹ dành cho công việc và học tập.',
    899,
    12,
    'Electronics',
    'photo-1496181133206-80ce9b88a853',
  ],
  [
    'Tai nghe không dây',
    'Tai nghe thoải mái, phù hợp nghe nhạc mỗi ngày.',
    79,
    35,
    'Electronics',
    'photo-1505740420928-5e560c06d30e',
  ],
  [
    'Áo thun cơ bản',
    'Áo thun mềm mại cho phong cách thường ngày.',
    25,
    50,
    'Fashion',
    'photo-1521572163474-6864f9cf17ab',
  ],
  [
    'Giày thể thao',
    'Giày linh hoạt cho các hoạt động hằng ngày.',
    65,
    24,
    'Fashion',
    'photo-1542291026-7eec264c27ff',
  ],
  [
    'Tạ tay tập luyện',
    'Tạ tay nhỏ gọn cho buổi tập tại nhà.',
    39,
    18,
    'Sports',
    'photo-1517836357463-d25dfeac3438',
  ],
  [
    'Xe đạp thể thao',
    'Xe đạp dành cho hành trình cuối tuần.',
    349,
    7,
    'Sports',
    'photo-1485965120184-e220f721d03e',
  ],
  [
    'Đồng hồ tối giản',
    'Đồng hồ mặt tròn với thiết kế thanh lịch.',
    119,
    20,
    'Accessories',
    'photo-1524805444758-089113d48a6d',
  ],
  [
    'Ba lô hằng ngày',
    'Ba lô tiện dụng để đi học, đi làm và dạo phố.',
    49,
    30,
    'Accessories',
    'photo-1553062407-98eeb64c6a62',
  ],
] as const;

export const sampleProducts = samples.map(
  ([name, description, price, stock, category, photo], index) => ({
    _id: new mongoose.Types.ObjectId(
      `7000000000000000000000${(index + 1).toString(16).padStart(2, '0')}`,
    ),
    ...productImportSchema.parse({
      name,
      description,
      price,
      stock,
      category,
      images: [image(photo)],
    }),
  }),
);

export type ProductRecord = ImportedProduct & {
  _id: mongoose.Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
  __v?: number;
};

export function assertLocalWebTarget(uri: string) {
  const parsed = new URL(uri);
  if (
    parsed.protocol !== 'mongodb:' ||
    !['127.0.0.1', 'localhost'].includes(parsed.hostname) ||
    parsed.pathname !== '/storefront_web' ||
    parsed.username ||
    parsed.password
  ) {
    throw new Error(
      'Data tools may write only to local mongodb://localhost:<port>/storefront_web (or 127.0.0.1).',
    );
  }
}

export async function openDataConnection(uri: string) {
  const connection = mongoose.createConnection(uri, {
    autoCreate: false,
    autoIndex: false,
    serverSelectionTimeoutMS: 5000,
  });
  try {
    return await connection.asPromise();
  } catch {
    await connection.close().catch(() => undefined);
    throw new Error(
      'Data connection failed; check configuration and permissions.',
    );
  }
}

export async function seedProducts(uri: string) {
  assertLocalWebTarget(uri);
  const connection = await openDataConnection(uri);
  try {
    if (!connection.db) throw new Error('Database unavailable');
    const products = connection.db.collection<ProductRecord>('products');
    const now = new Date();
    return await products.bulkWrite(
      sampleProducts.map((product) => ({
        updateOne: {
          filter: { _id: product._id },
          update: {
            $setOnInsert: {
              ...product,
              createdAt: now,
              updatedAt: now,
              __v: 0,
            },
          },
          upsert: true,
        },
      })),
    );
  } finally {
    await connection.close();
  }
}

export async function importProducts(
  sourceUri: string,
  targetUri: string,
  options: { write: boolean; limit: number },
) {
  assertLocalWebTarget(targetUri);
  if (
    !Number.isInteger(options.limit) ||
    options.limit < 1 ||
    options.limit > 10_000
  )
    throw new Error('Import limit must be an integer between 1 and 10000.');
  const sourceUrl = new URL(sourceUri);
  const targetUrl = new URL(targetUri);
  const canonicalHost = (host: string) =>
    ['localhost', '127.0.0.1'].includes(host) ? 'loopback' : host;
  if (
    canonicalHost(sourceUrl.hostname) === canonicalHost(targetUrl.hostname) &&
    (sourceUrl.port || '27017') === (targetUrl.port || '27017') &&
    sourceUrl.pathname === targetUrl.pathname
  )
    throw new Error('Source and target databases must differ.');
  const source = await openDataConnection(sourceUri);
  try {
    if (!source.db) throw new Error('Source database unavailable');
    // Source uses only find: no models, auto-create, indexes, updates, or migrations.
    const records = await source.db
      .collection('products')
      .find(
        {},
        {
          projection: {
            _id: 1,
            name: 1,
            description: 1,
            price: 1,
            stock: 1,
            category: 1,
            images: 1,
            averageRating: 1,
            totalReviews: 1,
            createdAt: 1,
            updatedAt: 1,
          },
        },
      )
      .sort({ _id: 1 })
      .limit(options.limit)
      .toArray();
    const valid: ProductRecord[] = [];
    let invalid = 0;
    for (const record of records) {
      const parsed = productImportSchema.safeParse(record);
      if (!parsed.success || !(record._id instanceof mongoose.mongo.ObjectId)) {
        invalid++;
        continue;
      }
      valid.push({
        _id: record._id,
        ...parsed.data,
        createdAt:
          record.createdAt instanceof Date ? record.createdAt : new Date(),
        updatedAt:
          record.updatedAt instanceof Date ? record.updatedAt : new Date(),
        __v: 0,
      });
    }
    if (!options.write || valid.length === 0)
      return {
        scanned: records.length,
        valid: valid.length,
        invalid,
        inserted: 0,
        dryRun: !options.write,
      };
    const target = await openDataConnection(targetUri);
    try {
      if (!target.db) throw new Error('Target database unavailable');
      const result = await target.db
        .collection<ProductRecord>('products')
        .bulkWrite(
          valid.map((product) => ({
            updateOne: {
              filter: { _id: product._id },
              update: { $setOnInsert: product },
              upsert: true,
            },
          })),
        );
      return {
        scanned: records.length,
        valid: valid.length,
        invalid,
        inserted: result.upsertedCount,
        dryRun: false,
      };
    } finally {
      await target.close();
    }
  } finally {
    await source.close();
  }
}
