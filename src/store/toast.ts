import { create } from 'zustand';

// Lightweight transient notification queue. Producers (key pickup, level
// change, etc.) call `push(text)` and the toast lives for ~3 s before
// the host strips it. The queue is unordered/parallel — multiple toasts
// stack vertically so a fast burst (e.g. portal teleport handing key
// + level change) doesn't drop any of them.

export type Toast = {
  id: number;
  text: string;
  // Optional accent — controls the left-edge stripe colour. Defaults to
  // the standard violet HUD palette when omitted.
  tone?: 'default' | 'success' | 'warning';
};

type ToastState = {
  toasts: Toast[];
  push: (text: string, tone?: Toast['tone']) => void;
  dismiss: (id: number) => void;
  clear: () => void;
};

let nextId = 1;

export const useToast = create<ToastState>((set) => ({
  toasts: [],
  push: (text, tone = 'default') =>
    set((s) => ({ toasts: [...s.toasts, { id: nextId++, text, tone }] })),
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  clear: () => set({ toasts: [] }),
}));
