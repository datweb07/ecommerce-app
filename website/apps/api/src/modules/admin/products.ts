import type { Connection, QueryFilter } from 'mongoose';
import type { z } from 'zod';
import type {
  adminProductQuery,
  adminProductCreate,
  adminProductPatch,
  adminStockInput,
} from '@storefront/shared';
import type { catalogueModels, Product } from '../../models/catalogue.js';
import type { checkoutModel } from '../../models/checkout.js';
import type { orderModel } from '../../models/order.js';
import type { Env } from '../../config/env.js';
import { ApiError } from '../../plugins/errors.js';
import { productView } from '../products/service.js';
import type { AdminMedia, AssetRef } from './media.js';

export const escapedSearch = (value: string) =>
  new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
const missing = () =>
  new ApiError(404, 'PRODUCT_NOT_FOUND', 'Không tìm thấy sản phẩm.');
function view(row: Product, threshold: number) {
  return {
    ...productView(row),
    imageAssets: row.webImageAssets ?? [],
    stockStatus:
      row.stock <= 0
        ? ('out' as const)
        : row.stock <= threshold
          ? ('low' as const)
          : ('available' as const),
  };
}
export function adminProducts(
  db: Connection,
  { products }: ReturnType<typeof catalogueModels>,
  checkouts: ReturnType<typeof checkoutModel>,
  orders: ReturnType<typeof orderModel>,
  media: AdminMedia,
  env: Env,
) {
  const toDto = (row: Product) => view(row, env.ADMIN_LOW_STOCK);
  async function list(query: z.infer<typeof adminProductQuery>) {
    const { q, category, stockStatus, sort, page, limit } = query;
    const filter: QueryFilter<Product> = {
      ...(q ? { name: escapedSearch(q) } : {}),
      ...(category ? { category } : {}),
      ...(stockStatus === 'out'
        ? { stock: { $lte: 0 } }
        : stockStatus === 'low'
          ? { stock: { $gt: 0, $lte: env.ADMIN_LOW_STOCK } }
          : {}),
    };
    const ordering =
      sort === 'price'
        ? { price: 1 as const, _id: 1 as const }
        : sort === 'stock'
          ? { stock: 1 as const, _id: 1 as const }
          : sort === 'name'
            ? { name: 1 as const, _id: 1 as const }
            : { createdAt: -1 as const, _id: -1 as const };
    const [items, total] = await Promise.all([
      products
        .find(filter)
        .sort(ordering)
        .skip((page - 1) * limit)
        .limit(limit)
        .maxTimeMS(2500)
        .lean(),
      products.countDocuments(filter).maxTimeMS(2500),
    ]);
    return { items: items.map(toDto), total, page, limit };
  }
  async function get(id: string) {
    const row = await products.findById(id).lean();
    if (!row) throw missing();
    return toDto(row);
  }
  async function prepareImages(images: AssetRef[], previous: AssetRef[] = []) {
    if (
      images.length > env.ADMIN_PRODUCT_MAX_IMAGES ||
      new Set(images.map((image) => image.publicId)).size !== images.length
    )
      throw new ApiError(
        400,
        'INVALID_PRODUCT_IMAGES',
        'Số ảnh vượt giới hạn hoặc có ảnh trùng.',
      );
    await Promise.all(
      images.map((image) =>
        previous.some(
          (entry) =>
            entry.url === image.url && entry.publicId === image.publicId,
        )
          ? undefined
          : media.verify(image, 'products'),
      ),
    );
    return { images: images.map(({ url }) => url), webImageAssets: images };
  }
  async function cleanup(images: AssetRef[], id: string) {
    await Promise.all(
      images.map((asset) =>
        media.remove(asset, 'products', id, async () => {
          // Preserve snapshots and stop cleanup on uncertain reference checks.
          const stillUsed = await Promise.all([
            orders.exists({ 'orderItems.image': asset.url }),
            checkouts.exists({ 'items.image': asset.url, status: 'pending' }),
            products.exists({ images: asset.url }),
          ]);
          return stillUsed.some(Boolean);
        }),
      ),
    );
  }
  async function create({
    images,
    ...fields
  }: z.infer<typeof adminProductCreate>) {
    const row = await products.create({
      ...fields,
      ...(await prepareImages(images)),
    });
    return toDto(row.toObject());
  }
  async function update(
    id: string,
    { images, ...fields }: z.infer<typeof adminProductPatch>,
  ) {
    const before = await products.findById(id).lean();
    if (!before) throw missing();
    const assets = images
      ? await prepareImages(images, before.webImageAssets)
      : undefined;
    const row = await products
      .findOneAndUpdate(
        { _id: id, ...(images ? { images: before.images } : {}) },
        { $set: { ...fields, ...assets } },
        { returnDocument: 'after', runValidators: true },
      )
      .lean();
    if (!row) {
      if (!(await products.exists({ _id: id }))) throw missing();
      throw new ApiError(
        409,
        'PRODUCT_IMAGES_CHANGED',
        'Ảnh sản phẩm vừa thay đổi.',
      );
    }
    if (images)
      await cleanup(
        (before.webImageAssets ?? []).filter(
          (old) => !images.some(({ publicId }) => publicId === old.publicId),
        ),
        id,
      );
    return toDto(row);
  }
  async function stock(id: string, { delta }: z.infer<typeof adminStockInput>) {
    const row = await products
      .findOneAndUpdate(
        {
          _id: id,
          stock: {
            $gte: Math.max(-delta, 0),
            $lte: Number.MAX_SAFE_INTEGER - Math.max(delta, 0),
          },
        },
        { $inc: { stock: delta } },
        { returnDocument: 'after' },
      )
      .lean();
    if (row) return toDto(row);
    if (!(await products.exists({ _id: id }))) throw missing();
    throw new ApiError(
      409,
      'STOCK_OUT_OF_RANGE',
      'Điều chỉnh làm tồn kho vượt giới hạn.',
    );
  }
  async function remove(id: string) {
    const row = await db.transaction(async (session) => {
      // Checkout reservation writes this same Product. A concurrent reservation or delete must retry.
      const current = await products
        .findOneAndUpdate({ _id: id }, { $inc: { __v: 1 } }, { session })
        .lean();
      if (!current) throw missing();
      if (
        await checkouts
          .exists({ status: 'pending', 'items.product': current._id })
          .session(session)
      )
        throw new ApiError(
          409,
          'PRODUCT_RESERVED',
          'Sản phẩm đang nằm trong phiên thanh toán chờ xử lý.',
        );
      await products.deleteOne({ _id: id }, { session });
      return current;
    });
    await cleanup(row.webImageAssets ?? [], id);
  }
  return { list, get, create, update, stock, remove };
}
export type AdminProducts = ReturnType<typeof adminProducts>;
