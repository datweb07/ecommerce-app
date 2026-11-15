import 'server-only';
import { cache } from 'react';
import { notFound, redirect } from 'next/navigation';
import { serverApi } from '../api/server';
import { ApiError } from '../api/transport';
import { publicEnv } from '../../config/public-env';
import { signInUrl } from '../auth-paths';

export const requireAdminPage = cache(async () => {
  try {
    return await serverApi.admin.me();
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 403) notFound();
      if (error.status === 401)
        redirect(signInUrl(publicEnv.NEXT_PUBLIC_SITE_URL, '/admin').href);
    }
    throw error;
  }
});
