// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { PinnedScroll } from '../src/components/common/pinned-scroll';
import { shoppingSteps } from '../src/config/site';
import { pinProgress, pinStep } from '../src/lib/pin-progress';

const guide = (
  <PinnedScroll
    id="shopping"
    title="Cách mua sắm tại ShopEase"
    steps={shoppingSteps.map((step) => ({ ...step, icon: null }))}
    skipLabel="Bỏ qua hướng dẫn"
    skipTarget="benefits"
  />
);

function media(matches: boolean) {
  const remove = vi.fn();
  vi.stubGlobal('matchMedia', () => ({
    matches,
    addEventListener: vi.fn(),
    removeEventListener: remove,
  }));
  return remove;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('clamps continuous progress and computes the closest current step', () => {
  expect(pinProgress(100, 64, 200)).toBe(0);
  expect(pinProgress(64, 64, 200)).toBe(0);
  expect(pinProgress(-36, 64, 200)).toBe(0.5);
  expect(pinProgress(-136, 64, 200)).toBe(1);
  expect(pinProgress(-400, 64, 200)).toBe(1);
  expect(pinProgress(-36, 64, 0)).toBe(0);
  expect([0, 1 / 3, 2 / 3, 1].map((value) => pinStep(value, 4))).toEqual([
    0, 1, 2, 3,
  ]);
});

it('keeps the semantic ordered list and skip link when enhancement is unavailable', () => {
  media(false);
  render(guide);
  const section = screen.getByRole('region');
  expect(section.hasAttribute('data-pin-enhanced')).toBe(false);
  expect(screen.getByRole('list').tagName).toBe('OL');
  expect(screen.getAllByRole('listitem')).toHaveLength(4);
  expect(screen.getByRole('link').getAttribute('href')).toBe('#benefits');
});

it('leaves a guide already in view static on hydration', () => {
  media(true);
  render(guide);
  expect(screen.getByRole('region').hasAttribute('data-pin-enhanced')).toBe(
    false,
  );
});

it('coalesces scroll events and cleans up its listener and any queued frame', () => {
  const removeMedia = media(true);
  let top = window.innerHeight + 100;
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
    () => new DOMRect(0, top, 500, 400),
  );
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(
    function (this: HTMLElement) {
      return this.hasAttribute('data-pin-guide') ? 4000 : 1000;
    },
  );
  let draw: FrameRequestCallback | undefined;
  const schedule = vi.fn((callback: FrameRequestCallback) => {
    draw = callback;
    return 11;
  });
  const cancel = vi.fn();
  vi.stubGlobal('requestAnimationFrame', schedule);
  vi.stubGlobal('cancelAnimationFrame', cancel);
  const listen = vi.spyOn(window, 'addEventListener');
  const unlisten = vi.spyOn(window, 'removeEventListener');
  const { unmount } = render(guide);
  const section = screen.getByRole('region');
  expect(section.hasAttribute('data-pin-enhanced')).toBe(true);
  expect(listen).toHaveBeenCalledWith('scroll', expect.any(Function), {
    passive: true,
  });
  top = -2000;
  window.dispatchEvent(new Event('scroll'));
  window.dispatchEvent(new Event('scroll'));
  expect(schedule).toHaveBeenCalledTimes(1);
  act(() => draw?.(16));
  expect(Number(section.style.getPropertyValue('--pin-progress'))).toBeCloseTo(
    2 / 3,
  );
  expect(section.dataset.pinStep).toBe('3');
  window.dispatchEvent(new Event('scroll'));
  unmount();
  expect(cancel).toHaveBeenCalledWith(11);
  expect(unlisten).toHaveBeenCalledWith('scroll', expect.any(Function));
  expect(removeMedia).toHaveBeenCalledWith('change', expect.any(Function));
});
