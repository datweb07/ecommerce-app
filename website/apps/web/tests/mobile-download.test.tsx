import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import { MobileDownload } from '../src/components/layout/mobile-download';
import { androidReleaseUrl, serverSchema } from '../src/config/env-schema';

vi.mock('server-only', () => ({}));

const page =
  'https://github.com/datweb07/ecommerce-app/releases/tag/android-v1.0.0';

it('allows only HTTPS release pages for the official repository', () => {
  expect(androidReleaseUrl.parse(page)).toBe(page);
  expect(
    androidReleaseUrl.safeParse(
      'https://github.com/datweb07/ecommerce-app/releases/latest',
    ).success,
  ).toBe(true);
  for (const url of [
    'http://github.com/datweb07/ecommerce-app/releases/latest',
    'https://github.com/untrusted/replica/releases/latest',
    'https://github.com/datweb07/ecommerce-app/releases/download/file.apk',
    page + '?next=elsewhere',
    'javascript:alert(1)',
  ])
    expect(androidReleaseUrl.safeParse(url).success, url).toBe(false);

  expect(
    serverSchema.parse({
      API_INTERNAL_URL: 'http://localhost:4000',
      CURRENCY: 'usd',
      MOBILE_ANDROID_DOWNLOAD_URL: ' ',
    }).MOBILE_ANDROID_DOWNLOAD_URL,
  ).toBeUndefined();
});

it('shows a preparation state without a dead download link or QR', async () => {
  const markup = renderToStaticMarkup(await MobileDownload({}));
  expect(markup).toContain('Bản Android chính thức đang được chuẩn bị.');
  expect(markup).not.toContain('<a');
  expect(markup).not.toContain('<img');
});

it('shows the release page and creates a local PNG for its QR', async () => {
  const markup = renderToStaticMarkup(
    await MobileDownload({ releaseUrl: page }),
  );
  expect(markup).toContain('href="' + page + '"');
  expect(markup).toContain('Mã QR mở trang tải ShopEase cho Android');
  expect(markup).toMatch(/src="data:image\/png;base64,iVBORw0KGgo/);
});
