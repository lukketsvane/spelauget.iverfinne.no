'use client';

import { useEffect, useRef } from 'react';
import { useAudio } from '@/store/audio';
import { useLevel } from '@/store/level';
import type { RegionId } from './regions';

// Per-region playlists. Each chain world picks tracks by mood; the
// legacy `remnants` row is kept as a fallback even though no
// content currently targets it.
const PLAYLISTS: Record<RegionId, string[]> = {
  lysningen: ['/sounds/ost_01.mp3', '/sounds/ost_02.mp3'],
  remnants: ['/sounds/ost_04.mp3', '/sounds/ost_03.mp3'],
  blod: ['/sounds/ost_03.mp3', '/sounds/ost_04.mp3'],
  geometri: ['/sounds/ost_04.mp3', '/sounds/ost_03.mp3'],
  siste: ['/sounds/ost_04.mp3', '/sounds/ost_03.mp3'],
  senter: ['/sounds/ost_01.mp3', '/sounds/ost_02.mp3'],
};
const FADE_MS = 4000;

// Background soundtrack. Tries to start on mount so the splash menu
// already has music. Most browsers block autoplay until the user has
// interacted with the page; if play() rejects we register a one-shot
// listener that retries on the very next pointer / key event.
//
// Setup + teardown live in a single useEffect so React 18 StrictMode's
// mount → unmount → remount cycle creates a fresh Audio element each
// time rather than leaving a stale "we already started" flag in a ref
// while the cleanup pauses the only audio instance.
export default function BackgroundMusic() {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = new Audio();
    audio.loop = false;
    audio.volume = 0;
    audio.preload = 'auto';
    audioRef.current = audio;

    // --- Track queue ---------------------------------------------------
    let queue: string[] = [];
    let queueRegion: RegionId | null = null;
    const refillQueue = () => {
      const region = useLevel.getState().currentRegionId;
      queue = [...PLAYLISTS[region]].sort(() => Math.random() - 0.5);
      queueRegion = region;
    };
    // Picks the next track and kicks off play(). Returns the play
    // promise so the caller can hook fade-in / autoplay-fallback off
    // the first attempt's resolution.
    const nextTrack = (): Promise<void> | null => {
      const currentRegion = useLevel.getState().currentRegionId;
      // Stale queue (region changed mid-track) → toss it and refill
      // from the new region's pool. Each post-transition track stays
      // on-mood.
      if (queue.length === 0 || queueRegion !== currentRegion) refillQueue();
      const src = queue.shift();
      if (!src) return null;
      audio.src = src;
      return audio.play();
    };
    const onEnded = () => {
      nextTrack()?.catch(() => {});
    };
    audio.addEventListener('ended', onEnded);

    // --- Volume fade-in ------------------------------------------------
    let fadeStart = 0;
    let raf = 0;
    const tick = () => {
      const t = Math.min(1, (performance.now() - fadeStart) / FADE_MS);
      // Read useAudio each frame so a slider drag mid-fade is honoured
      // immediately rather than snapping at the end of the fade.
      audio.volume = t * useAudio.getState().musicVolume;
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    const beginFade = () => {
      if (fadeStart) return;
      fadeStart = performance.now();
      raf = requestAnimationFrame(tick);
    };

    // --- First attempt + autoplay fallback -----------------------------
    let cleanupListener: (() => void) | null = null;
    const attempt = nextTrack();
    if (attempt) {
      attempt.then(beginFade).catch(() => {
        // Browser blocked autoplay — wait for the first user gesture
        // and retry then. Touchstart / pointerdown / keydown all count
        // as gestures that unlock audio in modern browsers.
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

    // --- Live volume slider --------------------------------------------
    // After the initial fade we react to slider changes via subscribe.
    const unsub = useAudio.subscribe((s) => {
      const a = audioRef.current;
      if (!a) return;
      if (!fadeStart) return; // not yet started
      const elapsed = performance.now() - fadeStart;
      if (elapsed >= FADE_MS) a.volume = s.musicVolume;
    });

    // --- Pause when tab backgrounded -----------------------------------
    // No point burning bandwidth on audio the player can't hear, and
    // resuming mid-track when they come back is more pleasant than
    // restarting from silence.
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

    // --- Teardown ------------------------------------------------------
    return () => {
      cancelAnimationFrame(raf);
      audio.removeEventListener('ended', onEnded);
      document.removeEventListener('visibilitychange', onVisibility);
      cleanupListener?.();
      unsub();
      audio.pause();
      audio.src = '';
      audioRef.current = null;
    };
  }, []);

  return null;
}
