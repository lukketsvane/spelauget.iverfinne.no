'use client';

import { useEffect } from 'react';

// Registers the service worker that pre-caches the GLB / texture / shell
// bundle, so iOS "Add to Home Screen" launches feel native and survive
// offline. Production-only — dev would just confuse HMR.
export default function ServiceWorker() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Registration failures shouldn't break the game — silently skip.
    });
  }, []);
  return null;
}
