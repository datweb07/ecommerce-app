import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { cleanupClerk } from './clerk-fixtures.ts';
import { appRoot, pathsFor, workspace } from './paths.ts';
import {
  assertSafeEnvironment,
  checkUploadAccount,
  clerkFrontendHost,
  missingFor,
  projects,
  type Suite,
} from './safety.ts';

const [task = 'all', ...args] = process.argv.slice(2);
const list = args.includes('--list');
const performanceRun = task === 'performance';
const zapRun = task === 'zap';
const homeOnly = performanceRun && args.includes('--home-only');
const analyze = performanceRun && args.includes('--analyze');
const available = Object.keys(projects) as Suite[];
const nodeRequire = createRequire(import.meta.url);
function execute(arguments_: string[], cwd: string, env: NodeJS.ProcessEnv) {
  return new Promise<number>((resolve, reject) => {
    const child = spawn(process.execPath, arguments_, {
      cwd,
      env,
      stdio: 'inherit',
      windowsHide: true,
    });
    child.once('error', reject);
    child.once('exit', (code) => resolve(code ?? 1));
  });
}

async function run() {
  assertSafeEnvironment(process.env);
  if (
    (!performanceRun &&
      !zapRun &&
      task !== 'all' &&
      !available.some((name) => name === task)) ||
    args.some(
      (option) =>
        option !== '--list' &&
        !(performanceRun && ['--home-only', '--analyze'].includes(option)),
    )
  )
    throw new Error('Dùng pnpm e2e[:public|:auth|:payment|:upload] [--list].');
  const selected = (
    performanceRun || zapRun
      ? ['public' as const]
      : task === 'all'
        ? available
        : [task as Suite]
  ).filter((suite) => {
    const missing = missingFor(suite, process.env);
    if (missing.length)
      console.log('@' + suite + ' CHƯA CHẠY vì thiếu ' + missing.join(', '));
    return missing.length === 0;
  });
  if (!selected.length) return 2;
  if (selected.some((suite) => suite !== 'public'))
    clerkFrontendHost(process.env);
  if (selected.includes('upload')) checkUploadAccount(process.env);
  const id = randomUUID().replaceAll('-', '');
  const paths = pathsFor(id);
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PLAYWRIGHT_BROWSERS_PATH:
      process.env.PLAYWRIGHT_BROWSERS_PATH ??
      join(workspace, '.cache', 'playwright'),
    STOREFRONT_E2E_RUN: id,
    STOREFRONT_E2E_SUITES: selected.join(','),
    STOREFRONT_E2E_HOME_ONLY: homeOnly ? '1' : '0',
    STOREFRONT_E2E_ANALYZE: analyze ? '1' : '0',
    STOREFRONT_E2E_ZAP: zapRun ? '1' : '0',
  };
  delete env.CLERK_TESTING_TOKEN;
  delete env.CLERK_FAPI;
  if (!list) {
    const temporary = join(paths.privateDir, 'tmp');
    await mkdir(temporary, { recursive: true, mode: 0o700 });
    env.TEMP = temporary;
    env.TMP = temporary;
    env.TMPDIR = temporary;
  }
  try {
    if (!list) {
      const build = await execute(
        [
          join(workspace, 'scripts', 'pnpm.mjs'),
          '--filter',
          '@storefront/shared',
          '--filter',
          '@storefront/api',
          '-r',
          'build',
        ],
        workspace,
        env,
      );
      if (build) return build;
    }
    return await execute(
      [
        nodeRequire.resolve('@playwright/test/cli'),
        'test',
        ...(performanceRun || zapRun
          ? ['--project=' + (zapRun ? 'zap' : 'performance'), '--workers=1']
          : selected.flatMap((suite) =>
              projects[suite].map((project) => '--project=' + project),
            )),
        ...(list ? ['--list'] : []),
      ],
      appRoot,
      env,
    );
  } finally {
    if (!list) {
      try {
        if (selected.some((suite) => suite !== 'public'))
          await cleanupClerk(env, id);
      } finally {
        await rm(paths.privateDir, {
          recursive: true,
          force: true,
          maxRetries: 5,
          retryDelay: 200,
        });
        console.log('Thư mục báo cáo nếu có: ' + paths.report);
      }
    }
  }
}
try {
  process.exitCode = await run();
} catch (error) {
  console.error(error instanceof Error ? error.message : 'E2E không thể chạy.');
  process.exitCode = 1;
}
