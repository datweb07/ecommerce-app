'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { ArrowLeft, ArrowRight, Pause, Play } from 'lucide-react';
import type { PublicBanner } from '@storefront/shared';
import { t } from '../../lib/i18n';
import { prefersReducedMotion, reducedMotionQuery } from '../../lib/motion';
import { Button } from '../ui/button';
import { StorefrontBanner } from './banner';

export const rotationMs = 6000;
const serverDefault = () => false;
function subscribeMotion(notify: () => void) {
  const query = window.matchMedia?.(reducedMotionQuery);
  query?.addEventListener?.('change', notify);
  return () => query?.removeEventListener?.('change', notify);
}
function subscribeVisibility(notify: () => void) {
  document.addEventListener('visibilitychange', notify);
  return () => document.removeEventListener('visibilitychange', notify);
}

export function BannerCarousel({ banners }: { banners: PublicBanner[] }) {
  const [position, setPosition] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const reduced = useSyncExternalStore(
    subscribeMotion,
    prefersReducedMotion,
    serverDefault,
  );
  const hidden = useSyncExternalStore(
    subscribeVisibility,
    () => document.hidden,
    serverDefault,
  );
  const count = banners.length;
  const current = count ? position % count : 0;
  const rotating = count > 1 && !paused && !hovered && !reduced && !hidden;

  useEffect(() => {
    if (!rotating) return;
    const timer = window.setInterval(
      () => setPosition((index) => (index + 1) % count),
      rotationMs,
    );
    return () => window.clearInterval(timer);
  }, [count, rotating]);

  function move(delta: number) {
    setPaused(true);
    setPosition((index) => (index + delta + count) % count);
  }

  const first = banners[0];
  if (!first) return null;
  if (count === 1) return <StorefrontBanner banner={first} />;

  return (
    <section
      aria-label={t('banner', 'label')}
      aria-roledescription={t('banner', 'carousel')}
      className="space-y-3"
      data-mascot-avoid=""
      onPointerEnter={(event) => {
        if (event.pointerType === 'mouse') setHovered(true);
      }}
      onPointerLeave={() => setHovered(false)}
      onFocusCapture={(event) => {
        if (event.target.matches(':focus-visible')) setPaused(true);
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          disabled={reduced}
          onClick={() => setPaused((value) => !value)}
        >
          {paused || reduced ? (
            <Play size={16} aria-hidden="true" />
          ) : (
            <Pause size={16} aria-hidden="true" />
          )}
          {t('banner', reduced ? 'reduced' : paused ? 'resume' : 'pause')}
        </Button>
        <Button
          variant="outline"
          size="icon"
          aria-label={t('banner', 'previous')}
          onClick={() => move(-1)}
        >
          <ArrowLeft size={18} aria-hidden="true" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          aria-label={t('banner', 'next')}
          onClick={() => move(1)}
        >
          <ArrowRight size={18} aria-hidden="true" />
        </Button>
        <span
          aria-hidden="true"
          className="ml-auto text-sm text-muted-foreground tabular-nums"
        >
          {current + 1} / {count}
        </span>
      </div>
      <div className="grid" aria-live={rotating ? 'off' : 'polite'}>
        {banners.map((banner, index) => (
          <div
            key={banner.id}
            role="group"
            aria-roledescription={t('banner', 'slide')}
            aria-label={String(index + 1) + ' / ' + count}
            aria-hidden={index === current ? undefined : true}
            inert={index !== current}
            className={
              'col-start-1 row-start-1 ' +
              (index === current ? '' : 'invisible')
            }
          >
            <StorefrontBanner banner={banner} showImage={index === current} />
          </div>
        ))}
      </div>
    </section>
  );
}
