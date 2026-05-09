import { create } from 'zustand';

// Set by NPCs / interactables in their useFrame loops based on player
// proximity. The HUD button reads this to know whether to render. The
// `prompt` slot is reserved for future per-interaction prompts ("Bukk
// for å hilse", "Plukk opp", etc.) — kept on a single store so only one
// can be active at a time.
type InteractionState = {
  available: boolean;
  prompt: string | null;
  setAvailable: (available: boolean, prompt?: string | null) => void;
};

export const useInteraction = create<InteractionState>((set) => ({
  available: false,
  prompt: null,
  setAvailable: (available, prompt = null) => set({ available, prompt }),
}));
