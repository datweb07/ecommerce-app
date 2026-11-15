import { sampleBanners } from '@storefront/shared';
import type { Banner } from '../models/banner.js';
import { Types } from 'mongoose';
import { assertLocalWebTarget, openDataConnection } from './product-data.js';

export async function seedBanners(uri: string, maxCount: number) {
  assertLocalWebTarget(uri);
  const connection = await openDataConnection(uri);
  try {
    if (!connection.db) throw new Error('Database unavailable');
    const banners = connection.db.collection<Banner>('web_banners');
    const now = new Date();
    const current = await banners
      .find({}, { projection: { sortOrder: 1 } })
      .toArray();
    const existing = new Set(current.map((row) => String(row._id)));
    const available = Math.max(0, maxCount - current.length);
    const missing = sampleBanners
      .filter(({ id }) => !existing.has(id))
      .slice(0, available);
    if (!missing.length) return 0;
    const start =
      current.reduce((last, row) => Math.max(last, row.sortOrder), -1) + 1;
    const result = await banners.bulkWrite(
      missing.map(({ id, imageDesktop, imageMobile, ...fields }, index) => {
        const _id = new Types.ObjectId(id);
        return {
          updateOne: {
            filter: { _id },
            update: {
              $setOnInsert: {
                alt: fields.alt,
                href: fields.href,
                title: fields.title ?? null,
                subtitle: fields.subtitle ?? null,
                ctaLabel: fields.ctaLabel ?? null,
                _id,
                isActive: true,
                sortOrder: start + index,
                createdAt: now,
                updatedAt: now,
                imageDesktop: {
                  ...imageDesktop,
                  publicId: 'seed/' + id + '-desktop',
                },
                imageMobile: {
                  ...imageMobile,
                  publicId: 'seed/' + id + '-mobile',
                },
              },
            },
            upsert: true,
          },
        };
      }),
    );
    return result.upsertedCount;
  } finally {
    await connection.close();
  }
}
