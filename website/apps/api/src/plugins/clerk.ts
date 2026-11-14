import { createClerkClient } from '@clerk/fastify';
import type { Env } from '../config/env.js';
import { ApiError } from './errors.js';

export interface Identity {
  email: string;
  name: string;
  imageUrl: string;
  verified: boolean;
}
export interface ClerkAdapter {
  authenticate(authorization: string): Promise<string | null>;
  identity(clerkId: string): Promise<Identity | null>;
}

// Fastify API authentication uses the Clerk SDK without forwarding handshake
// headers, cookies or redirects from the browser middleware.
export function clerkAdapter(env: Env): ClerkAdapter | undefined {
  if (!env.CLERK_SECRET_KEY || !env.CLERK_PUBLISHABLE_KEY) return;
  const client = createClerkClient({
    secretKey: env.CLERK_SECRET_KEY,
    publishableKey: env.CLERK_PUBLISHABLE_KEY,
  });
  return {
    async authenticate(authorization) {
      try {
        const result = await client.authenticateRequest(
          new Request(env.WEB_ORIGIN, { headers: { authorization } }),
          {
            acceptsToken: 'session_token',
            authorizedParties: env.CORS_ORIGINS,
          },
        );
        return result.toAuth()?.userId ?? null;
      } catch {
        throw new ApiError(
          503,
          'CLERK_UNAVAILABLE',
          'Chưa thể xác minh phiên đăng nhập.',
        );
      }
    },
    async identity(clerkId) {
      try {
        const user = await client.users.getUser(clerkId);
        const email = user.emailAddresses.find(
          (entry) => entry.id === user.primaryEmailAddressId,
        );
        return email
          ? {
              email: email.emailAddress,
              verified: email.verification?.status === 'verified',
              name:
                [user.firstName, user.lastName].filter(Boolean).join(' ') ||
                'Khách hàng',
              imageUrl: user.imageUrl,
            }
          : null;
      } catch (error) {
        if (
          typeof error === 'object' &&
          error !== null &&
          'status' in error &&
          error.status === 404
        )
          return null;
        throw new ApiError(
          503,
          'CLERK_UNAVAILABLE',
          'Chưa thể đồng bộ tài khoản.',
        );
      }
    },
  };
}
