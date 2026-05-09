import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Display + accessibility settings. `exposure` persists to localStorage
// so the player keeps their brightness preference across sessions.
// `reduceMotion` does NOT persist — it follows the OS-level media query
// each time the page loads, so a user who toggles their preference
// between visits gets the new behaviour without us baking a stale flag
// into storage.
type SettingsState = {
  // True when the user has prefers-reduced-motion: reduce. Plants stop
  // swaying, the splash fade is short, portal shimmer dampens, etc.
  reduceMotion: boolean;
  // Multiplier on gl.toneMappingExposure. 1.0 is the default; users
  // can crank it up if their display is dim.
  exposure: number;
  setReduceMotion: (v: boolean) => void;
  setExposure: (v: number) => void;
};

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      reduceMotion: false,
      exposure: 1.0,
      setReduceMotion: (reduceMotion) => set({ reduceMotion }),
      setExposure: (exposure) => set({ exposure: Math.max(0.4, Math.min(1.8, exposure)) }),
    }),
    {
      name: 'spelauget.settings',
      version: 1,
      partialize: (s) => ({ exposure: s.exposure }),
    },
  ),
);

// Initialise reduceMotion from the OS media query. Re-runs on change
// so a user who toggles the preference mid-session gets it right away.
// SSR-safe: only attaches listeners in a browser.
if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  useSettings.getState().setReduceMotion(mq.matches);
  const onChange = (e: MediaQueryListEvent) => {
    useSettings.getState().setReduceMotion(e.matches);
  };
  // Older Safari versions only support addListener.
  if (typeof mq.addEventListener === 'function') {
    mq.addEventListener('change', onChange);
  } else if (typeof mq.addListener === 'function') {
    mq.addListener(onChange);
  }
}
