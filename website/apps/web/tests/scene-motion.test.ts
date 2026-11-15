import { expect, it, vi } from 'vitest';
import { detectCapabilities, packagePose } from '../src/lib/scene-motion';

it('clamps package poses, opens the lid at the cart step, and closes it before tracking', () => {
  expect(packagePose(-1)).toEqual(packagePose(0));
  expect(packagePose(2)).toEqual(packagePose(1));
  expect(packagePose(1 / 3).lid).toBe(-1.35);
  expect(packagePose(1 / 2).lid).toBeCloseTo(-0.675);
  expect(packagePose(2 / 3)).toMatchObject({ lid: 0, tracking: 0 });
  expect(packagePose(1)).toMatchObject({ lid: 0, tracking: 1 });
});

it('uses the poster without probing the GPU when device or motion preferences rule out 3D', () => {
  const probe = vi.fn(() => true);
  const motion = (matches: boolean): MediaQueryList => ({
    matches,
    media: '(prefers-reduced-motion: reduce)',
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  });
  const hardware = Object.assign(Object.create(null), {
    hardwareConcurrency: 8,
  }) as Navigator;

  expect(detectCapabilities(motion(true), hardware, probe)).toBe(false);
  expect(
    detectCapabilities(
      motion(false),
      { ...hardware, connection: { saveData: true } },
      probe,
    ),
  ).toBe(false);
  expect(
    detectCapabilities(motion(false), { ...hardware, deviceMemory: 2 }, probe),
  ).toBe(false);
  expect(probe).not.toHaveBeenCalled();
  expect(detectCapabilities(motion(false), hardware, () => false)).toBe(false);
  expect(detectCapabilities(motion(false), hardware, probe)).toBe(true);
});
