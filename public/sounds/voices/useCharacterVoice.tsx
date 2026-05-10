/**
 * useCharacterVoice — drop-in React hook for TotK-style dialogue grunts.
 *
 * Usage:
 *
 *   const speak = useCharacterVoice({
 *     basePath: '/audio/voices',                  // where you serve this pack from
 *     profiles: {
 *       cleaner:       { pool: 'pixel_lowest', pitchRange: [0.95, 1.05], volume: 0.55 },
 *       forest_spirit: { pool: 'pixel_high',   pitchRange: [0.92, 1.10], volume: 0.40 },
 *       old_man:       { pool: 'sean',         pitchRange: [0.85, 0.95], volume: 0.55 },
 *     },
 *   });
 *
 *   // call once per dialogue chunk reveal (NOT per letter)
 *   speak('cleaner');
 *
 * Each `pool` must match a folder name in this pack (e.g. 'alex', 'pixel_med').
 * The hook auto-discovers `talk_01.ogg` … `talk_NN.ogg` (probes until 404).
 */

import { useEffect, useMemo, useRef } from 'react';

export type VoiceProfile = {
  pool: string;             // folder name, e.g. 'pixel_low' or 'alex'
  pitchRange?: [number, number]; // playbackRate range, default [0.95, 1.05]
  volume?: number;          // 0..1, default 0.5
  cooldownMs?: number;      // min gap between clips, default 120
};

export type SpeakConfig = {
  basePath: string;                          // e.g. '/audio/voices'
  profiles: Record<string, VoiceProfile>;    // characterId -> profile
  /** max files to probe per pool (default 30) */
  maxClipsPerPool?: number;
};

type Pool = AudioBuffer[];

export function useCharacterVoice(config: SpeakConfig) {
  const ctxRef = useRef<AudioContext | null>(null);
  const poolsRef = useRef<Record<string, Pool>>({});
  const lastPlayedAtRef = useRef<Record<string, number>>({});

  // lazy-load everything once
  useEffect(() => {
    let cancelled = false;
    const max = config.maxClipsPerPool ?? 30;

    async function load() {
      // create AudioContext on first user gesture; for now we'll create it now
      // and resume on first speak() call (browsers require a gesture).
      const Ctx: typeof AudioContext =
        (window.AudioContext || (window as any).webkitAudioContext);
      const ctx = new Ctx();
      ctxRef.current = ctx;

      // unique pool names across all profiles
      const pools = new Set<string>(Object.values(config.profiles).map(p => p.pool));

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
    return () => { cancelled = true; };
  }, [config.basePath]); // basePath only — profiles can change at runtime

  // returned speak() function is stable across renders
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
