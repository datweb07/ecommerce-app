'use client';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../ui/button';
import { ProductImage } from './product-image';
import { t } from '../../lib/i18n';

export function Gallery({ name, images }: { name: string; images: string[] }) {
  const [selected, setSelected] = useState(0);
  const hasMore = images.length > 1;
  const select = (index: number) =>
    setSelected((index + images.length) % images.length);
  const alt = (index: number) =>
    `${name} · ${t('detail', 'photo')} ${index + 1}`;
  return (
    <div className="min-w-0 space-y-3">
      <div className="relative aspect-square overflow-hidden rounded-[2px] bg-muted">
        <ProductImage
          source={images[selected]}
          alt={alt(selected)}
          preload={selected === 0}
          sizes="(max-width: 767px) 92vw, 540px"
          className="object-contain"
        />
        {hasMore && (
          <div className="absolute inset-x-3 bottom-3 flex justify-between">
            <Button
              variant="outline"
              className="bg-background"
              size="icon"
              aria-label={t('detail', 'previousPhoto')}
              onClick={() => select(selected - 1)}
            >
              <ChevronLeft aria-hidden="true" />
            </Button>
            <Button
              variant="outline"
              className="bg-background"
              size="icon"
              aria-label={t('detail', 'nextPhoto')}
              onClick={() => select(selected + 1)}
            >
              <ChevronRight aria-hidden="true" />
            </Button>
          </div>
        )}
      </div>
      {hasMore && (
        <ul
          className="flex flex-wrap gap-2"
          aria-label={t('detail', 'gallery')}
        >
          {images.map((image, index) => (
            <li key={image + index}>
              <button
                type="button"
                aria-label={alt(index)}
                aria-pressed={selected === index}
                className="relative block size-16 overflow-hidden rounded-[2px] bg-muted aria-pressed:outline-2 aria-pressed:outline-offset-2 aria-pressed:outline-primary"
                onClick={() => select(index)}
              >
                <ProductImage
                  source={image}
                  alt={alt(index)}
                  sizes="64px"
                  className="object-cover"
                />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
