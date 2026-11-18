// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from 'next-themes';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, expect, it, vi } from 'vitest';
import { ThemeToggle } from '../src/components/layout/theme-toggle';

function mockMotion(reduce = false) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      matches: reduce,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}
function theme(value: 'light' | 'dark' = 'light') {
  return (
    <ThemeProvider
      defaultTheme={value}
      attribute="class"
      disableTransitionOnChange
    >
      <ThemeToggle />
    </ThemeProvider>
  );
}
afterEach(() => {
  cleanup();
  Reflect.deleteProperty(document, 'startViewTransition');
  document.documentElement.className = '';
  localStorage.clear();
  vi.unstubAllGlobals();
});

it('reflects dark mode and toggles with Space and Enter without View Transitions', async () => {
  mockMotion();
  render(theme('dark'));
  const toggle = screen.getByRole('switch', { name: 'Chế độ tối' });
  expect(toggle.getAttribute('aria-checked')).toBe('true');
  toggle.focus();
  await userEvent.keyboard(' ');
  expect(document.documentElement.classList.contains('light')).toBe(true);
  expect(localStorage.getItem('theme')).toBe('light');
  expect(toggle.getAttribute('aria-checked')).toBe('false');
  await userEvent.keyboard('{Enter}');
  expect(toggle.getAttribute('aria-checked')).toBe('true');
  expect(localStorage.getItem('theme')).toBe('dark');
});
it('uses one View Transition and clears its temporary styles', async () => {
  mockMotion();
  const start = vi.fn((update: () => void) => {
    update();
    return { ready: Promise.resolve(), finished: Promise.resolve() };
  });
  Object.defineProperty(document, 'startViewTransition', {
    configurable: true,
    value: start,
  });
  render(theme());
  const toggle = screen.getByRole('switch');
  await userEvent.click(toggle);
  expect(start).toHaveBeenCalledOnce();
  expect(toggle.getAttribute('aria-checked')).toBe('true');
  expect(document.documentElement.hasAttribute('data-theme-reveal')).toBe(
    false,
  );
});
it('skips the View Transition when reduced motion is enabled', async () => {
  mockMotion(true);
  const start = vi.fn();
  Object.defineProperty(document, 'startViewTransition', {
    configurable: true,
    value: start,
  });
  render(theme());
  await userEvent.click(screen.getByRole('switch'));
  expect(start).not.toHaveBeenCalled();
  expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('true');
});
it('hydrates the same footprint without announcing an unchecked server placeholder', async () => {
  mockMotion();
  const el = document.createElement('div');
  el.innerHTML = renderToString(theme('dark'));
  expect(el.querySelector('button')?.hasAttribute('aria-checked')).toBe(false);
  expect(el.querySelector('button')?.classList.contains('size-11')).toBe(true);
  document.body.append(el);
  const errors = vi.fn();
  const root = hydrateRoot(el, theme('dark'), { onRecoverableError: errors });
  try {
    await act(async () => {});
    expect(
      el.querySelector('[role=switch]')?.getAttribute('aria-checked'),
    ).toBe('true');
    expect(errors).not.toHaveBeenCalled();
  } finally {
    await act(async () => root.unmount());
    el.remove();
  }
});
