type Environment = Record<string, string | undefined>;
export const cloudinaryImageName = /^[a-z0-9][a-z0-9_-]{0,127}$/;

export function isNonIndexableDeployment(env: Environment) {
  return env.DEPLOY_ENV === 'staging' || env.VERCEL_ENV === 'preview';
}

export function assertWebDeployment(env: Environment) {
  const invalid: string[] = [];
  const target = env.DEPLOY_ENV;
  if (env.VERCEL_ENV === 'preview' && target !== 'staging')
    invalid.push('DEPLOY_ENV');
  if (
    (env.NODE_ENV === 'production' && !target) ||
    (target && !['local', 'staging', 'production'].includes(target))
  )
    invalid.push('DEPLOY_ENV');
  if (target === 'local' && env.NODE_ENV === 'production') {
    for (const name of [
      'NEXT_PUBLIC_API_URL',
      'API_INTERNAL_URL',
      'NEXT_PUBLIC_SITE_URL',
    ]) {
      if (
        env[name] &&
        !/^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/.test(env[name])
      )
        invalid.push(name);
    }
    if (env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith('pk_live_'))
      invalid.push('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY');
    if (env.CLERK_SECRET_KEY?.startsWith('sk_live_'))
      invalid.push('CLERK_SECRET_KEY');
  }
  if (target === 'staging' || target === 'production') {
    if (!cloudinaryImageName.test(env.CLOUDINARY_IMAGE_CLOUD_NAME ?? ''))
      invalid.push('CLOUDINARY_IMAGE_CLOUD_NAME');
    if (
      env.WEB_HSTS_MAX_AGE !== undefined &&
      (!/^\d{1,8}$/.test(env.WEB_HSTS_MAX_AGE) ||
        Number(env.WEB_HSTS_MAX_AGE) < 300 ||
        Number(env.WEB_HSTS_MAX_AGE) > 31536000)
    ) {
      invalid.push('WEB_HSTS_MAX_AGE');
    }
    if (env.NODE_ENV !== 'production') invalid.push('NODE_ENV');
    for (const name of [
      'NEXT_PUBLIC_API_URL',
      'API_INTERNAL_URL',
      'NEXT_PUBLIC_SITE_URL',
    ]) {
      try {
        const url = new URL(env[name] ?? '');
        if (
          url.protocol !== 'https:' ||
          url.origin !== env[name] ||
          /^(localhost|127\.|0\.|\[|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)|\.localhost$|\*/i.test(
            url.hostname,
          )
        )
          invalid.push(name);
      } catch {
        invalid.push(name);
      }
    }
    const mode = target === 'production' ? 'live' : 'test';
    if (
      !new RegExp('^pk_' + mode + '_[A-Za-z0-9_-]+$').test(
        env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? '',
      )
    ) {
      invalid.push('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY');
    }
    if (
      !new RegExp('^sk_' + mode + '_[A-Za-z0-9_-]+$').test(
        env.CLERK_SECRET_KEY ?? '',
      )
    )
      invalid.push('CLERK_SECRET_KEY');
  }
  if (invalid.length)
    throw new Error('Invalid environment: ' + [...new Set(invalid)].join(', '));
}
