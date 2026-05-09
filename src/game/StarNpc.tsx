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
// Slight speed-up on gestures gives the standing pose a "digging" energy
// so the NPC reads as grooving while it talks.
const GESTURE_TIMESCALE = 1.15;

// The story shown when the player wakes the slumped wanderer.
const STORY: DialogueLine[] = [
  { text: 'hei velkommen til VITTA TIL IDA NEVERDAHL!' },
  { text: 'HER ER DET JÆVKIG GOD PLASS' },
  { text: 'IDA ER EN JÆVLA HORE' },
];

// 'standing' = the lively gesture cycle, started by the bow and looping
// forever afterwards. The NPC dances continuously while tracking the
// player's position.
type Phase = 'slumped' | 'rising' | 'standing';

type Props = {
  id: string;
  position: [number, number, number];
  playerPosRef: MutableRefObject<THREE.Vector3>;
};

export default function StarNpc({ id, position, playerPosRef }: Props) {
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

    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.log(
        '[StarNpc] clips:',
        byDur.map((c) => `${c.n}=${c.d.toFixed(2)}s`).join(', '),
        '→ slumped:', byDur[0]?.n, 'idle:', byDur[1]?.n,
        'gestureA:', byDur[2]?.n, 'gestureB:', byDur[3]?.n, 'rise:', byDur[4]?.n,
      );
    }

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
      // clamp=true holds the last frame at full weight so the cross-fade
      // into the next gesture never bottoms out into bind pose (T-pose).
      clips.gestureA.clampWhenFinished = true;
    }
    if (clips.gestureB) {
      clips.gestureB.setLoop(THREE.LoopOnce, 1);
      clips.gestureB.clampWhenFinished = true;
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
        // A → B (or back to A as a fallback so the cycle can never stall)
        const b = clips.gestureB ?? clips.gestureA ?? clips.idle;
        if (b) {
          b.setLoop(THREE.LoopOnce, 1);
          b.clampWhenFinished = true;
          b.timeScale = GESTURE_TIMESCALE;
          b.reset().fadeIn(FADE).play();
        }
        e.action.fadeOut(FADE);
      } else if (e.action === clips.gestureB) {
        // B → A
        const a = clips.gestureA ?? clips.gestureB ?? clips.idle;
        if (a) {
          a.setLoop(THREE.LoopOnce, 1);
          a.clampWhenFinished = true;
          a.timeScale = GESTURE_TIMESCALE;
          a.reset().fadeIn(FADE).play();
        }
        e.action.fadeOut(FADE);
      }
    };
    mixer.addEventListener('finished', onFinished as never);
    return () => mixer.removeEventListener('finished', onFinished as never);
  }, [clips, mixer]);

  // -- Trigger: player must "bow" (fire an emote) within range ----------
  // Subscribing to useEmote rather than checking proximity each frame
  // means the NPC stays slumped if you just walk by — you have to
  // intentionally greet them with the emote button / E / Space.
  useEffect(() => {
    let lastReq = useEmote.getState().requestId;
    const unsub = useEmote.subscribe((s) => {
      if (s.requestId === lastReq) return;
      lastReq = s.requestId;
      if (phaseRef.current !== 'slumped' || !clips) return;

      const g = group.current;
      if (!g) return;
      const dx = playerPosRef.current.x - g.position.x;
      const dz = playerPosRef.current.z - g.position.z;
      if (Math.hypot(dx, dz) >= TRIGGER_DISTANCE) return;

      // Wake up: cross-fade slumped → rise, start the story.
      clips.slumped?.fadeOut(FADE);
      if (clips.rise) clips.rise.reset().fadeIn(FADE).play();
      setPhase('rising');
      useDialogue.getState().start(STORY);

      // Smoothly turn to face the player as we stand.
      facingTargetYaw.current = Math.atan2(dx, dz) - Math.PI / 2;
    });
    return unsub;
  }, [clips, playerPosRef]);

  // -- Face the player + interaction proximity + safety net --------------
  const facingTargetYaw = useRef<number | null>(null);
  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;

    // Continuous tracking once the NPC is up. They keep dancing forever
    // and slowly turn to follow the player wherever they wander.
    if (phaseRef.current === 'standing') {
      const dx = playerPosRef.current.x - g.position.x;
      const dz = playerPosRef.current.z - g.position.z;
      facingTargetYaw.current = Math.atan2(dx, dz) - Math.PI / 2;
    }

    if (facingTargetYaw.current !== null) {
      const target = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 1, 0),
        facingTargetYaw.current,
      );
      g.quaternion.rotateTowards(target, dt * 4);
    }

    // Tell the HUD when the player is in range of the bow trigger.
    // Only relevant in slumped phase — the button is a one-shot wake.
    const dx = playerPosRef.current.x - g.position.x;
    const dz = playerPosRef.current.z - g.position.z;
    const inRange =
      phaseRef.current === 'slumped' && Math.hypot(dx, dz) < TRIGGER_DISTANCE;
    if (inRange) useInteraction.getState().claim(id);
    else useInteraction.getState().release(id);

    // Safety net: if no clip has any weight on the bones, the character
    // would render in bind pose (T-pose). Restart whatever pose belongs
    // to the current phase.
    if (clips) {
      const phase = phaseRef.current;
      const desired =
        phase === 'slumped'
          ? clips.slumped
          : phase === 'standing'
            ? clips.gestureA ?? clips.gestureB ?? clips.idle
            : null; // 'rising' is one-shot, leave alone
      if (desired && desired.getEffectiveWeight() < 0.01) {
        if (phase === 'standing') {
          desired.setLoop(THREE.LoopOnce, 1);
          desired.clampWhenFinished = true;
          desired.timeScale = GESTURE_TIMESCALE;
        } else {
          desired.setLoop(THREE.LoopRepeat, Infinity);
          desired.timeScale = 1.0;
        }
        desired.reset().fadeIn(FADE).play();
      }
    }
  });

  // Drop our claim on unmount so a future interactable can take over.
  useEffect(() => {
    return () => useInteraction.getState().release(id);
  }, [id]);

  // -- Foot lift so feet rest on y=0 in the slumped pose -----------------
  // Skinned-mesh bbox depends on the current pose; computing once on
  // first render gives us the slumped lift, which works for the rise
  // animation too because Tripo rigs author the hip translation in-clip.
  const [footLift, setFootLift] = useState(0);
  useEffect(() => {
    // Wait one frame so the mixer has applied the slumped pose to bones.
    const handle = requestAnimationFrame(() => {
      const inner = innerGroup.current;
      if (!inner) return;
      const box = new THREE.Box3().setFromObject(inner);
      // Convert world-y to local-y; inner group is at origin so they match.
      setFootLift(-box.min.y);
    });
    return () => cancelAnimationFrame(handle);
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
    <group ref={group} position={position}>
      <group ref={innerGroup} scale={SCALE} position-y={footLift}>
        <primitive object={scene} />
      </group>
    </group>
  );
}

useGLTF.preload(URL);
