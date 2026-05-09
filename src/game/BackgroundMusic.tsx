'use client';

import { useEffect, useRef } from 'react';
import { useMenu } from '@/store/menu';

// Playlist of soundtrack chunks. Splitting the original 41 MB OST into
// four files lets the first track start playing fast while the rest
// stream in the background; the service worker caches them all so
// returning visits are instant.
const PLAYLIST = [
  '/sounds/ost_01.mp3',
  '/sounds/ost_02.mp3',
  '/sounds/ost_03.mp3',
  '/sounds/ost_04.mp3',
];
const TARGET_VOLUME = 0.55;
const FADE_MS = 4000;

// Background soundtrack. Stays silent until inGame=true (a New Game /
// Continue click satisfies the browser's autoplay gesture
// requirement). Fades in over four seconds, then advances through the
// playlist in random order — a fresh cycle picks a fresh shuffle so
// the same track doesn't immediately repeat.
export default function BackgroundMusic() {
  const inGame = useMenu((s) => s.inGame);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!inGame || startedRef.current) return;
    startedRef.current = true;

    const audio = new Audio();
    audio.loop = false; // we manually advance the playlist on `ended`
    audio.volume = 0;
    audio.preload = 'auto';
    audioRef.current = audio;

    // Build a shuffled queue. When it empties, reshuffle so the same
    // track doesn't replay back-to-back across cycles.
    let queue: string[] = [];
    const refillQueue = () => {
      queue = [...PLAYLIST].sort(() => Math.random() - 0.5);
    };
    const nextTrack = () => {
      if (queue.length === 0) refillQueue();
      const src = queue.shift();
      if (!src) return;
      audio.src = src;
      audio.play().catch(() => {});
    };

    audio.addEventListener('ended', nextTrack);
    nextTrack();

    let raf = 0;
    const start = performance.now();
    const tick = () => {
      const t = Math.min(1, (performance.now() - start) / FADE_MS);
      audio.volume = t * TARGET_VOLUME;
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      audio.removeEventListener('ended', nextTrack);
    };
  }, [inGame]);

  // Pause on full unmount (page navigation away).
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
