// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { sampleBanners } from '@storefront/shared';
import {
  BannerCarousel,
  rotationMs,
} from '../src/components/catalogue/banner-carousel';

function setup(reduced = false) {
  vi.useFakeTimers();
  vi.stubGlobal('matchMedia', () => ({
    matches: reduced,
    addEventListener() {},
    removeEventListener() {},
  }));
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
  return render(<BannerCarousel banners={sampleBanners} />);
}
const advance = () => act(() => vi.advanceTimersByTime(rotationMs));
const destination = () => screen.getByRole('link').getAttribute('href');
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('prioritizes only the first banner image of a carousel', () => {
  setup();
  expect(screen.getByRole('img').getAttribute('loading')).toBe('eager');
  expect(screen.getByRole('img').getAttribute('fetchpriority')).toBe('high');
  advance();
  expect(screen.getByRole('img').getAttribute('loading')).toBe('lazy');
  expect(screen.getByRole('img').getAttribute('fetchpriority')).toBe('auto');
});

it('rotates in API order, pauses, resumes and wraps', () => {
  setup();
  const links = sampleBanners.map(({ href }) => href);
  expect(destination()).toBe(links[0]);
  advance();
  expect(destination()).toBe(links[1]);
  fireEvent.click(screen.getByRole('button', { name: 'Tạm dừng tự chuyển' }));
  advance();
  expect(destination()).toBe(links[1]);
  fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục tự chuyển' }));
  advance();
  expect(destination()).toBe(links[2]);
  advance();
  expect(destination()).toBe(links[0]);
});

it('stops at keyboard focus and preserves manual navigation with reduced motion', () => {
  const first = setup();
  act(() => screen.getByRole('button', { name: 'Banner sau' }).focus());
  advance();
  expect(destination()).toBe(sampleBanners[0]?.href);
  expect(
    screen.getByRole('button', { name: 'Tiếp tục tự chuyển' }),
  ).toBeTruthy();
  first.unmount();
  setup(true);
  advance();
  expect(destination()).toBe(sampleBanners[0]?.href);
  expect(
    screen.getByRole('button', { name: 'Tự chuyển đã tắt' }),
  ).toHaveProperty('disabled', true);
  fireEvent.click(screen.getByRole('button', { name: 'Banner trước' }));
  expect(destination()).toBe(sampleBanners.at(-1)?.href);
});

it('omits carousel controls for a single banner or empty response', () => {
  const view = render(<BannerCarousel banners={sampleBanners.slice(0, 1)} />);
  expect(destination()).toBe(sampleBanners[0]?.href);
  expect(screen.queryByRole('button')).toBeNull();
  view.rerender(<BannerCarousel banners={[]} />);
  expect(screen.queryByRole('link')).toBeNull();
});
