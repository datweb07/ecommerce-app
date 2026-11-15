import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { workspace } from './paths.ts';
import {
  apiOrigin,
  assertSafeEnvironment,
  requireRunId,
  webOrigin,
} from './safety.ts';

function docker(args: string[]) {
  return new Promise<number>((resolve, reject) => {
    const daemon =
      process.platform === 'win32'
        ? 'npipe:////./pipe/dockerDesktopLinuxEngine'
        : 'unix:///var/run/docker.sock';
    const env = { ...process.env };
    delete env.DOCKER_CONTEXT;
    delete env.DOCKER_HOST;
    const child = spawn('docker', ['--host', daemon, ...args], {
      env,
      stdio: 'inherit',
      windowsHide: true,
    });
    child.once('error', reject);
    child.once('exit', (code) => resolve(code ?? 1));
  });
}

test('runs passive ZAP baseline against the isolated loopback web and API', async () => {
  test.setTimeout(720_000);
  assertSafeEnvironment(process.env);
  expect(
    await docker(['version', '--format', '{{.Server.Version}}']),
    'Docker daemon',
  ).toBe(0);
  const output = join(workspace, '.cache', 'zap', requireRunId(process.env));
  await mkdir(output, { recursive: true });
  const image = 'ghcr.io/zaproxy/zaproxy:stable';
  const linux = process.platform === 'linux';
  const scans = [
    ['web', webOrigin],
    ['api', apiOrigin + '/api/v1/products'],
  ] as const;
  const results: number[] = [];
  for (const [name, target] of scans) {
    const url = new URL(target);
    if (!linux) url.hostname = 'host.docker.internal';
    const code = await docker([
      'run',
      '--rm',
      ...(linux ? ['--network=host'] : []),
      '--mount',
      'type=bind,source=' + output + ',target=/zap/wrk',
      image,
      'zap-baseline.py',
      '-s',
      '-t',
      url.href,
      '-T',
      '4',
      '-r',
      name + '.html',
      '-J',
      name + '.json',
    ]);
    results.push(code);
  }
  console.log('ZAP reports ' + output);
  expect(results, 'ZAP exit codes (2 means warnings exist)').toEqual([0, 0]);
});
