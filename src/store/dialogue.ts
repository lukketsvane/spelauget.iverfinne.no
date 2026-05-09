import { create } from 'zustand';

export type DialogueLine = { speaker?: string; text: string };

type DialogueState = {
  active: boolean;
  lines: DialogueLine[];
  index: number;
  // requestId increments on each line change so the typewriter UI can
  // restart its effect even when the same line is re-shown.
  requestId: number;
  start: (lines: DialogueLine[]) => void;
  next: () => void;
  close: () => void;
};

export const useDialogue = create<DialogueState>((set) => ({
  active: false,
  lines: [],
  index: 0,
  requestId: 0,
  start: (lines) =>
    set((s) => ({
      active: true,
      lines,
      index: 0,
      requestId: s.requestId + 1,
    })),
  next: () =>
    set((s) => {
      if (s.index >= s.lines.length - 1) {
        return { active: false, requestId: s.requestId + 1 };
      }
      return { index: s.index + 1, requestId: s.requestId + 1 };
    }),
  close: () => set((s) => ({ active: false, requestId: s.requestId + 1 })),
}));
