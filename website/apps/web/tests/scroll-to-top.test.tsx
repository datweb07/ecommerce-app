// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ScrollToTop } from '../src/components/layout/scroll-to-top';

function setup(reduced = false) {
  let notify: (intersects: boolean) => void = () => undefined;
  const disconnect = vi.fn();
  const options = vi.fn();
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(
        callback: (entries: { isIntersecting: boolean }[]) => void,
        config: unknown,
      ) {
        notify = (isIntersecting) => callback([{ isIntersecting }]);
        options(config);
      }
      observe() {}
      disconnect() {
        disconnect();
      }
    },
  );
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: reduced })),
  );
  const scrollTo = vi.fn();
  vi.stubGlobal('scrollTo', scrollTo);
  const view = render(
    <>
      <main id="content" tabIndex={-1} />
      <ScrollToTop />
    </>,
  );
  return { notify, disconnect, options, scrollTo, view };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it('excludes the button from keyboard and accessibility navigation at the top', () => {
  const { notify, options, view, disconnect } = setup();
  expect(
    screen.queryByRole('button', { name: 'Cuộn lên đầu trang' }),
  ).toBeNull();
  expect(options).toHaveBeenCalledWith({ rootMargin: '400px 0px 0px' });
  act(() => notify(false));
  expect(
    screen.getByRole('button', { name: 'Cuộn lên đầu trang' }).tabIndex,
  ).toBe(0);
  act(() => notify(true));
  expect(
    screen.queryByRole('button', { name: 'Cuộn lên đầu trang' }),
  ).toBeNull();
  view.unmount();
  expect(disconnect).toHaveBeenCalledOnce();
});

it('scrolls smoothly and returns focus after scrolling ends', () => {
  const { notify, scrollTo } = setup();
  act(() => notify(false));
  fireEvent.click(screen.getByRole('button'));
  expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
  expect(document.activeElement).not.toBe(screen.getByRole('main'));
  fireEvent(window, new Event('scrollend'));
  expect(document.activeElement).toBe(screen.getByRole('main'));
});

it('jumps and moves focus immediately for reduced motion', () => {
  const { notify, scrollTo } = setup(true);
  act(() => notify(false));
  fireEvent.click(screen.getByRole('button'));
  expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'auto' });
  expect(document.activeElement).toBe(screen.getByRole('main'));
});
