'use client';

import { useEffect } from 'react';
import { useCharacterVoice } from '@/audio/useCharacterVoice';
import { setSpeakFn } from '@/audio/speak';
import { VOICE_BASE_PATH, VOICE_PROFILES, type VoiceId } from '@/audio/voiceProfiles';

// Singleton voice host. Loads every pool listed in VOICE_PROFILES once
// at app start and publishes the `speak` fn to the module-level
// singleton in `audio/speak.ts`. The actual triggering happens inside
// the dialogue typewriter (Dialogue.tsx), which calls `speak(voice)`
// on every character tick to produce continuous animalese-style
// babble — the per-profile cooldown throttles down to a natural
// cadence.
export default function VoiceHost() {
  const speak = useCharacterVoice({
    basePath: VOICE_BASE_PATH,
    profiles: VOICE_PROFILES,
  });

  useEffect(() => {
    setSpeakFn(speak as (id: VoiceId) => void);
    return () => setSpeakFn(null);
  }, [speak]);

  return null;
}
