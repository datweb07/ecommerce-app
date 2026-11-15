import { expect, it, vi } from 'vitest';
import { Types } from 'mongoose';
import { bearer, replica } from './support/replica.js';
import { seedBanners } from '../src/scripts/banner-data.js';

const base = '/api/v1/admin/banners';
const cloud = 'fixture-cloud';
const auth = bearer('user_Admin');
const ref = (name: string, folder = 'banners') => ({
  publicId: folder + '/' + name,
  url:
    'https://res.cloudinary.com/' +
    cloud +
    '/image/upload/v1/' +
    folder +
    '/' +
    name +
    '.webp',
});
const desktop = ref('desktop');
const mobile = ref('mobile');
const payload = {
  imageDesktop: desktop,
  imageMobile: mobile,
  alt: 'Sản phẩm tuần này',
  href: '/products',
  isActive: true,
};
const destroy = vi.fn(async () => ({}));
const fixture = replica(
  {
    media: {
      async resource(id) {
        const name = id.split('/')[1] ?? '';
        return {
          public_id: id,
          asset_folder: name === 'folder' ? 'elsewhere' : 'banners',
          secure_url: ref(name).url,
          format: 'webp',
          bytes: name === 'oversize' ? 5 * 1024 * 1024 + 1 : 1000,
          width: name === 'tiny' ? 20 : 2400,
          height: 1350,
          resource_type: 'image',
          type: 'upload',
        };
      },
      destroy,
    },
  },
  {
    ADMIN_EMAIL: 'user_Admin@example.test',
    CLOUDINARY_CLOUD_NAME: cloud,
    ADMIN_BANNER_MAX_COUNT: '4',
    CLOUDINARY_API_KEY: 'key',
    CLOUDINARY_API_SECRET: 'secret',
  },
);
const send = (
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT',
  url: string,
  body?: object,
) =>
  fixture.app.inject({
    method,
    url,
    ...(body ? { payload: body } : {}),
    headers: auth,
  });

it('seeds three local banners idempotently', async () => {
  await fixture.db.collection('web_banners').deleteMany({});
  expect(await seedBanners(fixture.uri, 4)).toBe(3);
  expect(await seedBanners(fixture.uri, 4)).toBe(0);
  const response = await fixture.app.inject('/api/v1/banners');
  expect(response.json().items).toHaveLength(3);
  expect(response.json().items[0].imageDesktop.url).toBe(
    '/banners/headphones-desktop.webp',
  );
  await fixture.db.collection('web_banners').deleteMany({});
});

it('guards each admin operation and validates link, dates, folder, bytes and pixel dimensions', async () => {
  const id = String(new Types.ObjectId());
  const requests = [
    { method: 'GET' as const, url: base },
    { method: 'POST' as const, url: base, payload },
    {
      method: 'PATCH' as const,
      url: base + '/' + id,
      payload: { isActive: false },
    },
    { method: 'DELETE' as const, url: base + '/' + id },
    { method: 'PUT' as const, url: base + '/order', payload: { ids: [id] } },
  ];
  for (const request of requests) {
    expect((await fixture.app.inject(request)).statusCode).toBe(401);
    expect(
      (await fixture.app.inject({ ...request, headers: bearer() })).statusCode,
    ).toBe(403);
  }
  for (const href of [
    'javascript:alert(1)',
    '//evil.test',
    'https://evil.test/products',
    '/%2f/evil.test',
    '/a/..//evil.test',
  ]) {
    expect(
      (await send('POST', base, { ...payload, href })).statusCode,
      href,
    ).toBe(400);
  }
  for (const name of ['folder', 'oversize', 'tiny']) {
    expect(
      (await send('POST', base, { ...payload, imageDesktop: ref(name) })).json()
        .error.code,
    ).toBe('INVALID_IMAGE_ASSET');
  }
  const earlier = '2025-01-01T00:00:00.000Z';
  const later = '2025-01-02T00:00:00.000Z';
  expect(
    (
      await send('POST', base, { ...payload, startsAt: later, endsAt: earlier })
    ).json().error.code,
  ).toBe('INVALID_BANNER_DATES');
  expect(
    (await send('PATCH', base + '/bad', { isActive: false })).statusCode,
  ).toBe(400);
});
it('shows the effective schedule, updates visibility, reorders transactionally and deletes', async () => {
  const create = async (fields: object) => {
    const response = await send('POST', base, { ...payload, ...fields });
    expect(response.statusCode, response.body).toBe(201);
    return response.json();
  };
  const first = await create({
    href: 'http://localhost:3000/products?category=Fashion',
    imageDesktop: ref('unique'),
  });
  const future = await create({
    startsAt: new Date(Date.now() + 60_000).toISOString(),
  });
  const past = await create({
    endsAt: new Date(Date.now() - 60_000).toISOString(),
  });
  const inactive = await create({ isActive: false });
  const read = async () => fixture.app.inject('/api/v1/banners');
  const published = await read();
  expect(published.headers['cache-control']).toBe('public, max-age=60');
  expect(published.json().items.map((row: { id: string }) => row.id)).toEqual([
    first.id,
  ]);
  expect(published.json().items[0].href).toBe('/products?category=Fashion');
  expect(published.json().items[0].imageDesktop).not.toHaveProperty('publicId');
  expect((await send('POST', base, payload)).json().error.code).toBe(
    'BANNER_LIMIT',
  );
  expect(
    (await send('PUT', base + '/order', { ids: [first.id, first.id] }))
      .statusCode,
  ).toBe(400);
  expect(
    (await send('PUT', base + '/order', { ids: [first.id] })).statusCode,
  ).toBe(409);
  const ids = [inactive.id, past.id, future.id, first.id];
  expect((await send('PUT', base + '/order', { ids })).json()).toEqual({ ids });
  const list = await send('GET', base + '?limit=2');
  expect(list.json()).toMatchObject({
    total: 4,
    items: [{ id: inactive.id }, { id: past.id }],
  });
  expect(
    (await send('PATCH', base + '/' + inactive.id, { isActive: true }))
      .statusCode,
  ).toBe(200);
  expect(
    (await read()).json().items.map((row: { id: string }) => row.id),
  ).toEqual([inactive.id, first.id]);
  expect((await send('DELETE', base + '/' + first.id)).statusCode).toBe(200);
  expect(destroy).toHaveBeenCalledExactlyOnceWith('banners/unique');
  expect((await send('DELETE', base + '/' + first.id)).statusCode).toBe(404);
});
it('scopes signed upload params to a fixed purpose and short expiry', async () => {
  const sign = (body: object) =>
    send('POST', '/api/v1/admin/uploads/signature', body);
  const image = { sizeBytes: 1024, contentType: 'image/avif' };
  const banner = await sign({ ...image, purpose: 'banner' });
  expect(banner.statusCode, banner.body).toBe(200);
  expect(banner.json().params).toMatchObject({
    asset_folder: 'banners',
    public_id: expect.stringMatching(/^banners\//),
    allowed_formats: 'jpg,jpeg,png,webp,avif',
  });
  expect(
    new Date(banner.json().expiresAt).getTime() - Date.now(),
  ).toBeGreaterThan(290_000);
  expect(
    new Date(banner.json().expiresAt).getTime() - Date.now(),
  ).toBeLessThanOrEqual(300_000);
  expect(
    (await sign({ ...image, purpose: 'product' })).json().params.asset_folder,
  ).toBe('products');
  expect((await sign({ ...image, purpose: 'other' })).statusCode).toBe(400);
  expect(
    (await sign({ ...image, purpose: 'banner', public_id: 'override' }))
      .statusCode,
  ).toBe(400);
});
