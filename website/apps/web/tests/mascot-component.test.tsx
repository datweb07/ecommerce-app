// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  MascotLayer,
  MascotPreferenceButton,
} from '../src/components/mascot/mascot-layer';
import { Mascot } from '../src/components/mascot/mascot';
import { mascotPreferenceKey } from '../src/lib/mascot/preference';

const flags = vi.hoisted(() => ({ path: '/', enabled: true, reduced: false }));
vi.mock('next/navigation', () => ({ usePathname: () => flags.path }));
vi.mock('next/dynamic', () => ({
  default: () => () => <div data-fixture-mascot="" aria-hidden="true" />,
}));
vi.mock('../src/config/public-env', () => ({
  publicEnv: {
    get NEXT_PUBLIC_MASCOT_ENABLED() {
      return flags.enabled;
    },
  },
}));

beforeEach(() => {
  flags.path = '/';
  flags.enabled = true;
  flags.reduced = false;
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      matches: flags.reduced,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
  vi.stubGlobal('requestIdleCallback', (run: () => void) =>
    window.setTimeout(run, 0),
  );
  vi.stubGlobal('cancelIdleCallback', (id: number) => window.clearTimeout(id));
});
afterEach(() => {
  cleanup();
  localStorage.clear();
  window.dispatchEvent(
    new StorageEvent('storage', { key: mascotPreferenceKey }),
  );
  Reflect.deleteProperty(document, 'hidden');
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('waits for load and idle, then unmounts while a dialog is open', async () => {
  const idle = vi.fn((run: () => void) => window.setTimeout(run, 30));
  vi.stubGlobal('requestIdleCallback', idle);
  const view = render(<MascotLayer />);
  expect(view.container.querySelector('[data-fixture-mascot]')).toBeNull();
  fireEvent.load(window);
  await waitFor(() =>
    expect(
      view.container
        .querySelector('[data-fixture-mascot]')
        ?.getAttribute('aria-hidden'),
    ).toBe('true'),
  );
  expect(idle).toHaveBeenCalledOnce();
  const modal = document.createElement('div');
  modal.dataset.mascotModal = '';
  modal.dataset.state = 'open';
  document.body.append(modal);
  await waitFor(() =>
    expect(view.container.querySelector('[data-fixture-mascot]')).toBeNull(),
  );
  modal.remove();
  await waitFor(() =>
    expect(
      view.container.querySelector('[data-fixture-mascot]'),
    ).not.toBeNull(),
  );
});

it('skips excluded routes, environment disable and reduced motion', async () => {
  const idle = vi.fn();
  vi.stubGlobal('requestIdleCallback', idle);
  for (const path of [
    '/checkout/return',
    '/admin/products',
    '/sign-in/reset',
    '/sign-up',
  ]) {
    flags.path = path;
    const view = render(
      <>
        <MascotLayer />
        <MascotPreferenceButton />
      </>,
    );
    fireEvent.load(window);
    expect(view.container.querySelector('[data-fixture-mascot]')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
    view.unmount();
  }
  flags.path = '/';
  flags.enabled = false;
  const disabled = render(
    <>
      <MascotLayer />
      <MascotPreferenceButton />
    </>,
  );
  expect(screen.queryByRole('button')).toBeNull();
  disabled.unmount();
  flags.enabled = true;
  flags.reduced = true;
  render(<MascotLayer />);
  fireEvent.load(window);
  expect(idle).not.toHaveBeenCalled();
});

it('persists footer preference and hides the layer after remount', async () => {
  const view = render(
    <>
      <MascotLayer />
      <MascotPreferenceButton />
    </>,
  );
  fireEvent.load(window);
  await waitFor(() =>
    expect(
      view.container.querySelector('[data-fixture-mascot]'),
    ).not.toBeNull(),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Ẩn linh vật' }));
  expect(localStorage.getItem(mascotPreferenceKey)).toBe('hidden');
  expect(view.container.querySelector('[data-fixture-mascot]')).toBeNull();
  view.unmount();
  render(
    <>
      <MascotLayer />
      <MascotPreferenceButton />
    </>,
  );
  expect(screen.getByRole('button', { name: 'Hiện linh vật' })).toBeTruthy();
});

it('keeps its preference in memory when localStorage writes fail', () => {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('No storage');
  });
  render(<MascotPreferenceButton />);
  fireEvent.click(screen.getByRole('button', { name: 'Ẩn linh vật' }));
  fireEvent.click(screen.getByRole('button', { name: 'Hiện linh vật' }));
  expect(screen.getByRole('button', { name: 'Ẩn linh vật' })).toBeTruthy();
});

it('uses one rAF, pauses on hidden tabs and aborts listeners on unmount', () => {
  const abort = vi.spyOn(AbortController.prototype, 'abort');
  const schedule = vi
    .fn<(callback: FrameRequestCallback) => number>()
    .mockReturnValue(9);
  const stop = vi.fn();
  vi.stubGlobal('requestAnimationFrame', schedule);
  vi.stubGlobal('cancelAnimationFrame', stop);
  const view = render(<Mascot />);
  expect(
    view.container.querySelector('[data-mascot]')?.getAttribute('aria-hidden'),
  ).toBe('true');
  expect(schedule).toHaveBeenCalledOnce();
  expect(
    view.container.querySelector('[data-mascot]')?.hasAttribute('tabindex'),
  ).toBe(false);
  act(() => schedule.mock.calls[0]?.[0](16));
  expect(schedule).toHaveBeenCalledTimes(2);
  Object.defineProperty(document, 'hidden', {
    configurable: true,
    value: true,
  });
  fireEvent(document, new Event('visibilitychange'));
  expect(stop).toHaveBeenCalledWith(9);
  const count = schedule.mock.calls.length;
  Object.defineProperty(document, 'hidden', {
    configurable: true,
    value: false,
  });
  fireEvent(document, new Event('visibilitychange'));
  expect(schedule).toHaveBeenCalledTimes(count + 1);
  view.unmount();
  expect(abort).toHaveBeenCalledOnce();
  expect(stop).toHaveBeenCalledTimes(2);
});
