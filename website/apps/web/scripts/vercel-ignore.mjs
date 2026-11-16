import { execFileSync } from 'node:child_process';

// Vercel ignores the build on exit 0. Unknown history and CLI releases build.
const base = process.env.VERCEL_GIT_PREVIOUS_SHA;
const head = process.env.VERCEL_GIT_COMMIT_SHA;
if (
  !base ||
  !head ||
  base === head ||
  ![base, head].every((sha) => /^[a-f0-9]{40}$/i.test(sha))
) {
  process.exit(1);
}

try {
  const top = execFileSync('git', ['rev-parse', '--show-toplevel'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
  const paths = execFileSync(
    'git',
    ['diff', '--no-renames', '--name-only', '-z', base, head, '--'],
    { cwd: top, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
  ).split('\0');
  const affectsWeb = paths.some((path) =>
    /^(website\/(?:apps\/web\/|packages\/shared\/|package\.json$|pnpm-lock\.yaml$|pnpm-workspace\.yaml$|tsconfig\.base\.json$|\.npmrc$|\.nvmrc$)|\.vercelignore$)/.test(
      path,
    ),
  );
  process.exitCode = affectsWeb ? 1 : 0;
} catch {
  process.exitCode = 1;
}
