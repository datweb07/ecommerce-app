'use client';

import dynamic from 'next/dynamic';
import {
  Component,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { detectCapabilities } from '../../lib/scene-motion';
import { PinProgressContext } from '../common/pinned-scroll';
import type { SceneKind } from './scene-3d';
import styles from './scene.module.css';

const SceneCanvas = dynamic(() => import('./scene-canvas'), { ssr: false });
const activeScenes = new Set<object>();
const retrySlot = new EventTarget();

export class CanvasBoundary extends Component<
  { children: ReactNode; onError?: () => void },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    this.props.onError?.();
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export function useSceneActivation(disabled = false) {
  const host = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (disabled || !host.current || !window.IntersectionObserver) return;
    const element = host.current;
    const slot = {};
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const connection: EventTarget | undefined = Reflect.get(
      navigator,
      'connection',
    );
    let near = false;
    let visible = false;
    let idle = false;
    let cancelIdle: (() => void) | undefined;

    function release() {
      if (activeScenes.delete(slot)) retrySlot.dispatchEvent(new Event('free'));
    }

    function sync() {
      const eligible =
        idle &&
        near &&
        visible &&
        !document.hidden &&
        detectCapabilities(motion, navigator);
      if (!eligible) {
        release();
        setActive(false);
        return;
      }
      if (activeScenes.size < 2 || activeScenes.has(slot)) {
        activeScenes.add(slot);
        setActive(true);
      }
    }

    function scheduleIdle() {
      if (!near || idle || cancelIdle) return;
      const ready = () => {
        idle = true;
        cancelIdle = undefined;
        sync();
      };
      if (typeof window.requestIdleCallback === 'function') {
        const id = window.requestIdleCallback(ready, { timeout: 1500 });
        cancelIdle = () => window.cancelIdleCallback(id);
      } else {
        const id = window.setTimeout(ready, 200);
        cancelIdle = () => window.clearTimeout(id);
      }
    }

    const proximity = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        near = entry.isIntersecting && entry.boundingClientRect.width > 0;
        if (document.readyState === 'complete') scheduleIdle();
        sync();
      },
      { rootMargin: '200px' },
    );
    const viewport = new IntersectionObserver(([entry]) => {
      if (!entry) return;
      visible = entry.isIntersecting && entry.intersectionRatio > 0;
      sync();
    });
    proximity.observe(element);
    viewport.observe(element);
    window.addEventListener('load', scheduleIdle);
    document.addEventListener('visibilitychange', sync);
    motion.addEventListener('change', sync);
    connection?.addEventListener('change', sync);
    retrySlot.addEventListener('free', sync);
    return () => {
      proximity.disconnect();
      viewport.disconnect();
      window.removeEventListener('load', scheduleIdle);
      document.removeEventListener('visibilitychange', sync);
      motion.removeEventListener('change', sync);
      connection?.removeEventListener('change', sync);
      retrySlot.removeEventListener('free', sync);
      cancelIdle?.();
      release();
    };
  }, [disabled]);

  return { host, active: !disabled && active };
}

export function SceneLoader({ kind }: { kind: SceneKind }) {
  const progress = useContext(PinProgressContext);
  const { host, active } = useSceneActivation();
  return (
    <div ref={host} className={styles.island}>
      {active && (
        <CanvasBoundary>
          <SceneCanvas kind={kind} progress={progress} />
        </CanvasBoundary>
      )}
    </div>
  );
}
