'use client';

import { useEffect, useRef } from 'react';
import { useAudio } from '@/store/audio';
import { useLevel } from '@/store/level';
import type { LevelId } from './levels';

// Per-level playlists. The two halves of the original score were split
// roughly by mood: the first two tracks lean toward the warmer
// magenta-Lysningen vibe; the last two toward the cooler Stjerneengen
// teal palette. The currently-playing track always finishes — only the
// NEXT track is picked from the active level's pool, so level changes
// cross-mood gradually rather than cutting mid-bar.
const PLAYLISTS: Record<LevelId, string[]> = {
  level1: ['/sounds/ost_01.mp3', '/sounds/ost_02.mp3'],
  level2: ['/sounds/ost_03.mp3', '/sounds/ost_04.mp3'],
};
const FADE_MS = 4000;

// Background soundtrack. Tries to start on mount so the splash menu
// already has music. Most browsers block autoplay until the user has
// interacted with the page; if play() rejects we register a one-shot
// listener that retries on the very next pointer / key event.
export default function BackgroundMusic() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const audio = new Audio();
    audio.loop = false;
    audio.volume = 0;
    audio.preload = 'auto';
    audioRef.current = audio;

    let queue: string[] = [];
    let queueLevel: LevelId | null = null;
    const refillQueue = () => {
      const level = useLevel.getState().currentLevelId;
      queue = [...PLAYLISTS[level]].sort(() => Math.random() - 0.5);
      queueLevel = level;
    };
    const nextTrack = () => {
      const currentLevel = useLevel.getState().currentLevelId;
      // If the player changed level mid-track the queue is now stale —
      // toss it and refill from the new level's pool. This keeps each
      // post-transition track on-mood for the level we're actually in.
      if (queue.length === 0 || queueLevel !== currentLevel) refillQueue();
      const src = queue.shift();
      if (!src) return;
      audio.src = src;
      audio.play().catch(() => {});
    };
    audio.addEventListener('ended', nextTrack);
    nextTrack();

    let fadeStart = 0;
    let raf = 0;
    const tick = () => {
      const t = Math.min(1, (performance.now() - fadeStart) / FADE_MS);
      // Fade reads useAudio each frame so a slider change mid-fade is
      // honoured immediately.
      audio.volume = t * useAudio.getState().musicVolume;
      if (t < 1) raf = requestAnimationFrame(tick);
    };

    const beginFade = () => {
      if (fadeStart) return;
      fadeStart = performance.now();
      raf = requestAnimationFrame(tick);
    };

    // Try playing immediately. If the browser blocked us (no prior user
    // gesture), wait for the first input event and retry then.
    const attempt = audio.play();
    let cleanupListener: (() => void) | null = null;
    if (attempt) {
      attempt.then(beginFade).catch(() => {
        const onFirst = () => {
          audio.play().then(beginFade).catch(() => {});
          window.removeEventListener('pointerdown', onFirst);
          window.removeEventListener('keydown', onFirst);
          window.removeEventListener('touchstart', onFirst);
        };
        window.addEventListener('pointerdown', onFirst, { once: true });
        window.addEventListener('keydown', onFirst, { once: true });
        window.addEventListener('touchstart', onFirst, { once: true });
        cleanupListener = () => {
          window.removeEventListener('pointerdown', onFirst);
          window.removeEventListener('keydown', onFirst);
          window.removeEventListener('touchstart', onFirst);
        };
      });
    }

    // After the initial fade we react to slider changes via subscribe.
    const unsub = useAudio.subscribe((s) => {
      const a = audioRef.current;
      if (!a) return;
      if (!fadeStart) return; // not yet started
      const elapsed = performance.now() - fadeStart;
      if (elapsed >= FADE_MS) a.volume = s.musicVolume;
    });

    // Pause music when the tab is backgrounded — there's no point
    // burning bandwidth on audio the player can't hear, and resuming
    // mid-track when they come back is more pleasant than restarting
    // from silence.
    const onVisibility = () => {
      const a = audioRef.current;
      if (!a) return;
      if (document.visibilityState === 'hidden') {
        a.pause();
      } else if (a.paused) {
        a.play().catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelAnimationFrame(raf);
      audio.removeEventListener('ended', nextTrack);
      document.removeEventListener('visibilitychange', onVisibility);
      cleanupListener?.();
      unsub();
    };
  }, []);

  // Pause on full unmount.
  useEffect(() => {
    return () => {
      const a = audioRef.current;
      if (a) {
        a.pause();
        a.src = '';
        audioRef.current = null;
      }
    };
  }, []);

  return null;
}
