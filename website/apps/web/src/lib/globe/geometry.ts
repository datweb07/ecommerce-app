export type Vector = [number, number, number];
export type Rotation = [number, number, number, number];

const radians = Math.PI / 180;
const goldenAngle = Math.PI * (3 - Math.sqrt(5));
export const maskWidth = 360;
export const maskHeight = 180;
export const maskBytes = (maskWidth * maskHeight) / 8;

export function latLngToVector3(lat: number, lng: number): Vector {
  const latitude = lat * radians;
  const longitude = lng * radians;
  return [
    Math.cos(latitude) * Math.sin(longitude),
    Math.sin(latitude),
    Math.cos(latitude) * Math.cos(longitude),
  ];
}

export function mapCenter({
  lat,
  lng,
}: {
  lat: number;
  lng: number;
}): [number, number] {
  return [lng, lat];
}

export function markerToCamera([x, y, z]: Vector): Rotation {
  // Rotate a unit surface vector onto +Z via the shorter of the two arcs.
  const transverse = Math.hypot(x, y);
  if (transverse < 1e-12) return z < 0 ? [0, 1, 0, 0] : [0, 0, 0, 1];
  const halfAngle = Math.atan2(transverse, z) / 2;
  const scale = Math.sin(halfAngle) / transverse;
  return [y * scale, -x * scale, 0, Math.cos(halfAngle)];
}

export function facingCamera(point: Vector, distance: number) {
  const [x, y, z] = point;
  return (z * distance - 1) / Math.hypot(x, y, distance - z);
}

export function isLand(mask: Uint8Array, lat: number, lng: number) {
  const x = Math.floor((((lng + 180) % 360) + 360) % 360);
  const y = Math.min(maskHeight - 1, Math.max(0, Math.floor(lat + 90)));
  const bit = y * maskWidth + x;
  return Boolean((mask[bit >> 3] ?? 0) & (1 << (bit & 7)));
}

export function landPoints(mask: Uint8Array, count: number) {
  const candidates: number[] = [];
  const samples = count * 4;
  for (let i = 0; i < samples; i++) {
    const lat = Math.asin(1 - (2 * i + 1) / samples) / radians;
    const lng = (((i * goldenAngle) / radians + 180) % 360) - 180;
    if (isLand(mask, lat, lng)) candidates.push(...latLngToVector3(lat, lng));
  }
  const available = candidates.length / 3;
  const result = new Float32Array(Math.min(count, available) * 3);
  for (let i = 0; i < result.length / 3; i++) {
    const start = Math.floor((i * available) / (result.length / 3)) * 3;
    result.set(candidates.slice(start, start + 3), i * 3);
  }
  return result;
}
