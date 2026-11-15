'use client';

import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { publicEnv } from '../../config/public-env';
import { hiddenMascotPaths } from '../../config/mascot';
import { prefersReducedMotion, reducedMotionQuery } from '../../lib/motion';
import {
  mascotPreference,
  setMascotPreference,
  subscribeMascotPreference,
} from '../../lib/mascot/preference';
import { t } from '../../lib/i18n';

const Mascot = dynamic(
  () => import('./mascot').then((module) => module.Mascot),
  { ssr: false },
);
const visibleByDefault = () => true;
const noModalOnServer = () => false;

function controlAllowed(path: string) {
  return (
    publicEnv.NEXT_PUBLIC_MASCOT_ENABLED &&
    !hiddenMascotPaths.some(
      (root) => path === root || path.startsWith(root + '/'),
    )
  );
}
function subscribeMotion(notify: () => void) {
  const query = window.matchMedia?.(reducedMotionQuery);
  query?.addEventListener('change', notify);
  return () => query?.removeEventListener('change', notify);
}
function modalIsOpen() {
  return (
    document.body.hasAttribute('data-scroll-locked') ||
    Boolean(
      document.querySelector(
        '[data-mascot-modal][data-state="open"],dialog[open],[aria-modal="true"]',
      ),
    )
  );
}
function subscribeModal(notify: () => void) {
  const observer = new MutationObserver(notify);
  observer.observe(document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['data-scroll-locked', 'data-state', 'open', 'aria-modal'],
  });
  return () => observer.disconnect();
}

export function MascotLayer() {
  const allowed = controlAllowed(usePathname());
  const enabled = useSyncExternalStore(
    subscribeMascotPreference,
    mascotPreference,
    visibleByDefault,
  );
  const reduced = useSyncExternalStore(
    subscribeMotion,
    prefersReducedMotion,
    visibleByDefault,
  );
  const modal = useSyncExternalStore(
    subscribeModal,
    modalIsOpen,
    noModalOnServer,
  );
  const [idle, setIdle] = useState(false);
  const active = allowed && enabled && !reduced && !modal;

  useEffect(() => {
    if (!active || idle) return;
    let cancel = () => {};
    function afterLoad() {
      if (typeof window.requestIdleCallback === 'function') {
        const id = window.requestIdleCallback(() => setIdle(true), {
          timeout: 1800,
        });
        cancel = () => window.cancelIdleCallback(id);
      } else {
        const id = window.setTimeout(() => setIdle(true), 200);
        cancel = () => window.clearTimeout(id);
      }
    }
    if (document.readyState === 'complete') afterLoad();
    else window.addEventListener('load', afterLoad, { once: true });
    return () => {
      window.removeEventListener('load', afterLoad);
      cancel();
    };
  }, [active, idle]);

  return active && idle ? <Mascot /> : null;
}

export function MascotPreferenceButton() {
  const allowed = controlAllowed(usePathname());
  const enabled = useSyncExternalStore(
    subscribeMascotPreference,
    mascotPreference,
    visibleByDefault,
  );
  if (!allowed) return null;
  return (
    <button
      type="button"
      className="min-h-11 w-fit min-w-28 rounded-control text-left text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      onClick={() => setMascotPreference(!enabled)}
    >
      {t('uiExtras', enabled ? 'hideMascot' : 'showMascot')}
    </button>
  );
}
