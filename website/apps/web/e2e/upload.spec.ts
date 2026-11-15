import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { adminProductDto, uploadSignatureDto } from '@storefront/shared';
import { memberApi } from './member.ts';
import { appRoot } from './paths.ts';
import {
  assertSafeEnvironment,
  checkUploadAccount,
  missingFor,
} from './safety.ts';

test(
  'uploads an image to the confirmed Cloudinary test cloud and verifies it through storefront CRUD',
  { tag: '@upload' },
  async ({ page }) => {
    test.setTimeout(90_000);
    assertSafeEnvironment(process.env);
    checkUploadAccount(process.env);
    expect(missingFor('upload', process.env)).toEqual([]);
    await page.goto('/admin/products/new');
    await expect(
      page.getByRole('heading', { name: 'Thêm sản phẩm' }),
    ).toBeVisible();
    const api = memberApi(page);
    const asset = await readFile(join(appRoot, 'src', 'app', 'icon.png'));
    const signed = await api('POST', '/admin/uploads/signature', {
      purpose: 'product',
      sizeBytes: asset.length,
      contentType: 'image/png',
    });
    expect(signed.status()).toBe(200);
    const signature = uploadSignatureDto.parse(await signed.json());
    const cloud = encodeURIComponent(
      process.env.E2E_CLOUDINARY_CLOUD_NAME ?? '',
    );
    const imageBase = 'https://api.cloudinary.com/v1_1/' + cloud + '/image/';
    expect(signature.uploadUrl).toBe(imageBase + 'upload');
    const publicId = signature.params.public_id;
    expect(publicId).toMatch(/^products\/[a-f0-9-]{36}$/);
    let productId: string | undefined;
    try {
      const payload = new FormData();
      payload.set(
        'file',
        new Blob([new Uint8Array(asset)], { type: 'image/png' }),
        'storefront-e2e.png',
      );
      payload.set('api_key', signature.apiKey);
      payload.set('signature', signature.signature);
      for (const [key, value] of Object.entries(signature.params))
        payload.set(key, String(value));
      const upload = await fetch(signature.uploadUrl, {
        method: 'POST',
        body: payload,
        redirect: 'error',
        signal: AbortSignal.timeout(20_000),
      });
      expect(upload.ok).toBe(true);
      const media = (await upload.json()) as {
        secure_url: string;
        public_id: string;
      };
      expect(media.public_id).toBe(publicId);
      const create = await api('POST', '/admin/products', {
        name: 'Sản phẩm Cloudinary E2E',
        description: 'Ảnh từ lần chạy E2E.',
        category: 'Electronics',
        price: 9.95,
        stock: 2,
        images: [{ url: media.secure_url, publicId }],
      });
      expect(create.status()).toBe(201);
      productId = adminProductDto.parse(await create.json()).id;
      expect(
        (
          await api('PATCH', '/admin/products/' + productId, {
            description: 'Đã cập nhật',
          })
        ).status(),
      ).toBe(200);
      const adjusted = await api(
        'POST',
        '/admin/products/' + productId + '/stock',
        { delta: 1, reason: 'restock' },
      );
      expect(adjusted.status()).toBe(200);
      expect(adminProductDto.parse(await adjusted.json()).stock).toBe(3);
      await page.goto('/products/' + productId);
      await expect(
        page.getByRole('heading', { name: 'Sản phẩm Cloudinary E2E' }),
      ).toBeVisible();
    } finally {
      try {
        if (productId)
          expect(
            (await api('DELETE', '/admin/products/' + productId)).status(),
          ).toBe(200);
      } finally {
        const secret = process.env.CLOUDINARY_API_SECRET;
        const timestamp = String(Math.floor(Date.now() / 1000));
        const signature = createHash('sha1')
          .update(
            'invalidate=true&public_id=' +
              publicId +
              '&timestamp=' +
              timestamp +
              secret,
          )
          .digest('hex');
        const body = new URLSearchParams({
          invalidate: 'true',
          public_id: publicId,
          timestamp,
          api_key: process.env.CLOUDINARY_API_KEY ?? '',
          signature,
        });
        const destroy = await fetch(imageBase + 'destroy', {
          method: 'POST',
          body,
          redirect: 'error',
          signal: AbortSignal.timeout(20_000),
        });
        expect(destroy.ok).toBe(true);
        expect(['ok', 'not found']).toContain((await destroy.json()).result);
      }
    }
  },
);
