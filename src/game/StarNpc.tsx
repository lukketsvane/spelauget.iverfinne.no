'use client';

import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, useAnimations } from '@react-three/drei';
import * as THREE from 'three';
import { useDialogue, type DialogueLine } from '@/store/dialogue';

const URL = '/models/stjernekarakter.glb';
const SPAWN_X = 5;
const SPAWN_Z = 5;
const TRIGGER_DISTANCE = 3.2;
const SCALE = 3.0;
const FADE = 0.25;
// Slight speed-up on gestures gives the standing pose a "digging" energy
// so the NPC reads as grooving while it talks.
const GESTURE_TIMESCALE = 1.15;

// The story shown when the player wakes the slumped wanderer.
const STORY: DialogueLine[] = [
  { speaker: 'Stjernevandreren', text: 'hei velkommen til VITTA TIL IDA NEVERDAHL!' },
  { speaker: 'Stjernevandreren', text: 'HER ER DET JÆVKIG GOD PLASS' },
  { speaker: 'Stjernevandreren', text: 'IDA ER EN JÆVLA HORE' },
];

type Phase = 'slumped' | 'rising' | 'standing';

type Props = { playerPosRef: MutableRefObject<THREE.Vector3> };

export default function StarNpc({ playerPosRef }: Props) {
  const group = useRef<THREE.Group>(null);
  const innerGroup = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF(URL);
  const { actions, names, mixer } = useAnimations(animations, group);

  const [phase, setPhase] = useState<Phase>('slumped');
  const phaseRef = useRef<Phase>('slumped');
  phaseRef.current = phase;

  // Map clips by duration. With 8 clips on this rig the unique two are
  // 16.38s (lying-down loop) and 3.88s (rise-up transition); the rest
  // mirror Sligo's locomotion + emote bank.
  const clips = useMemo(() => {
    if (!names.length) return null;
    const byDur = names
      .map((n) => ({ n, d: actions[n]?.getClip().duration ?? 0 }))
      .sort((a, b) => b.d - a.d);
    return {
      slumped: actions[byDur[0].n] ?? null, // 16.38 s
      idle: actions[byDur[1].n] ?? null, //    15.38 s
      gestureA: actions[byDur[2].n] ?? null, // 6.00 s
      gestureB: actions[byDur[3].n] ?? null, // 6.00 s
      rise: actions[byDur[4].n] ?? null, //     3.88 s
    };
  }, [actions, names]);

  // -- Initial state: slumped on loop ------------------------------------
  useEffect(() => {
    if (!clips) return;
    if (clips.slumped) {
      clips.slumped.setLoop(THREE.LoopRepeat, Infinity);
      clips.slumped.reset().fadeIn(FADE).play();
    }
    if (clips.rise) {
      clips.rise.setLoop(THREE.LoopOnce, 1);
      clips.rise.clampWhenFinished = true;
    }
    if (clips.gestureA) {
      clips.gestureA.setLoop(THREE.LoopOnce, 1);
      clips.gestureA.clampWhenFinished = false;
    }
    if (clips.gestureB) {
      clips.gestureB.setLoop(THREE.LoopOnce, 1);
      clips.gestureB.clampWhenFinished = false;
    }
    if (clips.idle) {
      clips.idle.setLoop(THREE.LoopRepeat, Infinity);
    }
  }, [clips]);

  // -- Mixer events: rise → first gesture; gestures cycle into the next --
  // The continuous gesture chain is what makes the standing pose look
  // "digging" — the NPC keeps moving instead of settling into static idle.
  useEffect(() => {
    const onFinished = (e: { action: THREE.AnimationAction }) => {
      if (!clips) return;
      if (e.action === clips.rise) {
        // Just stood up → kick into first dance gesture.
        const first = clips.gestureA ?? clips.gestureB ?? clips.idle;
        if (first) {
          first.timeScale = GESTURE_TIMESCALE;
          first.reset().fadeIn(FADE * 1.5).play();
        }
        e.action.fadeOut(FADE * 1.5);
        setPhase('standing');
      } else if (e.action === clips.gestureA) {
        // A → B
        const b = clips.gestureB ?? clips.idle;
        if (b) {
          b.timeScale = GESTURE_TIMESCALE;
          b.reset().fadeIn(FADE).play();
        }
        e.action.fadeOut(FADE);
      } else if (e.action === clips.gestureB) {
        // B → A
        const a = clips.gestureA ?? clips.idle;
        if (a) {
          a.timeScale = GESTURE_TIMESCALE;
          a.reset().fadeIn(FADE).play();
        }
        e.action.fadeOut(FADE);
      }
    };
    mixer.addEventListener('finished', onFinished as never);
    return () => mixer.removeEventListener('finished', onFinished as never);
  }, [clips, mixer]);

  // -- Trigger: detect player approach in slumped phase ------------------
  useFrame(() => {
    if (phaseRef.current !== 'slumped' || !clips) return;
    const g = group.current;
    if (!g) return;
    const dx = playerPosRef.current.x - g.position.x;
    const dz = playerPosRef.current.z - g.position.z;
    if (Math.hypot(dx, dz) < TRIGGER_DISTANCE) {
      // Wake up: cross-fade slumped → rise, start the story.
      clips.slumped?.fadeOut(FADE);
      if (clips.rise) clips.rise.reset().fadeIn(FADE).play();
      setPhase('rising');
      useDialogue.getState().start(STORY);

      // Smoothly turn to face the player as we stand.
      const targetYaw = Math.atan2(dx, dz) - Math.PI / 2; // -π/2 = +X-forward GLB
      facingTargetYaw.current = targetYaw;
    }
  });

  // -- Face the player while rising / standing ---------------------------
  const facingTargetYaw = useRef<number | null>(null);
  useFrame((_, dt) => {
    const g = group.current;
    if (!g || facingTargetYaw.current === null) return;
    const target = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 1, 0),
      facingTargetYaw.current,
    );
    g.quaternion.rotateTowards(target, dt * 4);
  });

  // -- Foot lift so feet rest on y=0 in the slumped pose -----------------
  // Skinned-mesh bbox depends on the current pose; computing once on
  // first render gives us the slumped lift, which works for the rise
  // animation too because Tripo rigs author the hip translation in-clip.
  const [footLift, setFootLift] = useState(0);
  useEffect(() => {
    // Wait one frame so the mixer has applied the slumped pose to bones.
    const id = requestAnimationFrame(() => {
      const inner = innerGroup.current;
      if (!inner) return;
      const box = new THREE.Box3().setFromObject(inner);
      // Convert world-y to local-y; inner group is at origin so they match.
      setFootLift(-box.min.y);
    });
    return () => cancelAnimationFrame(id);
  }, [scene]);

  // Shadow flags
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
    <group ref={group} position={[SPAWN_X, 0, SPAWN_Z]}>
      <group ref={innerGroup} scale={SCALE} position-y={footLift}>
        <primitive object={scene} />
      </group>
    </group>
  );
}

useGLTF.preload(URL);
