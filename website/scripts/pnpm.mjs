import { spawn } from 'node:child_process';

// Invoke pnpm via its JS entry point: Windows nested .cmd shims can resolve
// against another Node installation when a workspace-local runtime is on PATH.
const entry = process.env.npm_execpath;
if (!entry) throw new Error('Run this helper through a pnpm workspace script.');
const child = spawn(process.execPath, [entry, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: process.env,
});
child.on('error', () => {
  process.exitCode = 1;
});
child.on('exit', (code) => {
  process.exitCode = code ?? 1;
});
