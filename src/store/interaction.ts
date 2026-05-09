import { create } from 'zustand';

// Claim-based interaction slot. Each interactable (StarNpc, Portal, …)
// claims the slot when the player enters its range and releases when
// they leave. Multiple entities don't fight over the slot — claim() is
// a no-op while another owner already holds it. This keeps the HUD
// button stable when the player walks across overlapping triggers.

type InteractionState = {
  ownerId: string | null;
  available: boolean;
  prompt: string | null;
  claim: (ownerId: string, prompt?: string | null) => void;
  release: (ownerId: string) => void;
  // Force-clear (used on level transitions).
  reset: () => void;
};

export const useInteraction = create<InteractionState>((set) => ({
  ownerId: null,
  available: false,
  prompt: null,
  claim: (ownerId, prompt = null) =>
    set((s) => {
      if (s.ownerId !== null && s.ownerId !== ownerId) return s;
      return { ownerId, available: true, prompt };
    }),
  release: (ownerId) =>
    set((s) => (s.ownerId === ownerId ? { ownerId: null, available: false, prompt: null } : s)),
  reset: () => set({ ownerId: null, available: false, prompt: null }),
}));
