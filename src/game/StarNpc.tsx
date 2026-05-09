'use client';

import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, useAnimations } from '@react-three/drei';
import * as THREE from 'three';
import { useDialogue, type DialogueLine } from '@/store/dialogue';
import { useEmote } from '@/store/emote';
import { useInteraction } from '@/store/interaction';

const URL = '/models/stjernekarakter.glb';
const TRIGGER_DISTANCE = 4.5;
const SCALE = 4.5;
const FADE = 0.25;
// Slight speed-up on gestures gives the standing pose a "digging" energy.
const GESTURE_TIMESCALE = 1.15;

type Props = {
  id: string;
  position: [number, number, number];
  dialogue: DialogueLine[];
  playerPosRef: MutableRefObject<THREE.Vector3>;
};

// Star NPC. Phases:
//   'dancing' — initial state. The two 6.00 s gestures are cycled
//      continuously so the character is digging when the player arrives.
//      The bow gesture starts dialogue but the dance keeps going while
//      the player reads through the lines.
//   'idle'    — after the player has talked to them once. Calm standing
//      idle (the 15.38 s clip on loop). Stays here forever; further
//      bows still trigger dialogue but no longer change the phase.
type Phase = 'dancing' | 'idle';

export default function StarNpc({ id, position, dialogue, playerPosRef }: Props) {
  const group = useRef<THREE.Group>(null);
  const innerGroup = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF(URL);
  const { actions, names, mixer } = useAnimations(animations, group);

  const phaseRef = useRef<Phase>('dancing');
  // Set when our bow triggers the dialogue, so we only transition to
  // idle when *our* conversation ends (not someone else's).
  const ourDialogue = useRef(false);

  // Heuristic clip mapping. The two 6.00 s clips are the dance gestures
  // we cycle; idle (15.38 s) is a fallback only. Console logs the
  // resolved mapping so a wrong assignment is easy to spot.
  const clips = useMemo(() => {
    if (!names.length) return null;
    const byDur = names
      .map((n) => ({ n, d: actions[n]?.getClip().duration ?? 0 }))
      .sort((a, b) => b.d - a.d);

    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.log(
        '[StarNpc] clips:',
        byDur.map((c) => `${c.n}=${c.d.toFixed(2)}s`).join(', '),
        '→ idle:', byDur[1]?.n,
        'gestureA:', byDur[2]?.n, 'gestureB:', byDur[3]?.n,
      );
    }

    return {
      idle: actions[byDur[1]?.n] ?? null, //    15.38 s
      gestureA: actions[byDur[2]?.n] ?? null, // 6.00 s
      gestureB: actions[byDur[3]?.n] ?? null, // 6.00 s
    };
  }, [actions, names]);

  // Configure all clips and start the dance the moment the rig loads.
  useEffect(() => {
    if (!clips) return;
    if (clips.gestureA) {
      clips.gestureA.setLoop(THREE.LoopOnce, 1);
      // clamp=true holds the last frame at full weight so the cross-fade
      // into the next gesture never bottoms out into bind pose (T-pose).
      clips.gestureA.clampWhenFinished = true;
      clips.gestureA.timeScale = GESTURE_TIMESCALE;
    }
    if (clips.gestureB) {
      clips.gestureB.setLoop(THREE.LoopOnce, 1);
      clips.gestureB.clampWhenFinished = true;
      clips.gestureB.timeScale = GESTURE_TIMESCALE;
    }
    if (clips.idle) clips.idle.setLoop(THREE.LoopRepeat, Infinity);

    const first = clips.gestureA ?? clips.gestureB ?? clips.idle;
    if (first) first.reset().fadeIn(FADE).play();
  }, [clips]);

  // Cycle gestureA ↔ gestureB on `finished` so the dance is unbroken
  // — but only while we're in the dancing phase.
  useEffect(() => {
    const onFinished = (e: { action: THREE.AnimationAction }) => {
      if (!clips) return;
      if (phaseRef.current === 'idle') return;
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

  // Bow trigger: starts the inline dialogue when the player emotes
  // within range. We mark ourselves as the source so the dialogue-end
  // listener below knows whose conversation just finished.
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
    });
    return unsub;
  }, [playerPosRef, dialogue]);

  // When *our* dialogue ends, transition from the dance into a calm
  // standing idle. From then on the NPC stays in idle even if the
  // player triggers further conversations — they've already been met.
  useEffect(() => {
    let wasActive = useDialogue.getState().active;
    const unsub = useDialogue.subscribe((s) => {
      if (s.active === wasActive) return;
      wasActive = s.active;
      if (s.active) return;
      if (!ourDialogue.current) return;
      ourDialogue.current = false;
      if (phaseRef.current === 'idle' || !clips) return;
      // Cross-fade gestures out, idle in.
      clips.gestureA?.fadeOut(FADE * 2);
      clips.gestureB?.fadeOut(FADE * 2);
      const idle = clips.idle;
      if (idle) {
        idle.setLoop(THREE.LoopRepeat, Infinity);
        idle.timeScale = 1;
        idle.reset().fadeIn(FADE * 2).play();
      }
      phaseRef.current = 'idle';
    });
    return unsub;
  }, [clips]);

  // Continuous tracking + interaction claim + T-pose safety net.
  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;

    const dx = playerPosRef.current.x - g.position.x;
    const dz = playerPosRef.current.z - g.position.z;
    const dist = Math.hypot(dx, dz);

    // Always face the player while dancing.
    const target = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 1, 0),
      Math.atan2(dx, dz) - Math.PI / 2,
    );
    g.quaternion.rotateTowards(target, dt * 4);

    // Interaction availability for the HUD button.
    if (dist < TRIGGER_DISTANCE) useInteraction.getState().claim(id);
    else useInteraction.getState().release(id);

    // Safety net: ensure something is always driving the bones. The
    // expected clip depends on the current phase.
    if (clips) {
      const inIdle = phaseRef.current === 'idle';
      const desired = inIdle
        ? clips.idle ?? clips.gestureA
        : clips.gestureA ?? clips.gestureB ?? clips.idle;
      if (desired && desired.getEffectiveWeight() < 0.01) {
        if (inIdle) {
          desired.setLoop(THREE.LoopRepeat, Infinity);
          desired.timeScale = 1;
        } else {
          desired.setLoop(THREE.LoopOnce, 1);
          desired.clampWhenFinished = true;
          desired.timeScale = GESTURE_TIMESCALE;
        }
        desired.reset().fadeIn(FADE).play();
      }
    }
  });

  useEffect(() => {
    return () => useInteraction.getState().release(id);
  }, [id]);

  // Foot lift so feet rest on y=0. Computed one frame after mount so
  // the mixer has applied a gesture pose before we measure.
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
