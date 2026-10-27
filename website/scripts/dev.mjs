import { spawn } from 'node:child_process';

const entry = process.env.npm_execpath;
if (!entry) throw new Error('Run pnpm dev from website.');
const children = ['shared', 'api', 'web'].map((name) =>
  spawn(process.execPath, [entry, '--filter', `@storefront/${name}`, 'dev'], {
    stdio: 'inherit',
  }),
);
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (!child.pid) continue;
    if (process.platform === 'win32')
      spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
        stdio: 'ignore',
      });
    else child.kill('SIGTERM');
  }
  process.exitCode = code;
}
for (const child of children) {
  child.on('error', () => stop(1));
  child.on('exit', (code) => stop(code ?? 1));
}
process.once('SIGINT', () => stop());
process.once('SIGTERM', () => stop());
