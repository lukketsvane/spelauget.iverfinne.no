'use client';

import { useEffect } from 'react';
import { useToast, type Toast } from '@/store/toast';

const LIFE_MS = 3000;

// Renders the toast queue as a stack at the top-centre of the screen.
// Each toast self-dismisses after LIFE_MS via its own setTimeout — the
// store stays minimal and doesn't need to know about timers.
//
// Top-centre keeps notifications in the eye-line during gameplay
// (where the camera follows the player), and avoids fighting the
// dialogue panel + emote button at the bottom.
export default function ToastHost() {
  const toasts = useToast((s) => s.toasts);
  return (
    <div className="pointer-events-none absolute inset-x-0 top-6 z-30 flex flex-col items-center gap-2">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  );
}

function ToastItem({ toast }: { toast: Toast }) {
  const dismiss = useToast((s) => s.dismiss);
  useEffect(() => {
    const handle = window.setTimeout(() => dismiss(toast.id), LIFE_MS);
    return () => window.clearTimeout(handle);
  }, [toast.id, dismiss]);

  const accent =
    toast.tone === 'success'
      ? 'border-emerald-300/70 bg-emerald-950/80 text-emerald-100'
      : toast.tone === 'warning'
        ? 'border-amber-300/70 bg-amber-950/80 text-amber-100'
        : 'border-pink-300/60 bg-violet-950/80 text-violet-100';
  return (
    <div
      className={
        'animate-toast-in rounded-md border-2 px-4 py-2 text-sm font-bold uppercase tracking-[0.2em] ' +
        accent
      }
    >
      {toast.text}
    </div>
  );
}
