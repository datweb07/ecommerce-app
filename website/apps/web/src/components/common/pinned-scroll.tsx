'use client';

import {
  createContext,
  useEffect,
  useRef,
  type ReactNode,
  type RefObject,
} from 'react';
import { pinProgress, pinStep } from '../../lib/pin-progress';
import { cn } from '../../lib/utils';
import styles from './pinned-scroll.module.css';

const pinMedia =
  '(min-width: 48rem) and (min-height: 500px) and (prefers-reduced-motion: no-preference)';

export const PinProgressContext = createContext<RefObject<number> | null>(null);

type Step = { id: string; title: string; description: string; icon: ReactNode };

export function PinnedScroll({
  id,
  title,
  steps,
  skipTarget,
  skipLabel,
  className,
}: {
  id: string;
  title: string;
  steps: readonly Step[];
  skipTarget: string;
  skipLabel: string;
  className?: string;
}) {
  const trackRef = useRef<HTMLElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const numberRef = useRef<HTMLSpanElement>(null);
  const progress = useRef(0);
  const count = steps.length;

  useEffect(() => {
    const track = trackRef.current;
    const frame = frameRef.current;
    const number = numberRef.current;
    if (!track || !frame || !number || count < 2 || !window.matchMedia) return;
    const media = window.matchMedia(pinMedia);
    let pending: number | null = null;
    let captured = -1;

    function draw() {
      pending = null;
      if (!track || !frame || !number) return;
      const offset = Number.parseFloat(getComputedStyle(frame).top) || 0;
      const distance = track.offsetHeight - frame.offsetHeight;
      const value = pinProgress(
        track.getBoundingClientRect().top,
        offset,
        distance,
      );
      if (captured === value) return;
      captured = value;
      progress.current = value;
      track.style.setProperty('--pin-progress', String(value));
      track.style.setProperty('--pin-position', String(value * (count - 1)));
      const active = pinStep(value, count) + 1;
      track.dataset.pinStep = String(active);
      const label = String(active).padStart(2, '0');
      if (number.textContent !== label) number.textContent = label;
    }

    function schedule() {
      if (pending === null) pending = requestAnimationFrame(draw);
    }

    function stop() {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      if (pending !== null) cancelAnimationFrame(pending);
      pending = null;
      captured = -1;
      progress.current = 0;
      if (track) {
        delete track.dataset.pinEnhanced;
        delete track.dataset.pinStep;
        track.style.removeProperty('--pin-progress');
        track.style.removeProperty('--pin-position');
      }
    }

    function configure() {
      stop();
      // Expand only below the viewport so that hydration and history restore preserve the visible layout.
      if (
        !track ||
        !media.matches ||
        track.getBoundingClientRect().top <= window.innerHeight + 32
      )
        return;
      track.style.setProperty('--pin-count', String(count));
      for (const node of track.querySelectorAll<HTMLElement>(
        '[data-step-index]',
      )) {
        node.style.setProperty('--pin-index', node.dataset.stepIndex ?? '0');
      }
      track.dataset.pinEnhanced = '';
      draw();
      window.addEventListener('scroll', schedule, { passive: true });
      window.addEventListener('resize', schedule);
    }

    configure();
    media.addEventListener('change', configure);
    return () => {
      media.removeEventListener('change', configure);
      stop();
    };
  }, [count]);

  return (
    <PinProgressContext.Provider value={progress}>
      <section
        id={id}
        ref={trackRef}
        data-pin-guide
        aria-labelledby={id + '-title'}
        className={cn(styles.track, 'scroll-mt-24', className)}
      >
        <div
          ref={frameRef}
          data-pin-frame
          data-mascot-avoid=""
          className={styles.frame}
        >
          <a className={styles.skip} href={'#' + skipTarget}>
            {skipLabel}
          </a>
          <h2
            id={id + '-title'}
            className="text-section font-medium tracking-tight"
          >
            {title}
          </h2>
          <div className={styles.content}>
            <div>
              <div className={styles.indicator} aria-hidden="true">
                <span ref={numberRef} data-pin-readout>
                  01
                </span>
                <span> / {String(count).padStart(2, '0')}</span>
                <span className={styles.progressRail}>
                  <span className={styles.progressFill} />
                </span>
              </div>
              <ol className={styles.steps}>
                {steps.map((step, index) => (
                  <li
                    key={step.id}
                    data-step-index={index}
                    className={styles.step}
                  >
                    <h3 className="text-body font-medium">{step.title}</h3>
                    <p className="mt-1 text-sm">{step.description}</p>
                  </li>
                ))}
              </ol>
            </div>
            <div className={styles.poster} aria-hidden="true" data-pin-poster>
              {steps.map((step, index) => (
                <div
                  key={step.id}
                  data-step-index={index}
                  className={styles.art}
                >
                  {step.icon}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </PinProgressContext.Provider>
  );
}
