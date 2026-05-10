'use client';

import { useEffect, useRef, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useAudio } from '@/store/audio';
import { useDialogue } from '@/store/dialogue';
import { useGame } from '@/store/game';

// Distance over which the beacon fades from full volume (right next to
// the digger) to silent. The Lysningen is ~30 m across so this gives
// the player about half the map of audible runway.
const MAX_DISTANCE = 22;
// Period between "shovel thuds" in seconds.
const THUD_PERIOD = 1.45;
// Master gain applied on top of the distance ramp + the user's music
// slider, so the beacon never overwhelms dialogue / music.
const BASE_VOLUME = 0.32;

// Iso camera screen-X basis in world coordinates. The camera lives at
// (+x, +y, +z) and looks at the origin, so screen-right corresponds to
// world (cos45, 0, -cos45). Hardcoded since the camera's azimuth is
// fixed across the game.
const SCREEN_RIGHT_X = Math.SQRT1_2;
const SCREEN_RIGHT_Z = -Math.SQRT1_2;

type Props = {
  position: [number, number, number]; // digger world position (x, y, z)
  playerPosRef: MutableRefObject<THREE.Vector3>;
};

// Audio "breadcrumb" guiding the player toward the digger NPC. Plays a
// rhythmic shovel-on-dirt pulse synthesized from a low sine + filtered
// noise burst, panned + attenuated based on the player's screen-relative
// position to the digger. Goes silent once the player has the key (the
// digger no longer needs finding) or while a dialogue is open (so the
// pulse doesn't muddle conversations).
//
// All audio is built with the Web Audio API directly — no extra deps,
// no decoded buffers to fetch.
export default function DiggerBeacon({ position, playerPosRef }: Props) {
  const ctxRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const pannerRef = useRef<StereoPannerNode | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    // AudioContext + node graph: source(s) → panner → masterGain → out.
    // Per-thud sources are created on demand; the panner / gain stay
    // for the whole component lifetime.
    type AudioCtxCtor = typeof AudioContext;
    const Ctx: AudioCtxCtor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: AudioCtxCtor }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    ctxRef.current = ctx;

    const masterGain = ctx.createGain();
    masterGain.gain.value = 0;
    const panner = ctx.createStereoPanner();
    panner.pan.value = 0;
    panner.connect(masterGain).connect(ctx.destination);
    masterGainRef.current = masterGain;
    pannerRef.current = panner;

    // Browsers suspend the context until a user gesture. Start the
    // thud loop as soon as we can resume.
    let nextThudAt = 0;
    let raf = 0;
    const tickThuds = () => {
      const now = ctx.currentTime;
      if (ctx.state === 'running' && now >= nextThudAt) {
        scheduleThud(ctx, panner, now);
        nextThudAt = now + THUD_PERIOD;
      }
      raf = requestAnimationFrame(tickThuds);
    };
    raf = requestAnimationFrame(tickThuds);

    const tryResume = () => {
      ctx.resume().catch(() => {});
      startedRef.current = true;
    };
    // Try immediately; fall back to first-gesture if blocked.
    tryResume();
    const onFirst = () => {
      tryResume();
      window.removeEventListener('pointerdown', onFirst);
      window.removeEventListener('keydown', onFirst);
      window.removeEventListener('touchstart', onFirst);
    };
    window.addEventListener('pointerdown', onFirst, { once: true });
    window.addEventListener('keydown', onFirst, { once: true });
    window.addEventListener('touchstart', onFirst, { once: true });

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointerdown', onFirst);
      window.removeEventListener('keydown', onFirst);
      window.removeEventListener('touchstart', onFirst);
      try {
        masterGain.disconnect();
        panner.disconnect();
      } catch {
        /* noop */
      }
      ctx.close().catch(() => {});
      ctxRef.current = null;
      masterGainRef.current = null;
      pannerRef.current = null;
    };
  }, []);

  // Per-frame: re-aim the beacon toward the player. Volume falls off
  // with distance; pan reflects the digger's screen-relative direction.
  useFrame(() => {
    const masterGain = masterGainRef.current;
    const panner = pannerRef.current;
    const ctx = ctxRef.current;
    if (!masterGain || !panner || !ctx) return;

    const dx = position[0] - playerPosRef.current.x;
    const dz = position[2] - playerPosRef.current.z;
    const dist = Math.hypot(dx, dz);

    // Suppression: silent once the player already has the key or while
    // a dialogue is open. Smoothly via setTargetAtTime so we don't
    // click the audio when state flips.
    const hasKey = useGame.getState().hasKey;
    const inDialogue = useDialogue.getState().active;
    const musicVolume = useAudio.getState().musicVolume;

    let target = 0;
    if (!hasKey && !inDialogue) {
      // Quadratic falloff so the player feels the difference between
      // "warm" and "cold" rather than a flat plateau.
      const t = Math.max(0, 1 - dist / MAX_DISTANCE);
      target = t * t * BASE_VOLUME * musicVolume;
    }
    // 80 ms time constant — quick enough to follow the player but
    // slow enough to avoid zipper noise.
    masterGain.gain.setTargetAtTime(target, ctx.currentTime, 0.08);

    // Pan: project (digger - player) onto the iso camera's screen-X
    // axis. Clamp to [-1, 1]; soften the edges so the audio doesn't
    // hard-pan when the digger is exactly to the side.
    const pan = dx * SCREEN_RIGHT_X + dz * SCREEN_RIGHT_Z;
    const norm = Math.max(-1, Math.min(1, pan / Math.max(1, dist)));
    panner.pan.setTargetAtTime(norm * 0.85, ctx.currentTime, 0.08);
  });

  return null;
}

// Fires a single "thud" at startTime — a low sine wave with a sharp
// envelope plus a short noise burst layered on top to give the dig a
// gritty texture. All nodes are ephemeral; they're garbage-collected
// once the source's `ended` event fires.
function scheduleThud(
  ctx: AudioContext,
  destination: AudioNode,
  startTime: number,
) {
  const dur = 0.18;

  // -- Low sine "body" ------------------------------------------------
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  // Slight pitch variation each thud so successive hits don't feel
  // robotic.
  const freq = 70 + Math.random() * 30;
  osc.frequency.setValueAtTime(freq, startTime);
  // Pitch droops toward 50 Hz over the envelope, mimicking a soft
  // shovel impact.
  osc.frequency.exponentialRampToValueAtTime(50, startTime + dur);
  const oscGain = ctx.createGain();
  oscGain.gain.setValueAtTime(0, startTime);
  oscGain.gain.linearRampToValueAtTime(0.9, startTime + 0.005);
  oscGain.gain.exponentialRampToValueAtTime(0.001, startTime + dur);
  osc.connect(oscGain).connect(destination);
  osc.start(startTime);
  osc.stop(startTime + dur + 0.02);

  // -- Noise burst ----------------------------------------------------
  const noiseBuffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    // Decaying white noise — faster fall-off than the sine so the
    // burst reads as "click" then "thud body".
    const t = i / data.length;
    data[i] = (Math.random() * 2 - 1) * Math.exp(-t * 12);
  }
  const noiseSrc = ctx.createBufferSource();
  noiseSrc.buffer = noiseBuffer;
  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = 'bandpass';
  noiseFilter.frequency.value = 380;
  noiseFilter.Q.value = 1.2;
  const noiseGain = ctx.createGain();
  noiseGain.gain.value = 0.4;
  noiseSrc.connect(noiseFilter).connect(noiseGain).connect(destination);
  noiseSrc.start(startTime);
  noiseSrc.stop(startTime + dur);
}
