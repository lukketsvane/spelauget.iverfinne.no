// Module-level bridge between the React-mounted voice host (which owns
// the AudioContext + buffer pools) and the typewriter (which calls
// speak on every character tick to produce continuous babble).
//
// VoiceHost.tsx writes the actual speak fn into _speak on mount; any
// caller before that — or after a teardown — is a silent no-op.
//
// Using a module singleton (rather than zustand) keeps the hot path
// allocation-free: `speak('digger')` is one map lookup and one
// function call per character.

import type { VoiceId } from './voiceProfiles';

let _speak: ((id: VoiceId) => void) | null = null;

export function setSpeakFn(fn: ((id: VoiceId) => void) | null) {
  _speak = fn;
}

export function speak(id: VoiceId): void {
  _speak?.(id);
}
