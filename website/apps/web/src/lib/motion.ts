export const reducedMotionQuery = '(prefers-reduced-motion: reduce)';
export const prefersReducedMotion = () =>
  Boolean(window.matchMedia?.(reducedMotionQuery).matches);
