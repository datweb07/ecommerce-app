import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { mkdir, readdir, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import AxeBuilder from '@axe-core/playwright';
import { chromium, expect, type Page } from '@playwright/test';
import { banners, id, responseFor } from '../tests/browser-admin/data.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = fileURLToPath(
  new URL('../../../.cache/admin/', import.meta.url),
);
const fixtures = resolve(root, 'tests/browser-admin');
const origin = 'http://127.0.0.1:39390';
const require = createRequire(import.meta.url);
const vitest = createRequire(require.resolve('vitest/package.json'));
const engine: {
  build: (config: object) => Promise<{ outputFiles: { text: string }[] }>;
} = vitest('esbuild');
const built = await engine.build({
  absWorkingDir: root,
  entryPoints: [resolve(fixtures, 'entry.tsx')],
  bundle: true,
  write: false,
  platform: 'browser',
  jsx: 'automatic',
  format: 'iife',
  define: {
    'process.env': JSON.stringify({
      NODE_ENV: 'production',
      NEXT_PUBLIC_SITE_URL: origin,
      NEXT_PUBLIC_API_URL: origin,
    }),
  },
  alias: {
    'next/link': resolve(fixtures, 'link.ts'),
    'next/image': resolve(fixtures, 'image.ts'),
    'next/navigation': resolve(fixtures, 'runtime.tsx'),
    'next/cache': resolve(fixtures, 'runtime.tsx'),
    '@clerk/nextjs': resolve(fixtures, 'runtime.tsx'),
    '@clerk/nextjs/server': resolve(fixtures, 'runtime.tsx'),
    'server-only': resolve(fixtures, 'runtime.tsx'),
  },
});
const bundle = built.outputFiles[0]?.text ?? '';
assert.ok(bundle, 'Fixture bundle missing');
const chunks = resolve(root, '.next/static/chunks');
const cssFiles = (await readdir(chunks)).filter((file) =>
  file.endsWith('.css'),
);
assert.ok(cssFiles.length, 'Run pnpm build before admin smoke');
const manifest = await readFile(
  resolve(root, '.next/server/app-paths-manifest.json'),
  'utf8',
);
assert.ok(manifest.includes('/admin/page'));
assert.doesNotMatch(manifest, /browser-admin|admin-preview/);
const styles = (
  await Promise.all(
    cssFiles.map((file) => readFile(resolve(chunks, file), 'utf8')),
  )
).join('\n');
const fontDir = resolve(root, 'node_modules/@fontsource-variable/inter/files');
const fonts = `
  @font-face{font-family: Admin Inter;src:url('/fixture-font/inter-latin-wght-normal.woff2');font-weight:100 900}
  @font-face{font-family: Admin Inter;src:url('/fixture-font/inter-vietnamese-wght-normal.woff2');font-weight:100 900;unicode-range:U+0102-0103,U+0110-0111,U+0128-0129,U+0168-0169,U+01A0-01A1,U+01AF-01B0,U+0300-0301,U+0303-0304,U+0308-0309,U+0323,U+0329,U+1EA0-1EF9,U+20AB}
  html{--font-inter: "Admin Inter"}
`;
await mkdir(output, { recursive: true });

const pages = [
  ['dashboard', '/admin'],
  ['products', '/admin/products'],
  ['product-new', '/admin/products/new'],
  ['product-edit', '/admin/products/' + id],
  ['orders', '/admin/orders'],
  ['order-detail', '/admin/orders/' + id],
  ['customers', '/admin/customers'],
  ['reviews', '/admin/reviews'],
  ['banners', '/admin/banners'],
  ['banner-new', '/admin/banners/new'],
  ['banner-edit', '/admin/banners/' + banners[0]?.id],
] as const;
const widths = {
  desktop: { width: 1440, height: 1000 },
  mobile: { width: 390, height: 844 },
};
const violations: string[] = [];

async function fixture(page: Page, theme: 'light' | 'dark') {
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith('/api/v1/')) {
      const dto = responseFor(url);
      return dto === undefined
        ? route.fulfill({ status: 404 })
        : route.fulfill({ json: dto });
    }
    if (url.pathname === '/fixture.js')
      return route.fulfill({
        body: bundle,
        contentType: 'application/javascript; charset=utf-8',
      });
    if (url.pathname === '/fixture.css')
      return route.fulfill({
        body: styles + fonts,
        contentType: 'text/css; charset=utf-8',
      });
    if (
      /^\/fixture-font\/inter-(latin|vietnamese)-wght-normal\.woff2$/.test(
        url.pathname,
      )
    )
      return route.fulfill({
        path: resolve(fontDir, basename(url.pathname)),
        contentType: 'font/woff2',
      });
    if (
      /^(?:headphones|shoes|watch)-(?:desktop|mobile)\.webp$/.test(
        basename(url.pathname),
      )
    )
      return route.fulfill({
        path: resolve(root, 'public/banners', basename(url.pathname)),
        contentType: 'image/webp',
      });
    if (pages.some(([, path]) => path === url.pathname))
      return route.fulfill({
        contentType: 'text/html; charset=utf-8',
        body: `<!doctype html><html lang="vi" class="${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Quản trị ShopEase</title><link rel="stylesheet" href="/fixture.css"><script>localStorage.setItem('theme', "${theme}")</script><script defer src="/fixture.js"></script></head><body><div id="app"></div></body></html>`,
      });
    return route.fulfill({ status: 404 });
  });
}

async function verifyProductionPrivacy() {
  const port = '39391';
  const url = 'http://localhost:' + port;
  const processHandle = spawn(
    process.execPath,
    [
      require.resolve('next/dist/bin/next'),
      'start',
      '--hostname',
      'localhost',
      '--port',
      port,
    ],
    {
      cwd: root,
      windowsHide: true,
      stdio: ['ignore', 'ignore', 'pipe'],
      env: {
        ...process.env,
        API_INTERNAL_URL: 'http://127.0.0.1:39392',
      },
    },
  );
  let diagnostic = '';
  processHandle.stderr?.on('data', (chunk: Buffer) => {
    const line = chunk
      .toString()
      .split(/\r?\n/)
      .filter((value) =>
        /Error|ECONN|ENOTFOUND|EACCES|address:|port:/i.test(value),
      )
      .join(' ');
    if (line)
      diagnostic +=
        ' ' +
        line
          .replace(/\b(?:sk|pk)_(?:test|live)_[A-Za-z0-9_.$-]+/g, '[redacted]')
          .replace(/(?:https?|mongodb(?:\+srv)?):\/\/\S+/g, '[redacted URL]')
          .slice(0, 350);
  });
  try {
    let robots: Response | undefined;
    for (let attempt = 0; attempt < 100; attempt++) {
      assert.equal(
        processHandle.exitCode,
        null,
        'The isolated Next production server stopped',
      );
      robots = await fetch(url + '/robots.txt', {
        signal: AbortSignal.timeout(500),
      }).catch(() => undefined);
      if (robots) break;
      await sleep(100);
    }
    assert.ok(
      robots?.ok,
      'The isolated Next production server did not become ready (HTTP ' +
        (robots?.status ?? 'unreachable') +
        ') ' +
        diagnostic,
    );
    assert.match(await robots.text(), /Disallow: \/admin/);
    const response = await fetch(url + '/admin/orders?status=shipped', {
      redirect: 'manual',
    });
    assert.equal(response.status, 307);
    const location = new URL(response.headers.get('location') ?? '', url);
    assert.equal(location.pathname, '/sign-in');
    const target = new URL(
      location.searchParams.get('redirect_url') ?? '',
      url,
    );
    assert.equal(
      target.pathname + target.search,
      '/admin/orders?status=shipped',
    );
    assert.match(response.headers.get('cache-control') ?? '', /no-store/);
    assert.match(response.headers.get('x-robots-tag') ?? '', /noindex/);
    assert.equal((await fetch(url + '/_dev/admin-preview')).status, 404);
    const sitemap = await fetch(url + '/sitemap.xml');
    assert.ok(sitemap.ok);
    assert.doesNotMatch(await sitemap.text(), /\/admin[</]/);
    console.log('Production privacy smoke passed');
  } finally {
    processHandle.kill();
  }
}
const browser = await chromium.launch({
  channel: process.env.SMOKE_BROWSER_CHANNEL ?? 'msedge',
});
try {
  for (const device of ['desktop', 'mobile'] as const) {
    for (const theme of ['light', 'dark'] as const) {
      const context = await browser.newContext({
        viewport: widths[device],
        colorScheme: theme,
        reducedMotion: 'reduce',
      });
      const page = await context.newPage();
      await fixture(page, theme);
      for (const [name, path] of pages) {
        await page.goto(origin + path);
        await expect(
          page.getByRole('heading', { level: 1 }).first(),
        ).toBeVisible();
        await expect(page.locator('main [role="status"]')).toHaveCount(0);
        await page.evaluate(() => document.fonts.ready);
        await page
          .locator('img')
          .evaluateAll((images) =>
            Promise.all(
              images.map((node) =>
                node instanceof HTMLImageElement
                  ? node.decode().catch(() => undefined)
                  : undefined,
              ),
            ),
          );
        const size = await page.evaluate(() => ({
          scroll: document.documentElement.scrollWidth,
          actual: document.documentElement.clientWidth,
        }));
        assert.equal(
          size.scroll,
          size.actual,
          `Overflow in ${name}-${device}-${theme}`,
        );
        const audit = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
          .analyze();
        for (const issue of audit.violations)
          violations.push(
            `${name}-${device}-${theme} ${issue.id} ${issue.nodes.map((node) => node.target).join(' ')}`,
          );
        await page.screenshot({
          path: resolve(output, `${name}-${device}-${theme}.png`),
          fullPage: true,
          animations: 'disabled',
        });
      }
      if (device === 'mobile') {
        await page.goto(origin + '/admin');
        const toggle = page.getByRole('button', {
          name: 'Điều hướng quản trị',
        });
        await toggle.focus();
        await page.keyboard.press('Enter');
        await expect(page.getByRole('dialog')).toBeVisible();
        const drawer = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
          .analyze();
        for (const warning of drawer.violations)
          violations.push('drawer-' + theme + ' ' + warning.id);
        await page.keyboard.press('Escape');
        await expect(toggle).toBeFocused();
      }
      await context.close();
    }
  }
  assert.deepEqual(violations, []);
  console.log(
    `${pages.length * 4} captures and axe checks, 2 drawer checks. Output ${output}`,
  );
} finally {
  await browser.close();
}
await verifyProductionPrivacy();
