import { sampleBanners } from '@storefront/shared';
import { assertSafeDatabase } from './safety.ts';

const categories = ['Electronics', 'Fashion', 'Accessories'] as const;
export const firstProductId = '760000000000000000000001';

type Collection = {
  insertMany(rows: Record<string, unknown>[]): Promise<unknown>;
};
export async function seedE2E(
  uri: string,
  db: { collection(name: string): Collection },
  objectId: (value: string) => unknown,
) {
  assertSafeDatabase(uri);
  const epoch = Date.UTC(2025, 0, 1);
  const products = Array.from({ length: 24 }, (_, index) => ({
    _id: objectId(
      '7600000000000000000000' + (index + 1).toString(16).padStart(2, '0'),
    ),
    name: index === 0 ? 'Sản phẩm E2E tồn một' : 'Sản phẩm E2E ' + (index + 1),
    description: 'Dữ liệu catalogue dành riêng cho E2E.',
    price: 19.5 + index,
    category: categories[index % categories.length],
    stock: index === 0 ? 1 : index === 1 ? 0 : 20,
    images: [],
    averageRating: 0,
    totalReviews: 0,
    createdAt: new Date(epoch + index * 1000),
    updatedAt: new Date(epoch + index * 1000),
  }));
  await db.collection('products').insertMany(products);
  await db.collection('web_banners').insertMany(
    sampleBanners.map(
      ({ id, imageDesktop, imageMobile, ...banner }, index) => ({
        ...banner,
        _id: objectId(id),
        isActive: true,
        sortOrder: index,
        imageDesktop: { ...imageDesktop, publicId: 'e2e/desktop-' + index },
        imageMobile: { ...imageMobile, publicId: 'e2e/mobile-' + index },
        createdAt: new Date(epoch),
        updatedAt: new Date(epoch),
      }),
    ),
  );
}
