import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ me: vi.fn(), revalidate: vi.fn() }));
vi.mock('next/cache', () => ({ revalidateTag: mocks.revalidate }));
vi.mock('../src/lib/api/server', () => ({
  serverApi: { admin: { me: mocks.me } },
}));
import { revalidateAdminStorefront } from '../src/lib/admin/revalidate';

beforeEach(() => {
  vi.resetAllMocks();
  mocks.me.mockResolvedValue({ id: '700000000000000000000001', isAdmin: true });
});
it('only revalidates the named storefront tags after verifying the admin', async () => {
  await expect(revalidateAdminStorefront('users')).resolves.toBe(false);
  expect(mocks.me).not.toHaveBeenCalled();
  await expect(revalidateAdminStorefront('catalogue')).resolves.toBe(true);
  expect(mocks.me).toHaveBeenCalledBefore(mocks.revalidate);
  expect(mocks.revalidate).toHaveBeenCalledExactlyOnceWith('catalogue', {
    expire: 0,
  });
});
it('does not revalidate if API denies admin access', async () => {
  mocks.me.mockRejectedValueOnce(new Error('403'));
  await expect(revalidateAdminStorefront('banners')).resolves.toBe(false);
  expect(mocks.revalidate).not.toHaveBeenCalled();
});
