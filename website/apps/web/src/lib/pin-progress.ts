export function pinProgress(
  trackTop: number,
  offset: number,
  distance: number,
) {
  if (distance <= 0) return 0;
  return Math.min(1, Math.max(0, (offset - trackTop) / distance));
}

export function pinStep(progress: number, count: number) {
  return Math.round(progress * Math.max(0, count - 1));
}
