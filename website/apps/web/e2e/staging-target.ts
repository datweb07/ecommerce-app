import { clerkFrontendHost } from './safety.ts';

type Environment = Record<string, string | undefined>;

export function stagingTarget(env: Environment) {
  if (env.DEPLOY_ENV !== 'staging')
    throw new Error('Set DEPLOY_ENV=staging to run hosted E2E.');
  const required = [
    'STAGING_WEB_ORIGIN',
    'STAGING_API_ORIGIN',
    'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
    'CLERK_SECRET_KEY',
    'STAGING_TEST_EMAIL',
    'STAGING_TEST_PASSWORD',
  ] as const;
  const missing = required.filter((name) => !env[name]?.trim());
  if (missing.length)
    throw new Error('Missing environment: ' + missing.join(', '));
  const httpsOrigin = (name: 'STAGING_WEB_ORIGIN' | 'STAGING_API_ORIGIN') => {
    const value = env[name]!;
    const url = URL.parse(value);
    if (
      url?.protocol !== 'https:' ||
      url.origin !== value ||
      url.port ||
      !/^(?:[a-z0-9-]+\.)+[a-z]{2,}$/.test(url.hostname) ||
      /\.(?:localhost|local|internal|invalid|test)$/.test(url.hostname)
    )
      throw new Error('Invalid staging allowlist origin: ' + name);
    return value;
  };
  const web = httpsOrigin('STAGING_WEB_ORIGIN');
  const api = httpsOrigin('STAGING_API_ORIGIN');
  if (web === api) throw new Error('Staging web and API origins must differ.');
  return { web, api, clerkHost: clerkFrontendHost(env) };
}
