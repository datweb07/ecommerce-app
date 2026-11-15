import { z } from 'zod';
import { objectId } from './auth.js';
import { pageInfo } from './products.js';
import { imageAssetRef } from './admin.js';

const safePath = (path: string) =>
  path.startsWith('/') &&
  !path.startsWith('//') &&
  !new URL('https://banner.invalid' + path).pathname.startsWith('//') &&
  !/[\\\s]/.test(path) &&
  !/%(?:0[0-9a-f]|1[0-9a-f]|7f|5c|2f)/i.test(path.split(/[?#]/)[0] ?? '');

export function bannerDestination(value: string, origin?: string) {
  if (safePath(value)) return value;
  if (
    !/^https?:\/\//i.test(value) ||
    /[\\\s]/.test(value) ||
    !URL.canParse(value)
  )
    return null;
  const url = new URL(value);
  const authority = value.split('/')[2];
  if (
    url.username ||
    url.password ||
    !authority ||
    (origin && url.origin !== new URL(origin).origin)
  )
    return null;
  const destination = url.pathname + url.search + url.hash;
  return safePath(destination) ? destination : null;
}

const bannerFields = {
  alt: z.string().trim().min(1).max(180),
  href: z
    .string()
    .trim()
    .min(1)
    .max(2048)
    .refine((value) => bannerDestination(value) !== null),
  title: z.string().trim().min(1).max(100).nullable().optional(),
  subtitle: z.string().trim().min(1).max(180).nullable().optional(),
  ctaLabel: z.string().trim().min(1).max(40).nullable().optional(),
  startsAt: z.iso.datetime().nullable().optional(),
  endsAt: z.iso.datetime().nullable().optional(),
  isActive: z.boolean(),
};
export const adminBannerCreate = z.strictObject({
  ...bannerFields,
  imageDesktop: imageAssetRef,
  imageMobile: imageAssetRef,
});
export const adminBannerPatch = adminBannerCreate
  .partial()
  .refine((value) => Object.keys(value).length > 0);
export const bannerOrderInput = z.strictObject({
  ids: z
    .array(objectId)
    .max(50)
    .refine(
      (ids) => new Set(ids.map((id) => id.toLowerCase())).size === ids.length,
    ),
});
const image = z.object({
  url: z.string(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});
export const publicBannerDto = z.object({
  id: objectId,
  imageDesktop: image,
  imageMobile: image,
  alt: bannerFields.alt,
  href: z.string().refine(safePath),
  title: bannerFields.title,
  subtitle: bannerFields.subtitle,
  ctaLabel: bannerFields.ctaLabel,
});
const adminImage = image.extend({ publicId: z.string() });
export const adminBannerDto = publicBannerDto.extend({
  imageDesktop: adminImage,
  imageMobile: adminImage,
  startsAt: z.iso.datetime().nullable(),
  endsAt: z.iso.datetime().nullable(),
  isActive: z.boolean(),
  sortOrder: z.number(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export const publicBannerList = z.object({ items: z.array(publicBannerDto) });
export const adminBannerList = pageInfo.extend({
  items: z.array(adminBannerDto),
});
export type PublicBanner = z.infer<typeof publicBannerDto>;
