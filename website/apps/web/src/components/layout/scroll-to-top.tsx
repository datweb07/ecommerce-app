'use client';

import { ArrowUp } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { prefersReducedMotion } from '../../lib/motion';
import { t } from '../../lib/i18n';

const threshold = 400;

export function ScrollToTop() {
  const [shown, setShown] = useState(false);
  const [returning, setReturning] = useState(false);
  const sentinel = useRef<HTMLSpanElement>(null);
  const finishScroll = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (sentinel.current && typeof IntersectionObserver !== 'undefined') {
      const observer = new IntersectionObserver(
        ([edge]) => {
          if (edge) setShown(!edge.isIntersecting);
        },
        { rootMargin: threshold + 'px 0px 0px' },
      );
      observer.observe(sentinel.current);
      return () => observer.disconnect();
    }

    let frame: number | null = null;
    const read = () => {
      setShown(window.scrollY > threshold);
      frame = null;
    };
    const track = () => {
      if (frame === null) frame = requestAnimationFrame(read);
    };
    track();
    window.addEventListener('scroll', track, { passive: true });
    return () => {
      window.removeEventListener('scroll', track);
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => () => finishScroll.current?.(), []);

  function toTop() {
    if (returning) return;
    const focusMain = () =>
      document.getElementById('content')?.focus({ preventScroll: true });
    if (prefersReducedMotion()) {
      window.scrollTo({ top: 0, behavior: 'auto' });
      focusMain();
      return;
    }

    setReturning(true);
    const deadline = performance.now() + 8000;
    let frame: number | null = null;
    const settleWhenReady = () => {
      if (window.scrollY > 1 && performance.now() < deadline) {
        frame ??= requestAnimationFrame(() => {
          frame = null;
          settleWhenReady();
        });
        return;
      }
      finishScroll.current?.();
      setReturning(false);
      if (window.scrollY <= 1) focusMain();
    };
    finishScroll.current = () => {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
      window.removeEventListener('scrollend', settleWhenReady);
      finishScroll.current = null;
    };
    window.addEventListener('scrollend', settleWhenReady);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    frame = requestAnimationFrame(settleWhenReady);
  }

  return (
    <>
      <span
        ref={sentinel}
        aria-hidden="true"
        className="pointer-events-none absolute top-0 left-0 size-px"
      />
      <button
        type="button"
        aria-label={t('uiExtras', 'scrollTop')}
        aria-hidden={shown || returning ? undefined : true}
        tabIndex={shown && !returning ? 0 : -1}
        data-mascot-avoid=""
        className={
          'fixed right-[calc(1rem+env(safe-area-inset-right))] bottom-[calc(1rem+env(safe-area-inset-bottom))] z-40 grid size-11 place-items-center rounded-[2px] border border-control-border bg-background text-foreground transition-[opacity,translate] duration-200 hover:bg-muted motion-reduce:transition-none ' +
          (shown
            ? 'translate-y-0 opacity-100'
            : 'pointer-events-none translate-y-2 opacity-0')
        }
        onClick={toTop}
      >
        <ArrowUp size={21} strokeWidth={1.5} aria-hidden="true" />
      </button>
    </>
  );
}
