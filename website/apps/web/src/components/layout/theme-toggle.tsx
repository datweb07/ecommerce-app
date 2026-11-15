'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useSyncExternalStore } from 'react';
import { flushSync } from 'react-dom';
import { t } from '../../lib/i18n';
import { prefersReducedMotion } from '../../lib/motion';

const subscribe = () => () => undefined;
let revealing = false;

export function ThemeToggle() {
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const { resolvedTheme, forcedTheme, setTheme } = useTheme();
  const dark = resolvedTheme === 'dark';

  function toggle(button: HTMLButtonElement) {
    if (!mounted || forcedTheme || revealing) return;
    const next = dark ? 'light' : 'dark';
    const apply = () => {
      button.dataset.themeUsed = '';
      setTheme(next);
    };
    if (
      prefersReducedMotion() ||
      !document.startViewTransition ||
      document.hidden
    ) {
      apply();
      return;
    }

    const root = document.documentElement;
    const rect = button.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    root.style.setProperty('--theme-reveal-x', x + 'px');
    root.style.setProperty('--theme-reveal-y', y + 'px');
    root.style.setProperty(
      '--theme-reveal-radius',
      Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y),
      ) + 'px',
    );
    root.dataset.themeReveal = '';
    revealing = true;
    function clear() {
      revealing = false;
      delete root.dataset.themeReveal;
      root.style.removeProperty('--theme-reveal-x');
      root.style.removeProperty('--theme-reveal-y');
      root.style.removeProperty('--theme-reveal-radius');
    }
    try {
      const transition = document.startViewTransition(() => flushSync(apply));
      // A skipped transition can reject ready while still applying the theme.
      void transition.ready.catch(() => undefined);
      void transition.finished.then(clear, clear);
    } catch {
      clear();
      apply();
    }
  }

  return (
    <button
      type="button"
      role={mounted ? 'switch' : undefined}
      aria-hidden={mounted ? undefined : true}
      aria-checked={mounted ? dark : undefined}
      aria-label={t('uiExtras', 'darkMode')}
      disabled={!mounted || Boolean(forcedTheme)}
      className="theme-toggle grid size-11 shrink-0 place-items-center rounded-control"
      onClick={(event) => toggle(event.currentTarget)}
    >
      <span className="relative block h-6 w-11 rounded-full border border-control-border bg-background">
        <span className="theme-thumb absolute top-px left-px grid size-5 place-items-center rounded-full bg-primary text-primary-foreground">
          <Sun
            className="theme-sun absolute"
            size={14}
            strokeWidth={1.5}
            aria-hidden="true"
          />
          <Moon
            className="theme-moon absolute"
            size={14}
            strokeWidth={1.5}
            aria-hidden="true"
          />
        </span>
      </span>
    </button>
  );
}
