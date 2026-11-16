import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const cwd = fileURLToPath(new URL('../', import.meta.url));
const compose = (...args) =>
  execFileSync(
    'docker',
    ['compose', '-f', 'docker-compose.prod.yml', '--profile', 'multi', ...args],
    {
      cwd,
      encoding: 'utf8',
    },
  ).trim();

async function status(port, path) {
  const response = await fetch('http://127.0.0.1:' + port + path, {
    signal: AbortSignal.timeout(5000),
    redirect: 'manual',
  });
  await response.body?.cancel();
  return response.status;
}

for (const port of [4011, 4012]) {
  assert.equal(await status(port, '/health/live'), 200);
  assert.equal(await status(port, '/health/ready'), 200);
  assert.equal(await status(port, '/docs'), 404);
  assert.equal(await status(port, '/openapi.json'), 404);
  assert.equal(await status(port, '/api/v1/products'), 200);
}
const index = (verb) =>
  compose('exec', '-T', 'api2', 'node', 'dist/scripts/indexes.js', verb);
assert.match(index('--dry-run'), /Dry run/);
assert.match(index('--apply'), /indexes applied/);
assert.match(index('--apply'), /indexes applied/);
const id = compose('ps', '-q', 'api');
assert.match(id, /^[a-z0-9]+$/);
compose('stop', 'api');
const code = execFileSync(
  'docker',
  ['inspect', '--format', '{{.State.ExitCode}}', id],
  { encoding: 'utf8' },
).trim();
assert.equal(code, '0');
assert.match(compose('logs', '--no-color', 'api'), /API drained/);
assert.equal(await status(4012, '/health/ready'), 200);
console.log(
  'Two APIs ready, indexes dry-run/apply/reapply, SIGTERM exit 0, second API still ready.',
);
