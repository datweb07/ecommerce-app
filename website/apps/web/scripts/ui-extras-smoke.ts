import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { setTimeout as pause } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import AxeBuilder from '@axe-core/playwright';
import { chromium, expect, type Page } from '@playwright/test';
import { mascotPreferenceKey } from '../src/lib/mascot/preference.ts';

const webRoot = fileURLToPath(new URL('../', import.meta.url));
const apiRoot = fileURLToPath(new URL('../../api/', import.meta.url));
const cache = fileURLToPath(new URL('../../../.cache/', import.meta.url));
const output = join(cache, 'ui-extras');
const nextCli = createRequire(import.meta.url).resolve('next/dist/bin/next');
const port = Number(process.env.UI_EXTRAS_PORT ?? 39411);
const site = 'http://localhost:' + port;
let screenshots = 0;
await mkdir(output, { recursive: true });
const image = await readFile(
  join(webRoot, 'public/banners/headphones-mobile.webp'),
);

type Vitals = { lcp: number; cls: number; tbt: number; maxLongTask: number };
declare global {
  interface Window {
    uiExtrasMeasurements?: {
      lcp: number;
      entries: { value: number; startTime: number; recent: boolean }[];
      longTasks: { startTime: number; duration: number }[];
    };
  }
}
async function measure(page: Page, hideMascot: boolean): Promise<Vitals> {
  await page.addInitScript(
    ({ key, hide }) => {
      if (hide) localStorage.setItem(key, 'hidden');
      const readings: NonNullable<Window['uiExtrasMeasurements']> = {
        lcp: 0,
        entries: [],
        longTasks: [],
      };
      window.uiExtrasMeasurements = readings;
      for (const type of [
        'largest-contentful-paint',
        'layout-shift',
        'longtask',
      ]) {
        if (!PerformanceObserver.supportedEntryTypes.includes(type)) continue;
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (type === 'largest-contentful-paint')
              readings.lcp = entry.startTime;
            if (type === 'layout-shift') {
              const shift = entry as PerformanceEntry & {
                value: number;
                hadRecentInput: boolean;
              };
              readings.entries.push({
                value: shift.value,
                startTime: shift.startTime,
                recent: shift.hadRecentInput,
              });
            }
            if (type === 'longtask')
              readings.longTasks.push({
                startTime: entry.startTime,
                duration: entry.duration,
              });
          }
        }).observe({ type, buffered: true });
      }
    },
    { key: mascotPreferenceKey, hide: hideMascot },
  );
  await page.goto(site + '/');
  if (!hideMascot) await expect(page.locator('[data-mascot]')).toBeVisible();
  await page.waitForTimeout(2400);
  return page.evaluate(() => {
    const readings = window.uiExtrasMeasurements;
    const fcp =
      performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? 0;
    let maxShift = 0,
      session = 0,
      first = -Infinity,
      previous = -Infinity;
    for (const shift of readings?.entries ?? []) {
      if (shift.recent) continue;
      if (shift.startTime - previous > 1000 || shift.startTime - first > 5000) {
        session = 0;
        first = shift.startTime;
      }
      session += shift.value;
      maxShift = Math.max(maxShift, session);
      previous = shift.startTime;
    }
    let tbt = 0,
      maxLongTask = 0;
    for (const task of readings?.longTasks ?? []) {
      if (task.startTime + task.duration < fcp) continue;
      const duration =
        task.startTime + task.duration - Math.max(task.startTime, fcp);
      tbt += Math.max(duration - 50, 0);
      maxLongTask = Math.max(maxLongTask, duration);
    }
    return {
      lcp: Math.round(readings?.lcp ?? 0),
      cls: Number(maxShift.toFixed(5)),
      tbt: Math.round(tbt),
      maxLongTask: Math.round(maxLongTask),
    };
  });
}

async function startApi() {
  const apiRequire = createRequire(join(apiRoot, 'package.json'));
  const {
    MongoMemoryReplSet,
  }: {
    MongoMemoryReplSet: {
      create(config: object): Promise<{
        getUri(name: string): string;
        stop(options: object): Promise<unknown>;
      }>;
    };
  } = apiRequire('mongodb-memory-server');
  const database = await MongoMemoryReplSet.create({
    binary: { version: '8.0.17', downloadDir: join(cache, 'mongodb') },
    instanceOpts: [{ dbPath: await mkdtemp(join(cache, 'mongo-ui-extras-')) }],
    replSet: {
      count: 1,
      storageEngine: 'wiredTiger',
      args: ['--wiredTigerCacheSizeGB', '0.25'],
    },
  });
  const uri = database.getUri('storefront_web');
  try {
    const { seedProducts }: { seedProducts(uri: string): Promise<unknown> } =
      await import(
        new URL('../../api/dist/scripts/product-data.js', import.meta.url).href
      );
    const {
      seedBanners,
    }: { seedBanners(uri: string, max: number): Promise<unknown> } =
      await import(
        new URL('../../api/dist/scripts/banner-data.js', import.meta.url).href
      );
    const { parseEnv }: { parseEnv(values: Record<string, string>): unknown } =
      await import(
        new URL('../../api/dist/config/env.js', import.meta.url).href
      );
    const {
      buildApp,
    }: {
      buildApp(
        env: unknown,
        options: { logger: false },
      ): Promise<{
        listen(options: object): Promise<string>;
        close(): Promise<void>;
      }>;
    } = await import(new URL('../../api/dist/app.js', import.meta.url).href);
    await seedProducts(uri);
    await seedBanners(uri, 10);
    const app = await buildApp(
      parseEnv({ NODE_ENV: 'test', MONGODB_URI: uri, CORS_ORIGINS: site }),
      { logger: false },
    );
    try {
      const url = await app.listen({ port: 0, host: '127.0.0.1' });
      return {
        url,
        close: async () => {
          try {
            await app.close();
          } finally {
            await database.stop({ doCleanup: true, force: true });
          }
        },
      };
    } catch (error) {
      await app.close();
      throw error;
    }
  } catch (error) {
    await database.stop({ doCleanup: true, force: true });
    throw error;
  }
}

async function prepare(page: Page) {
  const issues: string[] = [];
  page.on('pageerror', (error) => issues.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') issues.push(message.text());
  });
  // Keep the measurement independent of external photo CDN availability.
  await page.route('**/_next/image?**', (route) =>
    route.fulfill({ body: image, contentType: 'image/webp' }),
  );
  return issues;
}
const axeTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
async function audit(page: Page, label: string) {
  const result = await new AxeBuilder({ page }).withTags(axeTags).analyze();
  assert.deepEqual(
    result.violations.map(({ id, nodes }) => ({
      id,
      targets: nodes.map(({ target }) => target),
    })),
    [],
    label,
  );
}
async function capture(page: Page, name: string) {
  await page.screenshot({ path: join(output, name + '.png') });
  screenshots++;
}

async function desktop(page: Page, theme: 'light' | 'dark') {
  const issues = await prepare(page);
  await page.goto(site + '/');
  await expect(
    page.getByRole('link', { name: 'Tai nghe không dây' }).first(),
  ).toBeVisible();
  const mascot = page.locator('[data-mascot]');
  await expect(mascot).toBeVisible();
  const tile = page.locator('[data-mascot-sprite]');
  const toggle = page.getByRole('switch', { name: 'Chế độ tối' });
  await expect(toggle).toHaveAttribute(
    'aria-checked',
    String(theme === 'dark'),
  );
  await audit(page, 'desktop ' + theme);
  await capture(page, 'desktop-' + theme);
  const initial = await mascot.boundingBox();
  assert.ok(initial);
  if (theme === 'light') {
    await expect
      .poll(
        async () => {
          const box = await mascot.boundingBox();
          return box ? Math.hypot(box.x - initial.x, box.y - initial.y) : 0;
        },
        { timeout: 10_000 },
      )
      .toBeGreaterThan(12);
    const latest = await mascot.boundingBox();
    assert.ok(latest);
    const x = latest.x < 645 ? latest.x + 340 : latest.x - 340;
    const y = 280;
    await page.mouse.move(x, y, { steps: 12 });
    await expect(mascot).toHaveAttribute('data-state', 'curious', {
      timeout: 9500,
    });
    const gap = async () => {
      const box = await mascot.boundingBox();
      return box
        ? Math.hypot(box.x + box.width / 2 - x, box.y + box.height / 2 - y)
        : Infinity;
    };
    await expect.poll(gap, { timeout: 12_000 }).toBeLessThanOrEqual(64);
    assert.ok((await gap()) >= 48);
    await capture(page, 'desktop-curiosity');
    let spot = await tile.boundingBox();
    assert.ok(spot);
    await page.mouse.move(spot.x + 24, spot.y + 24, { steps: 24 });
    await page.mouse.down();
    await expect(mascot).toHaveAttribute('data-state', 'held');
    await page.mouse.move(41, 150, { steps: 18 });
    await capture(page, 'desktop-held');
    await page.mouse.up();
    await expect(mascot).toHaveAttribute('data-state', 'fall');
    await expect
      .poll(async () => Math.round((await mascot.boundingBox())?.y ?? 0), {
        timeout: 3500,
      })
      .toBe(836);
    await expect(mascot).toHaveAttribute('data-state', 'idle');
    spot = await tile.boundingBox();
    assert.ok(spot);
    await page.mouse.move(spot.x + 24, spot.y + 24, { steps: 28 });
    await page.mouse.down();
    await page.mouse.up();
    await expect(page.locator('[data-mascot-bubble]')).toBeVisible();
    await capture(page, 'desktop-bubble');
    await expect(page.locator('[data-mascot-bubble]')).toBeHidden({
      timeout: 3500,
    });
  }
  await toggle.focus();
  await page.keyboard.press('Space');
  if (
    await page.evaluate(
      () => typeof document.startViewTransition === 'function',
    )
  ) {
    await expect(page.locator('html')).toHaveAttribute('data-theme-reveal', '');
    if (theme === 'light') await capture(page, 'desktop-theme-reveal');
  }
  await expect(toggle).toHaveAttribute(
    'aria-checked',
    String(theme === 'light'),
  );
  await expect(page.locator('html')).not.toHaveAttribute(
    'data-theme-reveal',
    '',
  );
  await page.getByRole('button', { name: 'Tìm sản phẩm', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(mascot).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(mascot).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 700));
  const top = page.getByRole('button', { name: 'Cuộn lên đầu trang' });
  await expect(top).toBeVisible();
  await top.focus();
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
  await expect(page.locator('#content')).toBeFocused();
  await expect(top).toHaveCount(0);
  await page.getByRole('button', { name: 'Ẩn linh vật' }).click();
  await expect(mascot).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Hiện linh vật' }),
  ).toBeVisible();
  await expect(mascot).toHaveCount(0);
  if (issues.length) throw new Error('Browser errors: ' + issues.join('\n'));
}

async function mobile(page: Page, theme: 'light' | 'dark') {
  const issues = await prepare(page);
  await page.goto(site + '/');
  const mascot = page.locator('[data-mascot]');
  await expect(mascot).toBeVisible();
  await audit(page, 'mobile ' + theme);
  await capture(page, 'mobile-' + theme);
  if (theme === 'light') {
    const box = await mascot.boundingBox();
    assert.ok(box);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: box.x + 24, y: box.y + 24 }],
    });
    await expect(mascot).toHaveAttribute('data-state', 'held');
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: box.x + 26, y: 260 }],
    });
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });
    await expect(mascot).toHaveAttribute('data-state', 'fall');
    await expect(mascot).toHaveAttribute('data-state', 'idle');
    await cdp.detach();
  }
  const menu = page.getByRole('button', { name: 'Mở menu' });
  await page.evaluate(() => window.scrollTo(0, 700));
  const backToTop = page.getByRole('button', { name: 'Cuộn lên đầu trang' });
  await expect(backToTop).toBeVisible();
  await menu.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(backToTop).toHaveCount(0);
  await expect(mascot).toHaveCount(0);
  const toggle = page.getByRole('switch', { name: 'Chế độ tối' });
  await expect(toggle).toHaveAttribute(
    'aria-checked',
    String(theme === 'dark'),
  );
  await audit(page, 'mobile drawer ' + theme);
  await capture(page, 'mobile-drawer-' + theme);
  await toggle.click();
  await expect(toggle).toHaveAttribute(
    'aria-checked',
    String(theme === 'light'),
  );
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  if (issues.length) throw new Error('Browser errors: ' + issues.join('\n'));
}

const api = await startApi();
try {
  const seeded = await fetch(api.url + '/api/v1/products?limit=100');
  assert.equal(seeded.status, 200);
  const seedData: { items: unknown[] } = await seeded.json();
  assert.equal(seedData.items.length, 8);
  const next = spawn(
    process.execPath,
    [nextCli, 'start', '--hostname', 'localhost', '--port', String(port)],
    {
      cwd: webRoot,
      windowsHide: true,
      stdio: 'ignore',
      env: { ...process.env, API_INTERNAL_URL: api.url },
    },
  );
  try {
    let ready = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      assert.equal(next.exitCode, null, 'Next exited early');
      const response = await fetch(site + '/robots.txt', {
        signal: AbortSignal.timeout(400),
      }).catch(() => undefined);
      if (response) {
        assert.equal(response.status, 200);
        ready = true;
        break;
      }
      await pause(100);
    }
    assert.ok(ready, 'Next did not start');
    for (const route of ['/checkout', '/admin']) {
      const result = await fetch(site + route, { redirect: 'manual' });
      assert.equal(result.status, 307);
      assert.doesNotMatch(await result.text(), /data-mascot-sprite/);
    }
    const chunks = join(webRoot, '.next/static/chunks');
    const sizes = [];
    for (const name of (await readdir(chunks)).filter((file) =>
      file.endsWith('.js'),
    )) {
      const source = await readFile(join(chunks, name));
      if (source.includes('data-mascot-sprite'))
        sizes.push(gzipSync(source).byteLength);
    }
    assert.ok(sizes.length > 0, 'Could not locate the mascot chunk');
    const chunkBytes = sizes.reduce((a, b) => a + b, 0);
    assert.ok(chunkBytes < 10 * 1024, 'Mascot chunk exceeds 10 KiB gzip');
    const browser = await chromium.launch({
      channel: process.env.SMOKE_BROWSER_CHANNEL ?? 'msedge',
    });
    try {
      const viewport = { width: 1440, height: 900 };
      const comparison: { on: Vitals[]; off: Vitals[] } = { on: [], off: [] };
      for (let run = 0; run < 3; run++)
        for (const mode of ['off', 'on'] as const) {
          const sample = await browser.newPage({ viewport });
          await prepare(sample);
          comparison[mode].push(await measure(sample, mode === 'off'));
          await sample.close();
        }
      const median = (samples: Vitals[], field: keyof Vitals) =>
        samples.map((sample) => sample[field]).sort((a, b) => a - b)[1] ?? 0;
      const report = {
        chunkBytes,
        samples: comparison,
        off: {
          lcp: median(comparison.off, 'lcp'),
          cls: median(comparison.off, 'cls'),
          tbt: median(comparison.off, 'tbt'),
        },
        on: {
          lcp: median(comparison.on, 'lcp'),
          cls: median(comparison.on, 'cls'),
          tbt: median(comparison.on, 'tbt'),
        },
      };
      await writeFile(
        join(output, 'performance.json'),
        JSON.stringify(report, null, 2),
      );
      console.log('Performance', JSON.stringify(report));
      assert.ok(report.on.cls - report.off.cls <= 0.01);
      assert.ok(report.on.lcp - report.off.lcp <= 200);
      assert.ok(comparison.on.every((sample) => sample.maxLongTask < 250));
      for (const theme of ['light', 'dark'] as const) {
        const large = await browser.newPage({ viewport, colorScheme: theme });
        await desktop(large, theme);
        await large.close();
        const small = await browser.newPage({
          viewport: { width: 390, height: 844 },
          colorScheme: theme,
          hasTouch: true,
          isMobile: true,
        });
        await mobile(small, theme);
        await small.close();
      }
      const reduced = await browser.newPage({
        viewport,
        reducedMotion: 'reduce',
      });
      const issues = await prepare(reduced);
      await reduced.goto(site + '/');
      await expect(reduced.locator('[data-mascot]')).toHaveCount(0);
      await reduced.getByRole('switch', { name: 'Chế độ tối' }).click();
      await expect(reduced.locator('html')).not.toHaveAttribute(
        'data-theme-reveal',
        '',
      );
      await reduced.goto(site + '/sign-in');
      await expect(reduced.locator('[data-mascot]')).toHaveCount(0);
      assert.deepEqual(issues, []);
      console.log(
        'UI extras smoke passed, 6 axe scans, ' +
          screenshots +
          ' images in ' +
          output,
      );
    } finally {
      await browser.close();
    }
  } finally {
    next.kill();
  }
} finally {
  await api.close();
}
