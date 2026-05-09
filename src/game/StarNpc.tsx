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

type Props = {
  id: string;
  position: [number, number, number];
  dialogue: DialogueLine[];
  playerPosRef: MutableRefObject<THREE.Vector3>;
};

// Star NPC. Three phases:
//   'digging' — initial. Plays the 16.38 s lying-down dig loop. The
//     character stays here while the conversation is going so dialogue
//     happens AS they're digging in the dirt.
//   'rising'  — one-shot 3.88 s transition from lying to standing.
//     Triggered when our dialogue ends.
//   'idle'    — final calm standing idle on the 15.38 s loop. Stays
//     here forever; further bows still play dialogue but the digging
//     pose is gone for good.
type Phase = 'digging' | 'rising' | 'idle';

export default function StarNpc({ id, position, dialogue, playerPosRef }: Props) {
  const group = useRef<THREE.Group>(null);
  const innerGroup = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF(URL);
  const { actions, names, mixer } = useAnimations(animations, group);

  const phaseRef = useRef<Phase>('digging');
  // Set when *our* bow triggered the dialogue, so we only transition
  // out of digging when our own conversation ends.
  const ourDialogue = useRef(false);

  // Heuristic mapping by clip duration.
  //   16.38 s = digging (lying-down loop)
  //   15.38 s = idle    (standing loop)
  //   3.88 s  = rise    (transition, one-shot)
  // The two 6.00 s gestures and the shorter walk/run/emote clips on
  // the rig aren't currently used for this NPC.
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
        '→ digging:', byDur[0]?.n,
        'idle:', byDur[1]?.n,
        'rise:', byDur[4]?.n,
      );
    }

    return {
      digging: actions[byDur[0]?.n] ?? null, // 16.38 s
      idle: actions[byDur[1]?.n] ?? null, //    15.38 s
      rise: actions[byDur[4]?.n] ?? null, //     3.88 s
    };
  }, [actions, names]);

  // Configure clips and start the digging loop on mount.
  useEffect(() => {
    if (!clips) return;
    if (clips.digging) clips.digging.setLoop(THREE.LoopRepeat, Infinity);
    if (clips.idle) clips.idle.setLoop(THREE.LoopRepeat, Infinity);
    if (clips.rise) {
      clips.rise.setLoop(THREE.LoopOnce, 1);
      clips.rise.clampWhenFinished = true;
    }
    clips.digging?.reset().fadeIn(FADE).play();
  }, [clips]);

  // After rise finishes, settle into idle.
  useEffect(() => {
    const onFinished = (e: { action: THREE.AnimationAction }) => {
      if (!clips) return;
      if (e.action === clips.rise) {
        const idle = clips.idle;
        if (idle) {
          idle.setLoop(THREE.LoopRepeat, Infinity);
          idle.timeScale = 1;
          idle.reset().fadeIn(FADE * 1.5).play();
        }
        e.action.fadeOut(FADE * 1.5);
        phaseRef.current = 'idle';
      }
    };
    mixer.addEventListener('finished', onFinished as never);
    return () => mixer.removeEventListener('finished', onFinished as never);
  }, [clips, mixer]);

  // Bow trigger: opens dialogue when the player emotes within range.
  // The phase doesn't change here — the character keeps digging until
  // *after* the conversation ends.
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

  // When *our* dialogue ends, fade digging out and play the rise; the
  // mixer-finished handler above will then settle into idle.
  useEffect(() => {
    let wasActive = useDialogue.getState().active;
    const unsub = useDialogue.subscribe((s) => {
      if (s.active === wasActive) return;
      wasActive = s.active;
      if (s.active) return;
      if (!ourDialogue.current) return;
      ourDialogue.current = false;
      if (phaseRef.current !== 'digging' || !clips) return;
      clips.digging?.fadeOut(FADE * 1.5);
      const rise = clips.rise;
      if (rise) {
        rise.setLoop(THREE.LoopOnce, 1);
        rise.clampWhenFinished = true;
        rise.reset().fadeIn(FADE).play();
        phaseRef.current = 'rising';
      } else if (clips.idle) {
        // No rise clip available — go straight to idle.
        clips.idle.reset().fadeIn(FADE * 1.5).play();
        phaseRef.current = 'idle';
      }
    });
    return unsub;
  }, [clips]);

  // Continuous interaction-claim + safety net + (only after rising)
  // gentle player-tracking yaw.
  const facingTargetYaw = useRef<number | null>(null);
  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;

    const dx = playerPosRef.current.x - g.position.x;
    const dz = playerPosRef.current.z - g.position.z;
    const dist = Math.hypot(dx, dz);

    // Only the standing idle tracks the player. While digging the
    // character is face-down on the ground — rotating it would look
    // wrong, so we skip the yaw update.
    if (phaseRef.current === 'idle') {
      facingTargetYaw.current = Math.atan2(dx, dz) - Math.PI / 2;
    }
    if (facingTargetYaw.current !== null) {
      const target = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 1, 0),
        facingTargetYaw.current,
      );
      g.quaternion.rotateTowards(target, dt * 4);
    }

    if (dist < TRIGGER_DISTANCE) useInteraction.getState().claim(id);
    else useInteraction.getState().release(id);

    // Safety net: if the active phase's clip has zero weight (paused
    // tab, missed event, etc.), restart it so we can never sit in
    // bind-pose / T-pose.
    if (clips) {
      const phase = phaseRef.current;
      const desired =
        phase === 'digging'
          ? clips.digging
          : phase === 'idle'
            ? clips.idle
            : null;
      if (desired && desired.getEffectiveWeight() < 0.01) {
        desired.setLoop(THREE.LoopRepeat, Infinity);
        desired.timeScale = 1;
        desired.reset().fadeIn(FADE).play();
      }
    }
  });

  useEffect(() => {
    return () => useInteraction.getState().release(id);
  }, [id]);

  // Foot lift in the digging pose so the body rests on y = 0.
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
