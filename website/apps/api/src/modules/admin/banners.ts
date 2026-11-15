import type { ClientSession, Connection } from 'mongoose';
import type { z } from 'zod';
import {
  bannerDestination,
  type adminBannerCreate,
  type adminBannerPatch,
  type pagination,
} from '@storefront/shared';
import type { Env } from '../../config/env.js';
import type { Banner, BannerImage, bannerModels } from '../../models/banner.js';
import { ApiError } from '../../plugins/errors.js';
import type { AdminMedia, AssetRef } from './media.js';

const sort = { sortOrder: 1, _id: 1 } as const;
const missing = () =>
  new ApiError(404, 'BANNER_NOT_FOUND', 'Không tìm thấy banner.');
const minimum = {
  imageDesktop: { width: 1200, height: 500 },
  imageMobile: { width: 540, height: 675 },
};
const guardId = 'banners';
const imageView = ({ url, width, height }: BannerImage) => ({
  url,
  width,
  height,
});
function publicView(row: Banner) {
  return {
    id: String(row._id),
    imageDesktop: imageView(row.imageDesktop),
    imageMobile: imageView(row.imageMobile),
    href: row.href,
    alt: row.alt,
    title: row.title ?? null,
    subtitle: row.subtitle ?? null,
    ctaLabel: row.ctaLabel ?? null,
  };
}
function adminView(row: Banner) {
  return {
    ...publicView(row),
    imageDesktop: {
      ...imageView(row.imageDesktop),
      publicId: row.imageDesktop.publicId,
    },
    imageMobile: {
      ...imageView(row.imageMobile),
      publicId: row.imageMobile.publicId,
    },
    startsAt: row.startsAt?.toISOString() ?? null,
    endsAt: row.endsAt?.toISOString() ?? null,
    isActive: row.isActive,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
export function bannerService(
  db: Connection,
  { banners, guard }: ReturnType<typeof bannerModels>,
  media: AdminMedia,
  env: Env,
) {
  function write<T>(operation: (session: ClientSession) => Promise<T>) {
    return db.transaction(async (session) => {
      await guard.updateOne(
        { _id: guardId },
        { $inc: { revision: 1 } },
        { session },
      );
      return operation(session);
    });
  }
  async function active(now = new Date()) {
    const rows = await banners
      .find({
        isActive: true,
        $and: [
          { $or: [{ startsAt: null }, { startsAt: { $lte: now } }] },
          { $or: [{ endsAt: null }, { endsAt: { $gt: now } }] },
        ],
      })
      .sort(sort)
      .limit(50)
      .lean();
    return { items: rows.map(publicView) };
  }
  async function list({ page, limit }: z.infer<typeof pagination>) {
    const [rows, total] = await Promise.all([
      banners
        .find()
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      banners.countDocuments(),
    ]);
    return { page, limit, total, items: rows.map(adminView) };
  }
  function destination(href: string) {
    const internal = bannerDestination(href, env.WEB_ORIGIN);
    if (!internal)
      throw new ApiError(
        400,
        'INVALID_BANNER_HREF',
        'Đích banner phải thuộc cửa hàng.',
      );
    return internal;
  }
  function dates(
    input: {
      startsAt?: string | null | undefined;
      endsAt?: string | null | undefined;
    },
    before?: Banner,
  ) {
    const toDate = (
      date: string | null | undefined,
      previous: Date | null | undefined,
    ) =>
      date === undefined
        ? (previous ?? null)
        : date === null
          ? null
          : new Date(date);
    const startsAt = toDate(input.startsAt, before?.startsAt);
    const endsAt = toDate(input.endsAt, before?.endsAt);
    if (startsAt && endsAt && startsAt >= endsAt)
      throw new ApiError(
        400,
        'INVALID_BANNER_DATES',
        'Ngày kết thúc phải sau ngày bắt đầu.',
      );
    return { startsAt, endsAt };
  }
  async function verify(
    ref: AssetRef,
    placement: keyof typeof minimum,
    before?: BannerImage,
  ) {
    if (before?.publicId === ref.publicId && before.url === ref.url)
      return before;
    return media.verify(ref, 'banners', minimum[placement]);
  }
  async function cleanup(row: Banner, next?: Banner) {
    const retained = new Set([
      next?.imageDesktop.publicId,
      next?.imageMobile.publicId,
    ]);
    const images = new Map(
      [row.imageDesktop, row.imageMobile].map((entry) => [
        entry.publicId,
        entry,
      ]),
    );
    await Promise.all(
      [...images.values()]
        .filter((entry) => !retained.has(entry.publicId))
        .map((entry) =>
          media.remove(entry, 'banners', String(row._id), async () =>
            Boolean(
              await banners.exists({
                $or: [
                  { 'imageDesktop.publicId': entry.publicId },
                  { 'imageMobile.publicId': entry.publicId },
                ],
              }),
            ),
          ),
        ),
    );
  }
  async function create(input: z.infer<typeof adminBannerCreate>) {
    const href = destination(input.href);
    const schedule = dates(input);
    const [imageDesktop, imageMobile] = await Promise.all([
      verify(input.imageDesktop, 'imageDesktop'),
      verify(input.imageMobile, 'imageMobile'),
    ]);
    return write(async (session) => {
      const count = await banners.countDocuments().session(session);
      if (count >= env.ADMIN_BANNER_MAX_COUNT)
        throw new ApiError(409, 'BANNER_LIMIT', 'Đã đạt giới hạn số banner.');
      const last = await banners
        .findOne()
        .sort({ sortOrder: -1 })
        .session(session)
        .lean();
      const row = new banners({
        ...input,
        ...schedule,
        href,
        imageDesktop,
        imageMobile,
        sortOrder: (last?.sortOrder ?? -1) + 1,
      });
      await row.save({ session });
      return adminView(row.toObject());
    });
  }
  async function update(
    id: string,
    {
      imageDesktop,
      imageMobile,
      href,
      startsAt,
      endsAt,
      ...fields
    }: z.infer<typeof adminBannerPatch>,
  ) {
    const before = await banners.findById(id).lean();
    if (!before) throw missing();
    const path = href === undefined ? {} : { href: destination(href) };
    const [desktop, mobile] = await Promise.all([
      imageDesktop
        ? verify(imageDesktop, 'imageDesktop', before.imageDesktop)
        : Promise.resolve(undefined),
      imageMobile
        ? verify(imageMobile, 'imageMobile', before.imageMobile)
        : Promise.resolve(undefined),
    ]);
    const { previous, row } = await write(async (session) => {
      const previous = await banners.findById(id).session(session).lean();
      if (!previous) throw missing();
      if (
        (desktop &&
          previous.imageDesktop.publicId !== before.imageDesktop.publicId) ||
        (mobile &&
          previous.imageMobile.publicId !== before.imageMobile.publicId)
      )
        throw new ApiError(409, 'BANNER_CHANGED', 'Ảnh banner vừa thay đổi.');
      const row = await banners
        .findOneAndUpdate(
          { _id: id },
          {
            $set: {
              ...fields,
              ...path,
              ...dates({ startsAt, endsAt }, previous),
              ...(desktop ? { imageDesktop: desktop } : {}),
              ...(mobile ? { imageMobile: mobile } : {}),
            },
          },
          { session, returnDocument: 'after', runValidators: true },
        )
        .lean();
      if (!row) throw missing();
      return { previous, row };
    });
    if (desktop || mobile) await cleanup(previous, row);
    return adminView(row);
  }
  async function remove(id: string) {
    const row = await write(async (session) => {
      const row = await banners
        .findOneAndDelete({ _id: id }, { session })
        .lean();
      if (!row) throw missing();
      return row;
    });
    await cleanup(row);
  }
  function reorder(input: string[]) {
    const ids = input.map((id) => id.toLowerCase());
    return write(async (session) => {
      const rows = await banners
        .find()
        .select({ _id: 1 })
        .session(session)
        .lean();
      const known = new Set(rows.map((row) => String(row._id)));
      if (ids.length !== rows.length || !ids.every((id) => known.has(id)))
        throw new ApiError(
          409,
          'BANNER_ORDER_CONFLICT',
          'Danh sách banner đã thay đổi. Vui lòng tải lại.',
        );
      if (ids.length)
        await banners.bulkWrite(
          ids.map((id, sortOrder) => ({
            updateOne: { filter: { _id: id }, update: { $set: { sortOrder } } },
          })),
          { session },
        );
      return { ids };
    });
  }
  return { active, list, create, update, remove, reorder };
}
export type BannerService = ReturnType<typeof bannerService>;
