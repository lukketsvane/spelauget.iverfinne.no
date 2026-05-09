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
const SCALE = 3.5;
const FADE = 0.25;

type Props = {
  id: string;
  position: [number, number, number];
  dialogue: DialogueLine[];
  playerPosRef: MutableRefObject<THREE.Vector3>;
};

// Calmer NPC than StarNpc — no slumped/rise state machine. Just plays
// the longest available animation as a calm idle, faces the player when
// nearby, and starts the inline dialogue when the player bows.
export default function BobleNpc({ id, position, dialogue, playerPosRef }: Props) {
  const group = useRef<THREE.Group>(null);
  const innerGroup = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF(URL);
  const { actions, names } = useAnimations(animations, group);

  const idleClip = useMemo(() => {
    if (!names.length) return null;
    const sorted = names
      .map((n) => ({ n, d: actions[n]?.getClip().duration ?? 0 }))
      .sort((a, b) => b.d - a.d);
    return actions[sorted[0]?.n] ?? null;
  }, [actions, names]);

  // Start playing the idle on mount.
  useEffect(() => {
    if (!idleClip) return;
    idleClip.setLoop(THREE.LoopRepeat, Infinity);
    idleClip.reset().fadeIn(FADE).play();
    return () => {
      idleClip.fadeOut(FADE);
    };
  }, [idleClip]);

  // Bow trigger: start dialogue when player emotes within range.
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

  // Continuous tracking: face the player; claim/release interaction slot.
  const facingYaw = useRef(0);
  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    const dx = playerPosRef.current.x - g.position.x;
    const dz = playerPosRef.current.z - g.position.z;

    facingYaw.current = Math.atan2(dx, dz) - Math.PI / 2;
    const target = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 1, 0),
      facingYaw.current,
    );
    g.quaternion.rotateTowards(target, dt * 3);

    const inRange = Math.hypot(dx, dz) < TRIGGER_DISTANCE;
    if (inRange) useInteraction.getState().claim(id);
    else useInteraction.getState().release(id);
  });

  // Drop interaction claim on unmount (level change, hot reload, etc.).
  useEffect(() => {
    return () => useInteraction.getState().release(id);
  }, [id]);

  // Foot lift so feet rest on y=0. Computed one frame after mount so the
  // mixer has had a chance to apply the idle pose to the bones.
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
