import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Audio settings live separate from gameplay state so they survive a
// "New Game" reset. Persisted to localStorage so the player keeps
// their preferred mix across sessions.
type AudioState = {
  musicVolume: number; // 0–1
  setMusicVolume: (v: number) => void;
};

export const useAudio = create<AudioState>()(
  persist(
    (set) => ({
      musicVolume: 0.55,
      setMusicVolume: (v) => set({ musicVolume: Math.max(0, Math.min(1, v)) }),
    }),
    {
      name: 'spelauget.audio',
      version: 1,
      partialize: (s) => ({ musicVolume: s.musicVolume }),
    },
  ),
);
