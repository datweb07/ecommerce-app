import { publicEnv } from '../config/public-env';

export const privateRoots = [
  '/cart',
  '/checkout',
  '/wishlist',
  '/account',
  '/admin',
];
export const isPrivatePath = (path: string) =>
  privateRoots.some((root) => path === root || path.startsWith(root + '/'));
export function signInUrl(origin: string, returnPath: string) {
  const url = new URL(publicEnv.NEXT_PUBLIC_CLERK_SIGN_IN_URL, origin);
  const target = new URL(returnPath, origin);
  const onSignIn =
    target.pathname === url.pathname ||
    target.pathname.startsWith(url.pathname + '/');
  if (target.origin === url.origin && !onSignIn) {
    url.searchParams.set('redirect_url', target.href);
  }
  return url;
}
