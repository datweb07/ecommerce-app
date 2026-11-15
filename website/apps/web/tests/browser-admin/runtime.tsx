import type { ComponentProps } from 'react';
import type { ImageProps } from 'next/image';

export function usePathname() {
  return location.pathname;
}
export function useRouter() {
  return {
    push: (url: string) => location.assign(url),
    replace: (url: string) => location.replace(url),
  };
}
export const useAuth = () => ({
  getToken: async () => 'browser-fixture-token',
});
export const auth = async () => ({
  getToken: async () => 'browser-fixture-token',
});
export function UserButton() {
  return (
    <span className="text-sm" aria-label="Tài khoản quản trị">
      AD
    </span>
  );
}
export function revalidateTag() {}

export function PreviewLink({
  href,
  prefetch,
  children,
  ...props
}: ComponentProps<'a'> & { prefetch?: boolean }) {
  return (
    <a href={href} data-prefetch={prefetch} {...props}>
      {children}
    </a>
  );
}
function imageProps({
  src,
  fill,
  loader,
  preload,
  placeholder,
  blurDataURL,
  unoptimized,
  quality,
  ...props
}: ImageProps) {
  return {
    ...props,
    src:
      typeof src === 'string'
        ? src
        : 'default' in src
          ? src.default.src
          : src.src,
    'data-fixture-fill': fill,
    'data-fixture-loader': Boolean(loader),
    'data-fixture-preload': preload,
    'data-fixture-placeholder': placeholder,
    'data-fixture-blur': Boolean(blurDataURL),
    'data-fixture-unoptimized': unoptimized,
    'data-fixture-quality': quality,
    ...(fill
      ? {
          style: {
            position: 'absolute' as const,
            inset: 0,
            width: '100%',
            height: '100%',
            ...props.style,
          },
        }
      : {}),
  };
}
export function getImageProps(props: ImageProps) {
  return { props: imageProps(props) };
}
export function PreviewImage(props: ImageProps) {
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text -- Fixture only, the input is the real Next Image type.
  return <img {...imageProps(props)} />;
}
