export const mascotPreferenceKey = 'shopease-mascot';
const preferenceEvent = 'shopease:mascot-preference';
let memoryOverride: boolean | undefined;

export function mascotPreference() {
  if (memoryOverride !== undefined) return memoryOverride;
  try {
    return window.localStorage.getItem(mascotPreferenceKey) !== 'hidden';
  } catch {
    return true;
  }
}

export function setMascotPreference(enabled: boolean) {
  try {
    window.localStorage.setItem(
      mascotPreferenceKey,
      enabled ? 'shown' : 'hidden',
    );
    memoryOverride = undefined;
  } catch {
    memoryOverride = enabled;
  }
  window.dispatchEvent(new Event(preferenceEvent));
}

export function subscribeMascotPreference(notify: () => void) {
  const storageChanged = (event: StorageEvent) => {
    if (event.key === null || event.key === mascotPreferenceKey) {
      memoryOverride = undefined;
      notify();
    }
  };
  window.addEventListener(preferenceEvent, notify);
  window.addEventListener('storage', storageChanged);
  return () => {
    window.removeEventListener(preferenceEvent, notify);
    window.removeEventListener('storage', storageChanged);
  };
}
