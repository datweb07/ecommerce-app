import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium, expect, test } from '@playwright/test';
import { launch } from 'chrome-launcher';
import lighthouse, { desktopConfig } from 'lighthouse';
import { workspace } from './paths.ts';
import { queryPlans } from './query-plans.ts';
import {
  apiOrigin,
  assertSafeEnvironment,
  requireRunId,
  webOrigin,
} from './safety.ts';
import { firstProductId } from './seed.ts';

const median = (values: number[]) =>
  values.toSorted((a, b) => a - b)[Math.floor(values.length / 2)] ?? 0;
const percentile = (values: number[], fraction: number) =>
  values.toSorted((a, b) => a - b)[Math.ceil(values.length * fraction) - 1] ??
  0;
type Metrics = {
  performance: number;
  accessibility: number;
  bestPractices: number;
  seo: number;
  lcpMs: number;
  cls: number;
  tbtMs: number;
};

test.beforeAll(() => assertSafeEnvironment(process.env));

test('records MongoDB execution plans for primary query shapes', async () => {
  const plans = await queryPlans();
  expect(plans).toHaveLength(5);
  const output = join(
    workspace,
    '.cache',
    'lighthouse',
    requireRunId(process.env),
  );
  await mkdir(output, { recursive: true });
  await writeFile(
    join(output, 'mongo-explain.json'),
    JSON.stringify(plans, null, 2),
  );
});

test('records three Lighthouse runs per page and device on a production build', async () => {
  test.setTimeout(1_200_000);
  const output = join(
    workspace,
    '.cache',
    'lighthouse',
    requireRunId(process.env),
  );
  await mkdir(output, { recursive: true });
  const rows = [];
  const routes = {
    home: '/',
    catalogue: '/products',
    category: '/products?category=Electronics',
    product: '/products/' + firstProductId,
    signIn: '/sign-in',
  };
  for (const mode of ['mobile', 'desktop'] as const) {
    for (const [name, path] of Object.entries(routes)) {
      if (process.env.STOREFRONT_E2E_HOME_ONLY === '1' && name !== 'home')
        continue;
      const runs: Metrics[] = [];
      for (let index = 1; index <= 3; index++) {
        const chrome = await launch({
          chromePath: chromium.executablePath(),
          chromeFlags: [
            '--headless',
            '--disable-dev-shm-usage',
            '--no-first-run',
          ],
        });
        try {
          const result = await lighthouse(
            webOrigin + path,
            {
              port: chrome.port,
              output: 'html',
              logLevel: 'error',
            },
            mode === 'desktop' ? desktopConfig : undefined,
          );
          if (!result) throw new Error('Lighthouse did not return a report.');
          const { lhr, report } = result;
          const file = join(output, `${mode}-${name}-${index}`);
          await writeFile(
            file + '.html',
            Array.isArray(report) ? report.join('') : report,
          );
          await writeFile(file + '.json', JSON.stringify(lhr));
          expect(lhr.runtimeError, file).toBeUndefined();
          const score = (id: string) =>
            Math.round((lhr.categories[id]?.score ?? 0) * 100);
          const value = (id: string) =>
            Number((lhr.audits[id]?.numericValue ?? 0).toFixed(3));
          runs.push({
            performance: score('performance'),
            accessibility: score('accessibility'),
            bestPractices: score('best-practices'),
            seo: score('seo'),
            lcpMs: value('largest-contentful-paint'),
            cls: value('cumulative-layout-shift'),
            tbtMs: value('total-blocking-time'),
          });
        } finally {
          await chrome.kill();
        }
      }
      const keys = [
        'performance',
        'accessibility',
        'bestPractices',
        'seo',
        'lcpMs',
        'cls',
        'tbtMs',
      ] as const;
      rows.push({
        mode,
        name,
        ...Object.fromEntries(
          keys.map((key) => [key, median(runs.map((row) => row[key]))]),
        ),
      });
      await writeFile(
        join(output, 'median.json'),
        JSON.stringify(rows, null, 2),
      );
    }
  }
  console.table(rows);
  console.log('Lighthouse artifacts ' + output);
});

test('samples public API latency with five concurrent requests', async () => {
  const rows = [];
  for (const path of [
    '/products?limit=12',
    '/products?category=Electronics&sort=price',
    '/products?sort=bestselling',
  ]) {
    const samples = [];
    for (let batch = 0; batch < 5; batch++) {
      samples.push(
        ...(await Promise.all(
          Array.from({ length: 5 }, async () => {
            const started = performance.now();
            const response = await fetch(apiOrigin + '/api/v1' + path, {
              signal: AbortSignal.timeout(5000),
              redirect: 'error',
            });
            await response.arrayBuffer();
            return { ms: performance.now() - started, ok: response.ok };
          }),
        )),
      );
    }
    const times = samples.map(({ ms }) => ms);
    const row = {
      path,
      requests: times.length,
      errors: samples.filter(({ ok }) => !ok).length,
      p50: percentile(times, 0.5),
      p95: percentile(times, 0.95),
    };
    rows.push(row);
    expect(row.errors).toBe(0);
  }
  console.table(rows);
  await test.info().attach('api-latency', {
    body: JSON.stringify(rows),
    contentType: 'application/json',
  });
});
