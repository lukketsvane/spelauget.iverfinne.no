'use client';

import { useGame } from '@/store/game';
import { useLevel } from '@/store/level';
import { useMenu } from '@/store/menu';

// Lightweight settings panel — close button + a destructive "Erase
// progress" action. Future audio / language toggles slot in here.
export default function SettingsPanel() {
  const close = useMenu((s) => s.closeSettings);

  const handleErase = () => {
    if (typeof window === 'undefined') return;
    const confirmed = window.confirm('Erase saved progress? This cannot be undone.');
    if (!confirmed) return;
    window.localStorage.removeItem('spelauget.level');
    window.localStorage.removeItem('spelauget.game');
    useLevel.getState().reset();
    useGame.getState().reset();
    close();
    // Force the menu's hasSave flag to recalc by reloading.
    window.location.reload();
  };

  return (
    <div
      className="absolute inset-0 z-10 flex items-center justify-center bg-black/70"
      onClick={close}
    >
      <div
        className="w-[min(90vw,360px)] rounded-2xl border border-violet-300/40 bg-violet-950/95 p-6 text-violet-50 shadow-[0_8px_40px_rgba(170,80,220,0.35)]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-center text-lg font-semibold uppercase tracking-[0.2em] text-pink-200">
          Settings
        </h2>

        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={handleErase}
            className="rounded-lg border border-rose-400/50 bg-rose-900/40 px-4 py-2 text-sm font-semibold uppercase tracking-wider text-rose-100 transition hover:bg-rose-900/60 active:scale-95"
          >
            Erase save
          </button>
          <button
            type="button"
            onClick={close}
            className="rounded-lg border border-violet-300/40 bg-violet-900/40 px-4 py-2 text-sm font-semibold uppercase tracking-wider text-violet-100 transition hover:bg-violet-900/60 active:scale-95"
          >
            Back
          </button>
        </div>
      </div>
    </div>
  );
}
