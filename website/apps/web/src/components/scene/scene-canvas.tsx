'use client';

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import {
  BoxGeometry,
  EdgesGeometry,
  IcosahedronGeometry,
  MathUtils,
  type Group,
  type MeshBasicMaterial,
} from 'three';
import { packagePose } from '../../lib/scene-motion';
import type { SceneKind } from './scene-3d';

type SceneProps = { kind: SceneKind; progress: RefObject<number> | null };
type SceneSignals = { onFrame: () => void; onLost: () => void };

function readPalette() {
  const tokens = getComputedStyle(document.documentElement);
  return {
    face: tokens.getPropertyValue('--background').trim(),
    edge: tokens.getPropertyValue('--foreground').trim(),
    side: tokens.getPropertyValue('--border').trim(),
  };
}

function SceneContent({
  kind,
  progress,
  onFrame,
  onLost,
}: SceneProps & SceneSignals) {
  const root = useRef<Group>(null);
  const lid = useRef<Group>(null);
  const tracking = useRef<MeshBasicMaterial>(null);
  const pointer = useRef({ x: 0, y: 0 });
  const rendered = useRef(false);
  const elapsed = useRef(0);
  const { gl, invalidate, setFrameloop } = useThree();
  const [palette, setPalette] = useState(readPalette);
  const mesh = useMemo(
    () =>
      kind === 'hero' ? new IcosahedronGeometry(1.04, 0) : new BoxGeometry(),
    [kind],
  );
  const edges = useMemo(() => new EdgesGeometry(mesh), [mesh]);

  useEffect(
    () => () => {
      mesh.dispose();
      edges.dispose();
    },
    [mesh, edges],
  );

  useEffect(
    () => () => {
      // In development, Strict Mode replays effects on the still-mounted canvas.
      queueMicrotask(() => {
        if (!gl.domElement.isConnected) gl.dispose();
      });
    },
    [gl],
  );

  useEffect(() => {
    const html = document.documentElement;
    const canvas = gl.domElement;
    const guide = canvas.closest('[data-pin-guide]');
    const colors = () => setPalette(readPalette());
    const themeObserver = new MutationObserver(colors);
    colors();
    themeObserver.observe(html, {
      attributes: true,
      attributeFilter: ['class'],
    });

    const redraw = () => invalidate();
    const hover = window.matchMedia('(hover: hover)');
    const move = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' || !hover.matches) return;
      pointer.current.x = (event.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = (event.clientY / window.innerHeight) * 2 - 1;
    };
    const reset = () => {
      pointer.current = { x: 0, y: 0 };
    };
    if (kind === 'hero') {
      window.addEventListener('pointermove', move, { passive: true });
      document.documentElement.addEventListener('pointerleave', reset);
    }
    const lost = (event: Event) => {
      event.preventDefault();
      setFrameloop('never');
      onLost();
    };
    guide?.addEventListener('pinprogress', redraw);
    canvas.addEventListener('webglcontextlost', lost);
    return () => {
      themeObserver.disconnect();
      window.removeEventListener('pointermove', move);
      document.documentElement.removeEventListener('pointerleave', reset);
      guide?.removeEventListener('pinprogress', redraw);
      canvas.removeEventListener('webglcontextlost', lost);
    };
  }, [gl, kind, invalidate, onLost, setFrameloop]);

  useFrame((_, delta) => {
    if (!root.current || document.hidden) return;
    if (!rendered.current) {
      rendered.current = true;
      onFrame();
    }
    const frame = Math.min(delta, 0.04);
    if (kind === 'hero') {
      elapsed.current += frame;
      root.current.position.y = Math.sin(elapsed.current * 1.2) * 0.1;
      root.current.rotation.x = MathUtils.damp(
        root.current.rotation.x,
        -0.12 + pointer.current.y * 0.25,
        5,
        frame,
      );
      root.current.rotation.y = MathUtils.damp(
        root.current.rotation.y,
        0.36 + pointer.current.x * 0.4,
        5,
        frame,
      );
      invalidate();
    }
    if (kind === 'package') {
      const pose = packagePose(progress?.current ?? 0);
      root.current.rotation.y = pose.yaw;
      root.current.position.x = pose.offset;
      if (lid.current) lid.current.rotation.x = pose.lid;
      if (tracking.current) tracking.current.opacity = pose.tracking * 0.62;
    }
  });

  const solid = (
    size: [number, number, number],
    position: [number, number, number],
    color = palette.face,
  ) => (
    <group scale={size} position={position}>
      <mesh geometry={mesh}>
        <meshStandardMaterial color={color} roughness={0.94} />
      </mesh>
      <lineSegments geometry={edges}>
        <lineBasicMaterial color={palette.edge} transparent opacity={0.66} />
      </lineSegments>
    </group>
  );

  return (
    <>
      <ambientLight intensity={1.7} />
      <directionalLight position={[3, 5, 4]} intensity={2} />
      <group ref={root} rotation={[0.12, 0.46, 0]}>
        {kind === 'hero' ? (
          solid([1, 1, 1], [0, 0, 0])
        ) : (
          <>
            {solid([1.42, 0.09, 1.12], [0, -0.46, 0], palette.side)}
            {solid([1.42, 0.65, 0.08], [0, -0.1, 0.52])}
            {solid([1.42, 0.65, 0.08], [0, -0.1, -0.52])}
            {solid([0.08, 0.65, 0.96], [-0.67, -0.1, 0])}
            {solid([0.08, 0.65, 0.96], [0.67, -0.1, 0])}
            {kind === 'package' && (
              <>
                <group ref={lid} position={[0, 0.25, -0.56]}>
                  {solid([1.42, 0.08, 1.12], [0, 0, 0.56], palette.side)}
                </group>
                <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.53, 0]}>
                  <ringGeometry args={[1.02, 1.031, 40]} />
                  <meshBasicMaterial
                    ref={tracking}
                    color={palette.edge}
                    transparent
                    opacity={0}
                    depthWrite={false}
                  />
                </mesh>
              </>
            )}
          </>
        )}
      </group>
    </>
  );
}

export default function SceneCanvas(props: SceneProps) {
  const [attempt, setAttempt] = useState(0);
  const [lost, setLost] = useState(false);
  const [ready, setReady] = useState(false);
  const recover = useRef<number | undefined>(undefined);
  const signals = useMemo<SceneSignals>(
    () => ({
      onFrame: () => setReady(true),
      onLost: () => {
        setLost(true);
        setReady(false);
        if (attempt === 0 && recover.current === undefined) {
          recover.current = window.setTimeout(() => {
            recover.current = undefined;
            setAttempt(1);
            setLost(false);
          }, 400);
        }
      },
    }),
    [attempt],
  );

  useEffect(() => () => window.clearTimeout(recover.current), []);

  return (
    <div
      className="absolute inset-0"
      data-scene-live={ready && !lost ? '' : undefined}
    >
      {!lost && (
        <Canvas
          key={attempt}
          frameloop="demand"
          camera={{ position: [2, 2, 4.5], fov: 33 }}
          dpr={[
            1,
            window.matchMedia('(pointer: coarse), (max-width: 47.99rem)')
              .matches
              ? 1.5
              : 2,
          ]}
          gl={{ alpha: true, antialias: false, powerPreference: 'low-power' }}
        >
          <SceneContent {...props} {...signals} />
        </Canvas>
      )}
    </div>
  );
}
