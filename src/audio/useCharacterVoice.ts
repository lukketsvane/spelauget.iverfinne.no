/**
 * useCharacterVoice — drop-in React hook for TotK-style dialogue grunts.
 * Lifted from the Super Dialogue Audio Pack we ship under
 * /public/sounds/voices, so the same code works against the OGG files
 * that live there.
 */

import { useEffect, useMemo, useRef } from 'react';

export type VoiceProfile = {
  pool: string; // folder name, e.g. 'pixel_low' or 'alex'
  pitchRange?: [number, number]; // playbackRate range, default [0.95, 1.05]
  volume?: number; // 0..1, default 0.5
  cooldownMs?: number; // min gap between clips, default 120
};

export type SpeakConfig = {
  basePath: string; // e.g. '/sounds/voices'
  profiles: Record<string, VoiceProfile>;
  /** max files to probe per pool (default 30) */
  maxClipsPerPool?: number;
};

type Pool = AudioBuffer[];

export function useCharacterVoice(config: SpeakConfig) {
  const ctxRef = useRef<AudioContext | null>(null);
  const poolsRef = useRef<Record<string, Pool>>({});
  const lastPlayedAtRef = useRef<Record<string, number>>({});

  // Lazy-load every pool exactly once. AudioContext is created up-front
  // and resumed on the first speak() call (browsers require a user
  // gesture before audio actually plays).
  useEffect(() => {
    let cancelled = false;
    const max = config.maxClipsPerPool ?? 30;

    async function load() {
      type AudioCtxCtor = typeof AudioContext;
      const Ctx: AudioCtxCtor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: AudioCtxCtor }).webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      ctxRef.current = ctx;

      // Unique pool names across all profiles — many profiles can share
      // a folder.
      const pools = new Set<string>(Object.values(config.profiles).map((p) => p.pool));

      for (const pool of pools) {
        const buffers: AudioBuffer[] = [];
        for (let i = 1; i <= max; i++) {
          const url = `${config.basePath}/${pool}/talk_${String(i).padStart(2, '0')}.ogg`;
          try {
            const r = await fetch(url);
            if (!r.ok) break; // stop probing this pool
            const ab = await r.arrayBuffer();
            const buf = await ctx.decodeAudioData(ab);
            buffers.push(buf);
          } catch {
            break;
          }
        }
        if (cancelled) return;
        poolsRef.current[pool] = buffers;
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [config.basePath, config.profiles, config.maxClipsPerPool]);

  // The returned speak() function is stable across renders so
  // subscribers can hold onto a single reference.
  return useMemo(() => {
    return function speak(characterId: string) {
      const profile = config.profiles[characterId];
      if (!profile) return;
      const ctx = ctxRef.current;
      if (!ctx) return;
      if (ctx.state === 'suspended') ctx.resume();

      const cooldown = profile.cooldownMs ?? 120;
      const now = performance.now();
      const last = lastPlayedAtRef.current[characterId] ?? 0;
      if (now - last < cooldown) return;
      lastPlayedAtRef.current[characterId] = now;

      const pool = poolsRef.current[profile.pool];
      if (!pool || pool.length === 0) return;

      const buf = pool[Math.floor(Math.random() * pool.length)];
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const [pmin, pmax] = profile.pitchRange ?? [0.95, 1.05];
      src.playbackRate.value = pmin + Math.random() * (pmax - pmin);

      const gain = ctx.createGain();
      gain.gain.value = profile.volume ?? 0.5;

      src.connect(gain).connect(ctx.destination);
      src.start();
    };
  }, [config.profiles]);
}
