'use client';

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Color,
  MathUtils,
  Quaternion,
  Vector2,
  Vector3,
  type ShaderMaterial,
} from 'three';
import type { GlobeConfig, GlobeMarker } from '../../config/globe';
import {
  facingCamera,
  landPoints,
  latLngToVector3,
  markerToCamera,
  maskBytes,
} from '../../lib/globe/geometry';
import { clamp, zoomPhase } from '../../lib/globe/timeline';
import type { GlobeMotion } from './globe';

type Props = {
  config: GlobeConfig;
  marker: GlobeMarker;
  readMotion: () => GlobeMotion;
  getHotspot: () => HTMLButtonElement | null;
  onReady: (wake?: () => void) => void;
  onMode: (mode: GlobeMotion['mode']) => void;
  onMapOpacity: (value: number) => void;
};

const vertex = `
  uniform vec2 pointMetrics;
  varying float opacity;
  void main() {
    vec4 center = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    vec4 point = modelViewMatrix * vec4(position, 1.0);
    float front = dot(normalize(point.xyz - center.xyz), normalize(-point.xyz));
    opacity = smoothstep(0.0, 0.85, front);
    gl_Position = projectionMatrix * point;
    gl_PointSize = pointMetrics.x * mix(0.8, 1.15, opacity);
  }
`;
const fragment = `
  uniform vec3 tint;
  varying float opacity;
  void main() {
    float circle = 1.0 - smoothstep(0.30, 0.49, length(gl_PointCoord - 0.5));
    if (opacity <= 0.01 || circle <= 0.01) discard;
    gl_FragColor = vec4(tint, circle * opacity * 0.86);
    #include <colorspace_fragment>
  }
`;

const xAxis = new Vector3(1, 0, 0);
const yAxis = new Vector3(0, 1, 0);
const zAxis = new Vector3(0, 0, 1);
const restingDistance = 3.45;
const nearSurface = 1.18;

function Points({
  positions,
  config,
  marker,
  readMotion,
  getHotspot,
  onReady,
  onMode,
  onMapOpacity,
  onLost,
}: Props & { positions: Float32Array; onLost: () => void }) {
  const object = useRef<import('three').Points>(null);
  const shader = useRef<ShaderMaterial>(null);
  const { gl, invalidate, setFrameloop } = useThree();
  const uniforms = useMemo(
    () => ({
      tint: { value: new Color() },
      pointMetrics: { value: new Vector2(2.4, 0) },
    }),
    [],
  );
  const rotation = useMemo(() => {
    const local = latLngToVector3(marker.lat, marker.lng);
    return {
      local: new Vector3(...local),
      base: new Quaternion(...markerToCamera(local)),
      from: new Quaternion(),
      to: new Quaternion(),
      scratch: new Quaternion(),
      position: new Vector3(),
      projected: new Vector3(),
    };
  }, [marker.lat, marker.lng]);
  const started = useRef(false);
  const closeFrom = useRef<number | null>(null);

  useEffect(() => {
    const canvas = gl.domElement;
    const html = document.documentElement;
    const update = () => {
      const tint: unknown = shader.current?.uniforms.tint?.value;
      if (tint instanceof Color)
        tint.set(
          getComputedStyle(html).getPropertyValue('--foreground').trim(),
        );
      invalidate();
    };
    const observer = new MutationObserver(update);
    observer.observe(html, { attributes: true, attributeFilter: ['class'] });
    update();
    const lost = (event: Event) => {
      event.preventDefault();
      setFrameloop('never');
      onLost();
    };
    canvas.addEventListener('webglcontextlost', lost);
    return () => {
      observer.disconnect();
      canvas.removeEventListener('webglcontextlost', lost);
      onReady();
      queueMicrotask(() => {
        if (!gl.domElement.isConnected) gl.dispose();
      });
    };
  }, [gl, invalidate, onLost, onReady, setFrameloop]);

  useFrame(({ camera }, delta) => {
    const points = object.current;
    if (!points || document.hidden) return;
    const state = readMotion();
    const step = Math.min(0.05, delta);
    if (!started.current) {
      started.current = true;
      onReady(invalidate);
    }

    if (state.mode === 'globe') {
      if (!state.drag) {
        if (Math.abs(state.velocity) > 0.005) {
          state.yaw += state.velocity * step;
          state.velocity *= Math.exp(-5 * step);
        }
        if (!state.markerHover && performance.now() >= state.resumeAt) {
          state.yaw += (step * Math.PI * 2) / config.rotationSecondsPerTurn;
        }
      }
      points.quaternion
        .setFromAxisAngle(xAxis, state.pitch)
        .multiply(
          rotation.scratch.setFromAxisAngle(
            zAxis,
            MathUtils.degToRad(config.tiltDeg),
          ),
        )
        .multiply(rotation.scratch.setFromAxisAngle(yAxis, state.yaw))
        .multiply(rotation.base);
      camera.position.setZ(restingDistance);
      closeFrom.current = null;
    } else if (state.mode !== 'map') {
      const duration =
        config.timing.orient + config.timing.dolly + config.timing.crossfade;
      if (state.mode === 'opening') {
        if (state.elapsed === 0) {
          rotation.from.copy(points.quaternion);
          rotation.position.copy(rotation.local).applyQuaternion(rotation.from);
          rotation.to
            .set(...markerToCamera(rotation.position.toArray()))
            .multiply(rotation.from);
        }
        state.elapsed = Math.min(duration, state.elapsed + step * 1000);
      } else {
        closeFrom.current ??= state.elapsed;
        state.elapsed = Math.max(
          0,
          state.elapsed -
            (closeFrom.current * step * 1000) / config.timing.cancel,
        );
      }
      const phase = zoomPhase(state.elapsed, config.timing);
      points.quaternion.slerpQuaternions(
        rotation.from,
        rotation.to,
        phase.turn,
      );
      camera.position.setZ(
        MathUtils.lerp(restingDistance, nearSurface, phase.approach),
      );
      onMapOpacity(phase.map);
      if (state.mode === 'opening' && phase.done) onMode('map');
      if (state.mode === 'closing' && state.elapsed === 0) {
        state.resumeAt = performance.now() + 2000;
        onMode('globe');
      }
    }

    const metrics: unknown = shader.current?.uniforms.pointMetrics?.value;
    if (metrics instanceof Vector2)
      metrics.setX(
        Math.min(4, gl.getPixelRatio() * (camera.position.z > 2 ? 2 : 2.6)),
      );
    const target = getHotspot();
    if (target) {
      rotation.position.copy(rotation.local).applyQuaternion(points.quaternion);
      const face = facingCamera(rotation.position.toArray(), camera.position.z);
      target.hidden = state.mode !== 'globe' || face <= 0.07;
      if (!target.hidden) {
        camera.updateMatrixWorld();
        rotation.projected.copy(rotation.position).project(camera);
        const left = (rotation.projected.x + 1) * 50;
        target.style.left = `${left}%`;
        target.style.top = `${(1 - rotation.projected.y) * 50}%`;
        target.style.opacity = String(clamp(face * 2.2));
        target.toggleAttribute('data-label-left', left > 55);
      }
    }
    if (state.mode !== 'map') invalidate();
  });

  return (
    <points ref={object}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <shaderMaterial
        ref={shader}
        transparent
        depthWrite={false}
        uniforms={uniforms}
        vertexShader={vertex}
        fragmentShader={fragment}
      />
    </points>
  );
}

export default function GlobeCanvas(props: Props) {
  const [asset, setAsset] = useState<Float32Array | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [lost, setLost] = useState(false);
  const { config, onReady } = props;
  const recover = useRef<number | undefined>(undefined);
  const mobile = useMemo(
    () => window.matchMedia('(pointer: coarse), (max-width: 47.99rem)').matches,
    [],
  );

  useEffect(() => {
    const controller = new AbortController();
    fetch('/globe/land-360x180.bin', { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('Failed to load land mask');
        return response.arrayBuffer();
      })
      .then((bytes) => {
        if (bytes.byteLength !== maskBytes)
          throw new Error('Invalid land mask');
        if (!controller.signal.aborted)
          setAsset(
            landPoints(
              new Uint8Array(bytes),
              mobile ? config.dotCount.mobile : config.dotCount.desktop,
            ),
          );
      })
      .catch(() => {
        if (!controller.signal.aborted) onReady();
      });
    return () => controller.abort();
  }, [config.dotCount, mobile, onReady]);

  const onLost = useMemo(
    () => () => {
      onReady();
      setLost(true);
      if (attempt === 0 && recover.current === undefined) {
        recover.current = window.setTimeout(() => {
          recover.current = undefined;
          setAttempt(1);
          setLost(false);
        }, 400);
      }
    },
    [attempt, onReady],
  );
  useEffect(() => () => window.clearTimeout(recover.current), []);

  if (!asset || lost) return null;
  return (
    <Canvas
      key={attempt}
      frameloop="demand"
      camera={{
        position: [0, 0, restingDistance],
        fov: 42,
        near: 0.025,
        far: 8,
      }}
      dpr={[1, mobile ? 1.5 : 2]}
      gl={{ alpha: true, antialias: false, powerPreference: 'low-power' }}
    >
      <Points {...props} positions={asset} onLost={onLost} />
    </Canvas>
  );
}
