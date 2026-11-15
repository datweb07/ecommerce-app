import { v2 as cloudinary } from 'cloudinary';
import type { FastifyBaseLogger } from 'fastify';
import { z } from 'zod';
import type { Env } from '../../config/env.js';
import { ApiError } from '../../plugins/errors.js';

export type MediaAdapter = {
  resource(publicId: string): Promise<unknown>;
  destroy(publicId: string): Promise<unknown>;
};
export type AssetRef = { url: string; publicId: string };
export type Folder = 'products' | 'banners';
const resourceSchema = z.object({
  public_id: z.string(),
  asset_folder: z.string(),
  secure_url: z.url(),
  format: z.enum(['jpg', 'jpeg', 'png', 'webp', 'avif']),
  bytes: z.number().int().positive(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  resource_type: z.literal('image'),
  type: z.literal('upload'),
});
const invalid = () =>
  new ApiError(
    400,
    'INVALID_IMAGE_ASSET',
    'Ảnh không hợp lệ, sai thư mục hoặc vượt giới hạn.',
  );
const unavailable = () =>
  new ApiError(503, 'UPLOAD_UNCONFIGURED', 'Chưa kết nối được dịch vụ ảnh.');
export function createMedia(
  env: Env,
  log: FastifyBaseLogger,
  injected?: MediaAdapter,
) {
  const {
    CLOUDINARY_CLOUD_NAME: cloud,
    CLOUDINARY_API_KEY: key,
    CLOUDINARY_API_SECRET: secret,
  } = env;
  const credentials = { cloud_name: cloud, api_key: key, api_secret: secret };
  const adapter =
    injected ??
    (cloud && key && secret
      ? {
          resource: async (id: string): Promise<unknown> =>
            cloudinary.api.resource(id, {
              ...credentials,
              resource_type: 'image',
              type: 'upload',
            }),
          destroy: async (id: string): Promise<unknown> =>
            cloudinary.uploader.destroy(id, {
              ...credentials,
              resource_type: 'image',
              type: 'upload',
              invalidate: true,
            }),
        }
      : undefined);
  function owns(ref: AssetRef, folder: Folder) {
    const url = URL.canParse(ref.url) ? new URL(ref.url) : null;
    return Boolean(
      cloud &&
      url?.origin === 'https://res.cloudinary.com' &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      url.pathname.startsWith('/' + cloud + '/image/upload/') &&
      ref.publicId.startsWith(folder + '/') &&
      /^[a-z0-9_-]+\/[a-zA-Z0-9_-]+$/.test(ref.publicId),
    );
  }
  async function verify(
    ref: AssetRef,
    folder: Folder,
    minimum?: { width: number; height: number },
  ) {
    if (!adapter || !cloud) throw unavailable();
    if (!owns(ref, folder)) throw invalid();
    const value = await adapter
      .resource(ref.publicId)
      .catch((error: unknown) => {
        if (
          typeof error === 'object' &&
          error &&
          'http_code' in error &&
          error.http_code === 404
        )
          throw invalid();
        throw unavailable();
      });
    const result = resourceSchema.safeParse(value);
    if (!result.success) throw invalid();
    const asset = result.data;
    if (
      asset.public_id !== ref.publicId ||
      asset.asset_folder !== folder ||
      asset.secure_url !== ref.url ||
      asset.bytes > env.ADMIN_IMAGE_MAX_BYTES ||
      (minimum &&
        (asset.width < minimum.width || asset.height < minimum.height))
    )
      throw invalid();
    return { ...ref, width: asset.width, height: asset.height };
  }
  async function remove(ref: AssetRef, folder: Folder, targetId: string) {
    if (!adapter || !owns(ref, folder)) return;
    try {
      await adapter.destroy(ref.publicId);
    } catch {
      log.warn(
        { action: 'cloudinary.cleanup', targetId },
        'Không thể dọn ảnh Cloudinary',
      );
    }
  }
  return { verify, remove };
}
export type AdminMedia = ReturnType<typeof createMedia>;
