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

// Always-dancing star NPC. The two 6.00 s gesture clips are cycled
// continuously — A → B → A → … — from the moment the model loads, so
// the character is "digging" when the player arrives. The bow gesture
// no longer toggles state, it just kicks off the inline dialogue.
export default function StarNpc({ id, position, dialogue, playerPosRef }: Props) {
  const group = useRef<THREE.Group>(null);
  const innerGroup = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF(URL);
  const { actions, names, mixer } = useAnimations(animations, group);

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

  // Cycle gestureA ↔ gestureB on `finished` so the dance is unbroken.
  useEffect(() => {
    const onFinished = (e: { action: THREE.AnimationAction }) => {
      if (!clips) return;
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
  // within range. No state machine — the dance keeps going regardless.
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
      useDialogue.getState().start(dialogue);
    });
    return unsub;
  }, [playerPosRef, dialogue]);

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

    // Safety net: ensure something is always driving the bones.
    if (clips) {
      const desired = clips.gestureA ?? clips.gestureB ?? clips.idle;
      if (desired && desired.getEffectiveWeight() < 0.01) {
        desired.setLoop(THREE.LoopOnce, 1);
        desired.clampWhenFinished = true;
        desired.timeScale = GESTURE_TIMESCALE;
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
