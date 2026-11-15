import Image, { getImageProps } from 'next/image';
import Link from 'next/link';
import type { PublicBanner } from '@storefront/shared';

export function StorefrontBanner({ banner }: { banner: PublicBanner }) {
  const { alt, title, subtitle, href, ctaLabel, imageDesktop, imageMobile } =
    banner;
  const { props: mobile } = getImageProps({
    src: imageMobile.url,
    alt,
    width: imageMobile.width,
    height: imageMobile.height,
    sizes: '100vw',
  });
  return (
    <Link
      href={href}
      className="group block focus-visible:outline-2 focus-visible:outline-offset-4"
    >
      <picture className="block aspect-[4/5] overflow-hidden bg-muted sm:aspect-[12/5]">
        <source
          media="(max-width: 639px)"
          srcSet={mobile.srcSet ?? mobile.src}
          sizes={mobile.sizes}
        />
        <Image
          src={imageDesktop.url}
          width={imageDesktop.width}
          height={imageDesktop.height}
          alt={alt}
          sizes="(max-width: 1279px) 100vw, 1280px"
          className="h-full w-full object-cover"
        />
      </picture>
      {(title || subtitle || ctaLabel) && (
        <div className="space-y-2 pt-4">
          {title && <h2 className="text-section font-medium">{title}</h2>}
          {subtitle && (
            <p className="text-body text-muted-foreground">{subtitle}</p>
          )}
          {ctaLabel && (
            <span className="text-label group-hover:underline">{ctaLabel}</span>
          )}
        </div>
      )}
    </Link>
  );
}
