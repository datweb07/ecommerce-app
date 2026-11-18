'use client';

import dynamic from 'next/dynamic';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import type { GlobeConfig, GlobeMarker } from '../../config/globe';
import { mapCenter } from '../../lib/globe/geometry';
import { t } from '../../lib/i18n';
import { Button } from '../ui/button';
import { CanvasBoundary, useSceneActivation } from '../scene/scene-loader';
import styles from './globe.module.css';

const GlobeCanvas = dynamic(() => import('./globe-canvas'), { ssr: false });

type Mode = 'globe' | 'opening' | 'map' | 'closing';
type Drag = {
  id: number;
  x: number;
  y: number;
  time: number;
  touch: boolean;
  dragged: boolean;
};

export type GlobeMotion = {
  mode: Mode;
  elapsed: number;
  yaw: number;
  pitch: number;
  velocity: number;
  resumeAt: number;
  markerHover: boolean;
  drag: Drag | null;
  wake: (() => void) | undefined;
};

export function Globe({
  config,
  marker,
  staticOnly = false,
}: {
  config: GlobeConfig;
  marker: GlobeMarker;
  staticOnly?: boolean;
}) {
  const { host, active } = useSceneActivation(staticOnly);
  const stage = useRef<HTMLDivElement>(null);
  const hotspot = useRef<HTMLButtonElement>(null);
  const openButton = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const restoreOpenFocus = useRef(false);
  const renderer = useRef(false);
  const [mode, setMode] = useState<Mode>('globe');
  const motion = useRef<GlobeMotion>({
    mode: 'globe',
    elapsed: 0,
    yaw: 0,
    pitch: 0,
    velocity: 0,
    resumeAt: 0,
    markerHover: false,
    drag: null,
    wake: undefined,
  });
  const readMotion = useCallback(() => motion.current, []);
  const getHotspot = useCallback(() => hotspot.current, []);

  const changeMode = useCallback((next: Mode) => {
    motion.current.mode = next;
    if (stage.current) stage.current.dataset.globeMode = next;
    setMode(next);
    if (next === 'globe') {
      restoreOpenFocus.current = true;
    } else if (next === 'opening' || next === 'map') {
      requestAnimationFrame(() => {
        if (
          motion.current.mode === next &&
          !closeButton.current?.contains(document.activeElement) &&
          next === 'opening'
        ) {
          closeButton.current?.focus({ preventScroll: true });
        }
      });
    }
  }, []);

  useLayoutEffect(() => {
    if (mode !== 'globe' || !restoreOpenFocus.current) return;
    restoreOpenFocus.current = false;
    openButton.current?.focus({ preventScroll: true });
  }, [mode]);

  const setMapOpacity = useCallback((opacity: number) => {
    stage.current?.style.setProperty('--globe-map-opacity', String(opacity));
  }, []);

  const ready = useCallback(
    (wake?: () => void) => {
      renderer.current = Boolean(wake);
      motion.current.wake = wake;
      if (stage.current)
        stage.current.dataset.globeLive = wake ? 'true' : 'false';
      if (wake) return;
      if (hotspot.current) hotspot.current.hidden = true;
      motion.current.drag = null;
      motion.current.markerHover = false;
      motion.current.elapsed = 0;
      if (motion.current.mode === 'opening') {
        setMapOpacity(1);
        changeMode('map');
      } else if (motion.current.mode === 'closing') {
        setMapOpacity(0);
        changeMode('globe');
      }
    },
    [changeMode, setMapOpacity],
  );

  const begin = () => {
    if (motion.current.mode !== 'globe') return;
    motion.current.drag = null;
    motion.current.velocity = 0;
    motion.current.markerHover = false;
    motion.current.elapsed = 0;
    if (!renderer.current) {
      setMapOpacity(1);
      changeMode('map');
      requestAnimationFrame(() =>
        closeButton.current?.focus({ preventScroll: true }),
      );
      return;
    }
    changeMode('opening');
    motion.current.wake?.();
  };

  const close = useCallback(() => {
    const animation = motion.current;
    if (animation.mode === 'globe' || animation.mode === 'closing') return;
    if (!renderer.current || animation.elapsed === 0) {
      setMapOpacity(0);
      changeMode('globe');
      return;
    }
    changeMode('closing');
    animation.wake?.();
  }, [changeMode, setMapOpacity]);

  useEffect(() => {
    if (mode === 'globe') return;
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) close();
    };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [close, mode]);

  function startDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (
      event.button !== 0 ||
      !event.isPrimary ||
      !renderer.current ||
      motion.current.mode !== 'globe'
    )
      return;
    if ((event.target as Element).closest('button')) return;
    motion.current.drag = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      time: event.timeStamp,
      touch: event.pointerType === 'touch',
      dragged: false,
    };
    motion.current.velocity = 0;
  }

  function drag(event: ReactPointerEvent<HTMLDivElement>) {
    const animation = motion.current;
    const current = animation.drag;
    if (!current || event.pointerId !== current.id) return;
    const x = event.clientX - current.x;
    const y = event.clientY - current.y;
    if (!current.dragged) {
      if (current.touch && Math.abs(y) > Math.abs(x) && Math.abs(y) > 7) {
        animation.drag = null;
        return;
      }
      if (Math.hypot(x, current.touch ? 0 : y) < 5) return;
      current.dragged = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      event.currentTarget.dataset.dragging = '';
    }
    const width = event.currentTarget.clientWidth || 320;
    const yaw = (x * 4) / width;
    animation.yaw += yaw;
    if (!current.touch)
      animation.pitch = Math.max(
        -0.8,
        Math.min(0.8, animation.pitch + (y * 4) / width),
      );
    animation.velocity = Math.max(
      -4,
      Math.min(4, yaw / (Math.max(12, event.timeStamp - current.time) / 1000)),
    );
    current.x = event.clientX;
    current.y = event.clientY;
    current.time = event.timeStamp;
    animation.wake?.();
  }

  function endDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const current = motion.current.drag;
    if (current?.id !== event.pointerId) return;
    if (event.timeStamp - current.time > 90) motion.current.velocity = 0;
    motion.current.drag = null;
    motion.current.resumeAt = performance.now() + 2000;
    delete event.currentTarget.dataset.dragging;
  }

  const [lng, lat] = mapCenter(marker);
  const openMap = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=${marker.mapZoom}/${lat}/${lng}`;

  return (
    <div
      data-mascot-avoid
      className="mx-auto w-full max-w-[22.5rem] min-w-0 lg:max-w-[35rem]"
      data-hero-globe
    >
      <div className={styles.stage} ref={stage} data-globe-mode="globe">
        <div
          className={styles.surface}
          onPointerDown={startDrag}
          onPointerMove={drag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onLostPointerCapture={endDrag}
          onPointerLeave={(event) => {
            if (!motion.current.drag?.dragged) endDrag(event);
          }}
        >
          <div className={styles.poster} aria-hidden="true" />
          <div ref={host} className={styles.canvas} aria-hidden="true">
            {active && (
              <CanvasBoundary onError={ready}>
                <GlobeCanvas
                  config={config}
                  marker={marker}
                  readMotion={readMotion}
                  getHotspot={getHotspot}
                  onReady={ready}
                  onMode={changeMode}
                  onMapOpacity={setMapOpacity}
                />
              </CanvasBoundary>
            )}
          </div>
          <button
            type="button"
            tabIndex={-1}
            hidden
            ref={hotspot}
            data-globe-marker
            className={styles.marker}
            aria-label={t('globe', 'open')}
            onPointerEnter={() => {
              motion.current.markerHover = true;
              motion.current.velocity = 0;
            }}
            onPointerLeave={() => {
              motion.current.markerHover = false;
              motion.current.resumeAt = performance.now() + 2000;
            }}
            onClick={begin}
          >
            <span className={styles.dot} aria-hidden="true" />
            <span className={styles.label} aria-hidden="true">
              {marker.label}
            </span>
          </button>
        </div>
        <div
          className={styles.map}
          hidden={mode === 'globe'}
          aria-hidden={mode !== 'map'}
          inert={mode !== 'map'}
        >
          <p className="text-muted-foreground">{t('globe', 'preview')}</p>
          <p className="text-heading font-medium">{marker.label}</p>
          <a
            href={openMap}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 underline underline-offset-4"
          >
            {t('globe', 'map')}
          </a>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 pb-1 text-center">
        {marker.address && (
          <p className="text-label text-muted-foreground">{marker.address}</p>
        )}
        <noscript>
          <a className="underline underline-offset-4" href={openMap}>
            {t('globe', 'map')}
          </a>
        </noscript>
        <Button
          variant="outline"
          ref={openButton}
          type="button"
          onClick={begin}
          hidden={mode !== 'globe'}
        >
          {t('globe', 'open')}
        </Button>
        <Button
          variant="outline"
          ref={closeButton}
          type="button"
          onClick={close}
          hidden={mode === 'globe'}
          aria-disabled={mode === 'closing'}
        >
          {t('globe', 'back')}
        </Button>
      </div>
    </div>
  );
}
