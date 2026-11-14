'use client';

import { useAuth } from '@clerk/nextjs';
import { useMemo } from 'react';
import { publicEnv } from '../../config/public-env';
import { signInUrl } from '../auth-paths';
import { createApi } from './domains';
import { createTransport, type TokenGetter } from './transport';

export function apiClient(getToken?: TokenGetter, onUnauthorized?: () => void) {
  return createApi(
    createTransport({
      origin: publicEnv.NEXT_PUBLIC_API_URL,
      getToken,
      onUnauthorized,
      browser: true,
    }),
  );
}

export function useApiClient() {
  const { getToken } = useAuth();
  return useMemo(
    () =>
      apiClient(getToken, () => {
        const path = location.pathname + location.search;
        location.assign(signInUrl(location.origin, path));
      }),
    [getToken],
  );
}
