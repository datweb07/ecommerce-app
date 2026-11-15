import Image, { getImageProps } from 'next/image';
import Link from 'next/link';
import type { PublicBanner } from '@storefront/shared';

export function StorefrontBanner({
  banner,
  preview,
  showImage = true,
  prioritizeImage = false,
}: {
  banner: PublicBanner;
  preview?: 'desktop' | 'mobile';
  showImage?: boolean;
  prioritizeImage?: boolean;
}) {
  const { alt, title, subtitle, href, ctaLabel, imageDesktop, imageMobile } =
    banner;
  const { props: mobile } = getImageProps({
    src: imageMobile.url,
    alt,
    width: imageMobile.width,
    height: imageMobile.height,
    sizes: 'calc(100vw - 40px)',
  });
  const displayed = preview === 'mobile' ? imageMobile : imageDesktop;
  const pictureClass =
    preview === 'mobile'
      ? 'aspect-[4/5]'
      : preview === 'desktop'
        ? 'aspect-[12/5]'
        : 'aspect-[4/5] sm:aspect-[12/5]';
  const contents = (
    <>
      <picture className={'block overflow-hidden bg-muted ' + pictureClass}>
        {showImage && !preview && (
          <source
            media="(max-width: 639px)"
            srcSet={mobile.srcSet ?? mobile.src}
            sizes={mobile.sizes}
          />
        )}
        {showImage && (
          <Image
            src={displayed.url}
            width={displayed.width}
            height={displayed.height}
            alt={alt}
            sizes="(max-width: 1279px) calc(100vw - 40px), 1280px"
            loading={prioritizeImage ? 'eager' : 'lazy'}
            fetchPriority={prioritizeImage ? 'high' : 'auto'}
            className="h-full w-full object-cover"
          />
        )}
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
    </>
  );
  return preview ? (
    <div>{contents}</div>
  ) : (
    <Link
      href={href}
      prefetch={false}
      data-mascot-avoid=""
      className="group block focus-visible:outline-2 focus-visible:outline-offset-4"
    >
      {contents}
    </Link>
  );
}
