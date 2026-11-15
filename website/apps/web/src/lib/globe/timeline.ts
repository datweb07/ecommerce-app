import type { GlobeConfig } from '../../config/globe';

export const clamp = (value: number) => Math.max(0, Math.min(1, value));

export function easeInOutCubic(value: number) {
  const t = clamp(value);
  return t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2;
}

export function zoomPhase(
  time: number,
  { orient, dolly, crossfade }: GlobeConfig['timing'],
) {
  const mapStart = orient + dolly;
  return {
    turn: easeInOutCubic(time / orient),
    approach: easeInOutCubic((time - orient) / dolly),
    map: clamp((time - mapStart) / crossfade),
    done: time >= mapStart + crossfade,
  };
}
