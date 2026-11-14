import { clerkMiddleware } from '@clerk/nextjs/server';
import {
  type NextRequest,
  type NextFetchEvent,
  NextResponse,
} from 'next/server';
import { serverEnv } from './config/server-env';
import { publicEnv } from './config/public-env';
import { isPrivatePath, signInUrl } from './lib/auth-paths';

function privateResponse(request: NextRequest, signedIn: boolean) {
  const response = signedIn
    ? NextResponse.next()
    : NextResponse.redirect(
        signInUrl(
          publicEnv.NEXT_PUBLIC_SITE_URL,
          request.nextUrl.pathname + request.nextUrl.search,
        ),
      );
  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return response;
}

const clerk = serverEnv.CLERK_SECRET_KEY
  ? clerkMiddleware(
      async (auth, request) => {
        if (!isPrivatePath(request.nextUrl.pathname))
          return NextResponse.next();
        return privateResponse(request, Boolean((await auth()).userId));
      },
      {
        authorizedParties: [publicEnv.NEXT_PUBLIC_SITE_URL],
        signInUrl: publicEnv.NEXT_PUBLIC_CLERK_SIGN_IN_URL,
      },
    )
  : null;

export function proxy(request: NextRequest, event: NextFetchEvent) {
  if (clerk) return clerk(request, event);
  return isPrivatePath(request.nextUrl.pathname)
    ? privateResponse(request, false)
    : NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
