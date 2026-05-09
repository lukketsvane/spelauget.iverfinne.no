'use client';

import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, useAnimations } from '@react-three/drei';
import * as THREE from 'three';
import { useDialogue, type DialogueLine } from '@/store/dialogue';
import { useEmote } from '@/store/emote';
import { useInteraction } from '@/store/interaction';

const URL = '/models/boblehovud.glb';
const TRIGGER_DISTANCE = 4.0;
// If the player wanders past this distance during dialogue, the
// conversation is auto-cancelled.
const CANCEL_DISTANCE = 8.0;
const SCALE = 3.5;
const FADE = 0.25;
// Bobble has no legs — stays close behind the player rather than
// trying to walk on its own. Drift speed deliberately calmer than the
// player's walk so they don't lap him.
const FOLLOW_DISTANCE = 3.5;
const FOLLOW_SPEED = 1.6;
// Slight speed-up on talking gestures so bobble feels animated, not
// just a head bobbing in place.
const GESTURE_TIMESCALE = 1.05;

type Props = {
  id: string;
  position: [number, number, number];
  dialogue: DialogueLine[];
  playerPosRef: MutableRefObject<THREE.Vector3>;
};

// Bobble — calmer NPC than StarNpc. Plays the longest clip on a loop
// as ambient idle. While in dialogue, cycles two medium "gesture" clips
// for a talking-head feel. After our dialogue ends, drifts after the
// player keeping FOLLOW_DISTANCE m behind.
export default function BobleNpc({ id, position, dialogue, playerPosRef }: Props) {
  const group = useRef<THREE.Group>(null);
  const innerGroup = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF(URL);
  const { actions, mixer } = useAnimations(animations, group);

  // Map clips by duration. Reading directly from `animations` so we
  // don't hit the drei lazy-init zero-duration trap.
  //   longest    → idle (ambient float / sway)
  //   ~6.00 s ×2 → gestureA / gestureB (talking poses)
  const clips = useMemo(() => {
    if (animations.length === 0) return null;
    const sorted = [...animations].sort((a, b) => b.duration - a.duration);
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.log(
        '[BobleNpc] clips:',
        sorted.map((c) => `${c.name}=${c.duration.toFixed(2)}s`).join(', '),
      );
    }
    // Pick gestures from the medium-length cluster (skip the long
    // idles, skip the very short walk/run/turn clips).
    const gestures = sorted.filter((c) => c.duration >= 4 && c.duration <= 8);
    return {
      idle: actions[sorted[0]?.name] ?? null,
      gestureA: gestures[0] ? actions[gestures[0].name] ?? null : null,
      gestureB: gestures[1] ? actions[gestures[1].name] ?? null : null,
    };
  }, [animations, actions]);

  // Encounter state machine (animation only — follow logic is separate).
  type Phase = 'idle' | 'talking';
  const phaseRef = useRef<Phase>('idle');
  const ourDialogue = useRef(false);
  const followingRef = useRef(false);

  // Mount: configure clips and start the idle loop.
  useEffect(() => {
    if (!clips) return;
    if (clips.idle) clips.idle.setLoop(THREE.LoopRepeat, Infinity);
    for (const g of [clips.gestureA, clips.gestureB]) {
      if (g) {
        g.setLoop(THREE.LoopOnce, 1);
        g.clampWhenFinished = true;
        g.timeScale = GESTURE_TIMESCALE;
      }
    }
    clips.idle?.reset().fadeIn(FADE).play();
    return () => {
      clips.idle?.fadeOut(FADE);
    };
  }, [clips]);

  // While talking, cycle gestureA ↔ gestureB on the mixer's `finished`
  // event so Bobble keeps gesturing through the conversation.
  useEffect(() => {
    const onFinished = (e: { action: THREE.AnimationAction }) => {
      if (!clips) return;
      if (phaseRef.current !== 'talking') return;
      const next =
        e.action === clips.gestureA
          ? clips.gestureB ?? clips.gestureA ?? clips.idle
          : e.action === clips.gestureB
            ? clips.gestureA ?? clips.gestureB ?? clips.idle
            : null;
      if (!next) return;
      next.setLoop(THREE.LoopOnce, 1);
      next.clampWhenFinished = true;
      next.timeScale = GESTURE_TIMESCALE;
      next.reset().fadeIn(FADE).play();
      e.action.fadeOut(FADE);
    };
    mixer.addEventListener('finished', onFinished as never);
    return () => mixer.removeEventListener('finished', onFinished as never);
  }, [clips, mixer]);

  // Bow trigger: open dialogue and switch to gesture cycle.
  useEffect(() => {
    let lastReq = useEmote.getState().requestId;
    const unsub = useEmote.subscribe((s) => {
      if (s.requestId === lastReq) return;
      lastReq = s.requestId;
      const g = group.current;
      if (!g) return;
      const dx = playerPosRef.current.x - g.position.x;
      const dz = playerPosRef.current.z - g.position.z;
      if (Math.hypot(dx, dz) >= TRIGGER_DISTANCE) return;

      ourDialogue.current = true;
      useDialogue.getState().start(dialogue);

      // Switch into talking phase: fade idle out, kick off gesture A.
      if (clips && phaseRef.current === 'idle') {
        const first = clips.gestureA ?? clips.gestureB;
        if (first) {
          clips.idle?.fadeOut(FADE);
          first.reset().fadeIn(FADE).play();
          phaseRef.current = 'talking';
        }
      }
    });
    return unsub;
  }, [clips, playerPosRef, dialogue]);

  // When *our* dialogue ends, fade gestures out, return to idle, and
  // start the follow drift.
  useEffect(() => {
    let wasActive = useDialogue.getState().active;
    return useDialogue.subscribe((s) => {
      if (s.active === wasActive) return;
      wasActive = s.active;
      if (s.active) return;
      if (!ourDialogue.current) return;
      ourDialogue.current = false;
      followingRef.current = true;
      if (clips) {
        clips.gestureA?.fadeOut(FADE * 1.5);
        clips.gestureB?.fadeOut(FADE * 1.5);
        clips.idle?.reset().fadeIn(FADE * 1.5).play();
      }
      phaseRef.current = 'idle';
    });
  }, [clips]);

  // Per-frame: face player, claim slot, drift after player when following.
  const facingYaw = useRef(0);
  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    const dx = playerPosRef.current.x - g.position.x;
    const dz = playerPosRef.current.z - g.position.z;
    const dist = Math.hypot(dx, dz);

    if (followingRef.current && dist > FOLLOW_DISTANCE) {
      const step = Math.min(FOLLOW_SPEED * dt, dist - FOLLOW_DISTANCE);
      g.position.x += (dx / dist) * step;
      g.position.z += (dz / dist) * step;
    }

    facingYaw.current = Math.atan2(dx, dz) - Math.PI / 2;
    const target = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 1, 0),
      facingYaw.current,
    );
    g.quaternion.rotateTowards(target, dt * 3);

    if (dist < TRIGGER_DISTANCE) useInteraction.getState().claim(id);
    else useInteraction.getState().release(id);

    // Cancel our active dialogue if the player wanders out of range.
    if (
      ourDialogue.current &&
      useDialogue.getState().active &&
      dist > CANCEL_DISTANCE
    ) {
      useDialogue.getState().close();
    }

    // Safety: if no clip is driving the bones (paused tab etc.), restart
    // the active phase's primary clip so we never sit at bind pose.
    if (clips) {
      const desired =
        phaseRef.current === 'talking'
          ? clips.gestureA ?? clips.gestureB ?? clips.idle
          : clips.idle;
      if (desired && desired.getEffectiveWeight() < 0.01) {
        if (phaseRef.current === 'talking') {
          desired.setLoop(THREE.LoopOnce, 1);
          desired.clampWhenFinished = true;
          desired.timeScale = GESTURE_TIMESCALE;
        } else {
          desired.setLoop(THREE.LoopRepeat, Infinity);
          desired.timeScale = 1;
        }
        desired.reset().fadeIn(FADE).play();
      }
    }
  });

  useEffect(() => {
    return () => useInteraction.getState().release(id);
  }, [id]);

  // Foot lift so feet rest on y=0.
  const [footLift, setFootLift] = useState(0);
  useEffect(() => {
    const handle = requestAnimationFrame(() => {
      const inner = innerGroup.current;
      if (!inner) return;
      const box = new THREE.Box3().setFromObject(inner);
      setFootLift(-box.min.y);
    });
    return () => cancelAnimationFrame(handle);
  }, [scene]);

  useEffect(() => {
    scene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const m = obj as THREE.Mesh;
        m.castShadow = true;
        m.receiveShadow = false;
        m.frustumCulled = false;
      }
    });
  }, [scene]);

  return (
    <group ref={group} position={position}>
      <group ref={innerGroup} scale={SCALE} position-y={footLift}>
        <primitive object={scene} />
      </group>
    </group>
  );
}

useGLTF.preload(URL);
