'use client';

import { useEffect, useRef } from 'react';
import { mascotConfig } from '../../config/mascot';
import {
  MascotEngine,
  type MascotPose,
  type Point,
  type Rect,
} from '../../lib/mascot/engine';
import { t } from '../../lib/i18n';

const { size, sprite } = mascotConfig;
const protectedAreas = '[data-mascot-avoid], [data-sonner-toast]';

function avoidRects() {
  const nodes = document.querySelectorAll(protectedAreas);
  const rects: Rect[] = [];
  for (const node of nodes) {
    if (node.getAttribute('aria-hidden') === 'true') continue;
    const { left, top, width, height, right, bottom } =
      node.getBoundingClientRect();
    if (
      !width ||
      !height ||
      right < 0 ||
      bottom < 0 ||
      left > innerWidth ||
      top > innerHeight
    )
      continue;
    rects.push({
      x: left - 6,
      y: top - 6,
      width: width + 12,
      height: height + 12,
    });
  }
  return rects;
}

const messages = ['mascotHello', 'mascotExplore', 'mascotBreak'] as const;

export function Mascot() {
  const container = useRef<HTMLDivElement>(null);
  const spriteRef = useRef<HTMLDivElement>(null);
  const bubble = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const element = container.current;
    const figure = spriteRef.current;
    const speech = bubble.current;
    if (!element || !figure || !speech) return;
    const engine = new MascotEngine(mascotConfig, () => performance.now());
    engine.resize(innerWidth, innerHeight);
    let frame = 0;
    let previousFrame = 0;
    let nextMeasure = 0;
    let measuredWidth = innerWidth;
    let measuredHeight = innerHeight;
    let active = false;
    let pointer:
      | (Point & {
          time: number;
          kind: 'mouse' | 'touch';
          vx: number;
          vy: number;
          id: number;
        })
      | undefined;
    let pointerUpdated = false;
    let gesture: { id: number; origin: Point; moved: boolean } | undefined;
    let lastTap = -Infinity;
    let utterance = 0;
    let dismissSpeech = 0;
    let priorPose: MascotPose | undefined;
    let priorTile = -1;
    let priorMirror: boolean | undefined;
    const subscriptions = new AbortController();
    const passive = { passive: true, signal: subscriptions.signal };

    function paint(pose: MascotPose) {
      if (!element || !figure || !speech) return;
      if (!priorPose || pose.x !== priorPose.x || pose.y !== priorPose.y) {
        element.style.transform =
          'translate3d(' + pose.x + 'px,' + pose.y + 'px,0)';
        if (!speech.hidden) {
          speech.style.left = Math.min(0, innerWidth - pose.x - 174) + 'px';
          speech.dataset.side = pose.y < 120 ? 'below' : 'above';
        }
      }
      if (!priorPose || pose.visible !== priorPose.visible)
        element.style.visibility = pose.visible ? 'visible' : 'hidden';
      if (!priorPose || pose.state !== priorPose.state)
        element.dataset.state = pose.state;

      const state =
        pose.state === 'curious' && pose.moving
          ? 'wander'
          : pose.state === 'chase' && !pose.moving
            ? 'curious'
            : pose.state;
      const animation = sprite.poses[state][pose.facing];
      const tile = animation.frames[pose.frame % animation.frames.length] ?? 0;
      if (tile !== priorTile) {
        figure.style.backgroundPosition =
          -(tile % sprite.columns) * size +
          'px ' +
          -Math.floor(tile / sprite.columns) * size +
          'px';
        priorTile = tile;
      }
      if (priorMirror !== animation.mirror) {
        figure.style.transform = animation.mirror ? 'scaleX(-1)' : '';
        priorMirror = animation.mirror;
      }
      priorPose = pose;
    }

    function tick(now: number) {
      if (document.hidden) {
        frame = 0;
        return;
      }
      if (measuredWidth !== innerWidth || measuredHeight !== innerHeight) {
        measuredWidth = innerWidth;
        measuredHeight = innerHeight;
        engine.resize(measuredWidth, measuredHeight);
        nextMeasure = 0;
      }
      if (now >= nextMeasure) {
        engine.avoid(avoidRects());
        nextMeasure = now + 500;
      }
      if (pointer && pointerUpdated) {
        engine.point(pointer);
        if (gesture?.id === pointer.id) engine.drag(pointer);
        pointerUpdated = false;
      }
      if (active) {
        engine.activity();
        active = false;
      }
      paint(engine.update(previousFrame ? now - previousFrame : 0));
      previousFrame = now;
      frame = requestAnimationFrame(tick);
    }

    function record(event: PointerEvent) {
      const kind = event.pointerType === 'mouse' ? 'mouse' : 'touch';
      const last = pointer?.id === event.pointerId ? pointer : undefined;
      const seconds =
        last && event.timeStamp - last.time <= 180
          ? Math.max(8, event.timeStamp - last.time) / 1000
          : 0;
      pointer = {
        x: event.clientX,
        y: event.clientY,
        time: event.timeStamp,
        kind,
        id: event.pointerId,
        vx: last && seconds ? (event.clientX - last.x) / seconds : 0,
        vy: last && seconds ? (event.clientY - last.y) / seconds : 0,
      };
      if (
        gesture &&
        gesture.id === event.pointerId &&
        Math.hypot(pointer.x - gesture.origin.x, pointer.y - gesture.origin.y) >
          5
      )
        gesture.moved = true;
      pointerUpdated = true;
    }

    function begin(event: PointerEvent) {
      if (!figure || gesture || !event.isPrimary || event.button !== 0) return;
      record(event);
      const origin = { x: event.clientX, y: event.clientY };
      gesture = { id: event.pointerId, origin, moved: false };
      engine.grab(origin);
      figure.setPointerCapture?.(event.pointerId);
    }

    function finish(event: PointerEvent) {
      if (!speech || gesture?.id !== event.pointerId) return;
      record(event);
      const moved = gesture.moved;
      gesture = undefined;
      if (moved || event.type !== 'pointerup') {
        engine.drag({ x: event.clientX, y: event.clientY });
        engine.release();
        return;
      }
      if (pointer) engine.point(pointer);
      engine.tap();
      const now = performance.now();
      if (event.pointerType === 'mouse' && now - lastTap < 350) {
        engine.toggleChase();
        lastTap = -Infinity;
      } else lastTap = event.pointerType === 'mouse' ? now : -Infinity;
      speech.textContent = t(
        'uiExtras',
        messages[utterance % messages.length] ?? 'mascotHello',
      );
      utterance++;
      speech.hidden = false;
      speech.style.left =
        Math.min(0, innerWidth - (priorPose?.x ?? 0) - 174) + 'px';
      speech.dataset.side = (priorPose?.y ?? 0) < 120 ? 'below' : 'above';
      window.clearTimeout(dismissSpeech);
      dismissSpeech = window.setTimeout(() => {
        speech.hidden = true;
      }, 2500);
    }

    function leave() {
      if (gesture) return;
      pointer = undefined;
      engine.leave();
    }
    function visibility() {
      if (document.hidden) {
        if (frame) cancelAnimationFrame(frame);
        frame = 0;
        if (gesture) {
          gesture = undefined;
          engine.release();
        }
        leave();
      } else if (!frame) {
        previousFrame = 0;
        frame = requestAnimationFrame(tick);
      }
    }
    const wake = () => {
      active = true;
    };
    window.addEventListener('pointermove', record, passive);
    window.addEventListener('pointerdown', wake, passive);
    window.addEventListener('pointerup', finish, passive);
    window.addEventListener('pointercancel', finish, passive);
    window.addEventListener('keydown', wake, passive);
    window.addEventListener('scroll', wake, passive);
    window.addEventListener('wheel', wake, passive);
    window.addEventListener('blur', leave, passive);
    window.addEventListener(
      'pointerout',
      (event) => {
        if (!event.relatedTarget) leave();
      },
      passive,
    );
    document.documentElement.addEventListener('pointerleave', leave, passive);
    document.addEventListener('visibilitychange', visibility, passive);
    figure.addEventListener('pointerdown', begin, passive);
    visibility();
    return () => {
      subscriptions.abort();
      if (frame) cancelAnimationFrame(frame);
      window.clearTimeout(dismissSpeech);
    };
  }, []);

  return (
    <div
      ref={container}
      data-mascot=""
      aria-hidden="true"
      className="pointer-events-none fixed top-0 left-0 z-20"
      style={{ width: size, height: size, visibility: 'hidden' }}
    >
      <div
        ref={spriteRef}
        data-mascot-sprite=""
        className="pointer-events-auto size-full cursor-grab touch-none select-none active:cursor-grabbing"
        style={{
          backgroundImage: 'url(' + sprite.source + ')',
          backgroundSize:
            size * sprite.columns + 'px ' + size * sprite.rows + 'px',
          imageRendering: 'pixelated',
        }}
      />
      <span
        ref={bubble}
        data-mascot-bubble=""
        hidden
        className="pointer-events-none absolute bottom-full mb-1 w-max max-w-40 rounded-control border border-control-border bg-background px-2 py-1 text-xs text-foreground data-[side=below]:top-full data-[side=below]:bottom-auto data-[side=below]:mt-1"
      />
    </div>
  );
}
