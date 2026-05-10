import { create } from 'zustand';
import type { VoiceId } from '@/audio/voiceProfiles';

export type DialogueLine = {
  speaker?: string;
  text: string;
  // When true, the line is rendered as a stage direction (italic, faded)
  // rather than spoken speech. Useful for "*(reaches out…)*" beats.
  action?: boolean;
};

type DialogueState = {
  active: boolean;
  lines: DialogueLine[];
  index: number;
  // requestId increments on each line change so the typewriter UI can
  // restart its effect even when the same line is re-shown.
  requestId: number;
  // Optional voice profile for the current conversation. The dialogue
  // host fires one grunt per line reveal using this id (TotK-style).
  // null when nobody's speaking or the speaker is silent.
  voice: VoiceId | null;
  start: (lines: DialogueLine[], voice?: VoiceId) => void;
  next: () => void;
  close: () => void;
};

export const useDialogue = create<DialogueState>((set) => ({
  active: false,
  lines: [],
  index: 0,
  requestId: 0,
  voice: null,
  start: (lines, voice) =>
    set((s) => ({
      active: true,
      lines,
      index: 0,
      requestId: s.requestId + 1,
      voice: voice ?? null,
    })),
  next: () =>
    set((s) => {
      if (s.index >= s.lines.length - 1) {
        return { active: false, requestId: s.requestId + 1, voice: null };
      }
      return { index: s.index + 1, requestId: s.requestId + 1 };
    }),
  close: () =>
    set((s) => ({ active: false, requestId: s.requestId + 1, voice: null })),
}));
