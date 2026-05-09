import { create } from 'zustand';

// One-shot signal: incrementing requestId is observed by Character.tsx via
// store subscription, which fires the emote animation. Using a counter
// (vs. a boolean) lets repeated requests fire each time without manual
// reset state.
type EmoteState = {
  requestId: number;
  request: () => void;
};

export const useEmote = create<EmoteState>((set) => ({
  requestId: 0,
  request: () => set((s) => ({ requestId: s.requestId + 1 })),
}));
