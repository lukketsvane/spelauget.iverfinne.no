import type { VoiceProfile } from './useCharacterVoice';

// Voice id → profile mapping. The dialogue typewriter calls speak()
// on every character reveal; the cooldown throttles those calls down
// to an animalese-style cadence (~10-13 grunts per second of typed
// text), giving the impression of continuous creature babble while
// the line types out.
//
// digger  → "Stjernekarakteren". Deep, slow, creature-like — the
//           pixel_lowest pool sounds like a half-buried thing
//           muttering up through the dirt.
// bobble  → floating bubble-headed NPC in Stjerneengen. Light and
//           airy — pixel_high reads as a chirpy spirit.
// player  → reserved id for the silent protagonist. Empty pool means
//           speak('player') is a no-op (no grunt, but the line still
//           shows on screen).

export type VoiceId = 'digger' | 'bobble' | 'player';

export const VOICE_BASE_PATH = '/sounds/voices';

export const VOICE_PROFILES: Record<VoiceId, VoiceProfile> = {
  digger: {
    pool: 'pixel_lowest',
    // Wider pitch range than the default so consecutive grunts vary
    // in tone — kills the metronome feel.
    pitchRange: [0.78, 1.05],
    volume: 0.55,
    // ~13 grunts/sec at the typewriter's 28 ms/char tick → roughly one
    // grunt every 2-3 letters. Animalese-fast.
    cooldownMs: 75,
  },
  bobble: {
    pool: 'pixel_high',
    pitchRange: [0.92, 1.18],
    volume: 0.42,
    // Slightly snappier than the digger so Bobble feels chirpier.
    cooldownMs: 65,
  },
  // Empty pool — speak('player') silently no-ops. Kept in the map so
  // TS lookups don't have to be optional.
  player: {
    pool: '__none__',
    volume: 0,
  },
};
