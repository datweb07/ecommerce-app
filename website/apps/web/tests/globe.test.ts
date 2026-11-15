import { Quaternion, Vector3 } from 'three';
import { expect, it } from 'vitest';
import { globeConfig, globeSchema } from '../src/config/globe';
import { publicSchema } from '../src/config/env-schema';
import {
  facingCamera,
  isLand,
  landPoints,
  latLngToVector3,
  mapCenter,
  markerToCamera,
  maskBytes,
} from '../src/lib/globe/geometry';
import { easeInOutCubic, zoomPhase } from '../src/lib/globe/timeline';

it('keeps latitude and longitude in their geographic and MapLibre order', () => {
  expect(latLngToVector3(0, 0)).toEqual([0, 0, 1]);
  expect(latLngToVector3(90, 0)[1]).toBeCloseTo(1);
  expect(latLngToVector3(0, 90)[0]).toBeCloseTo(1);
  expect(mapCenter({ lat: 10.7769, lng: 106.7009 })).toEqual([
    106.7009, 10.7769,
  ]);
  expect(
    globeSchema.safeParse({
      markers: [{ id: 'wrong', lat: 106.7009, lng: 10.7769, label: 'Test' }],
    }).success,
  ).toBe(false);
  expect(globeConfig.markers[0]?.mapZoom).toBe(14);
  expect(publicSchema.shape.NEXT_PUBLIC_GLOBE_ENABLED.parse(undefined)).toBe(
    true,
  );
  expect(publicSchema.shape.NEXT_PUBLIC_GLOBE_ENABLED.parse('false')).toBe(
    false,
  );
});

it('orients a marker along the shortest arc including the far side', () => {
  for (const [lat, lng] of [
    [0, 0],
    [0, 180],
    [0.003, 179.999],
    [10.7769, 106.7009],
    [-75, -120],
  ] as const) {
    const point = latLngToVector3(lat, lng);
    const quaternion = new Quaternion(...markerToCamera(point));
    const turned = new Vector3(...point).applyQuaternion(quaternion);
    expect(turned.distanceTo(new Vector3(0, 0, 1))).toBeLessThan(1e-6);
    expect(quaternion.w).toBeGreaterThanOrEqual(0);
  }
  expect(facingCamera([0, 0, 1], 3)).toBe(1);
  expect(facingCamera([0, 0, -1], 3)).toBe(-1);
  expect(facingCamera([1, 0, 0], 3)).toBeLessThan(0);
});

it('maps the bitmask consistently and emits a deterministic set of unit points', () => {
  const mask = new Uint8Array(maskBytes);
  mask[0] = 1;
  expect(isLand(mask, -90, -180)).toBe(true);
  expect(isLand(mask, -90, 180)).toBe(true);
  expect(isLand(mask, 0, 0)).toBe(false);
  mask.fill(255);
  const points = landPoints(mask, 100);
  expect(points.length).toBe(300);
  expect(landPoints(mask, 100)).toEqual(points);
  expect(Math.hypot(...points.slice(0, 3))).toBeCloseTo(1);
});

it('clamps and eases each zoom phase before handing over to the map', () => {
  const { timing } = globeConfig;
  expect(easeInOutCubic(0.5)).toBe(0.5);
  expect(zoomPhase(-1, timing)).toEqual({
    turn: 0,
    approach: 0,
    map: 0,
    done: false,
  });
  expect(zoomPhase(timing.orient, timing)).toMatchObject({
    turn: 1,
    approach: 0,
  });
  expect(zoomPhase(timing.orient + timing.dolly / 2, timing).approach).toBe(
    0.5,
  );
  expect(
    zoomPhase(timing.orient + timing.dolly + timing.crossfade, timing),
  ).toEqual({
    turn: 1,
    approach: 1,
    map: 1,
    done: true,
  });
});
