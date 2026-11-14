'use client';
import Image from 'next/image';
import { ImageOff } from 'lucide-react';
import { useState } from 'react';
import { t } from '../../lib/i18n';

export function productImageUrl(value: string | undefined) {
  if (!value) return undefined;
  const url = URL.canParse(value) ? new URL(value) : null;
  if (
    url?.protocol === 'https:' &&
    !url.port &&
    !url.username &&
    !url.password &&
    ['res.cloudinary.com', 'images.unsplash.com'].includes(url.hostname)
  )
    return url.href;
}

export function ProductImage({
  source,
  alt,
  sizes,
  preload = false,
  className,
}: {
  source?: string | undefined;
  alt: string;
  sizes: string;
  preload?: boolean;
  className?: string;
}) {
  const [failed, setFailed] = useState<string>();
  const src = productImageUrl(source);
  if (!src || failed === src)
    return (
      <div
        className="grid h-full w-full place-items-center bg-muted text-muted-foreground"
        role="img"
        aria-label={t('catalogue', 'imageUnavailable')}
      >
        <ImageOff aria-hidden="true" />
      </div>
    );
  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      preload={preload}
      className={className}
      onError={() => setFailed(src)}
    />
  );
}
