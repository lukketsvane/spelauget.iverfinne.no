'use client';

import { useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { useEmote } from '@/store/emote';
import { useGame } from '@/store/game';
import { useInteraction } from '@/store/interaction';
import { useLevel } from '@/store/level';
import { registerMeshCollider } from '@/store/collision';
import type { RegionId } from './regions';

const URL = '/models/car_01.glb';
// Distance from the car within which a bow gesture triggers the
// teleport. Slightly larger than the digger / bobble triggers — the
// car's footprint is bigger and the player should feel like they can
// reach it from anywhere they can read it on screen.
const TRIGGER_DISTANCE = 4.0;

type Gate = 'bobbleVanished' | 'hasKey';

type Props = {
  id: string;
  position: [number, number, number];
  scale?: number;
  rotationY?: number;
  targetRegion: RegionId;
  // Game flag that must be true before interaction unlocks. Until then
  // the car is just a collidable static prop.
  gate: Gate;
  playerPosRef: MutableRefObject<THREE.Vector3>;
};

// Car that doubles as a teleporter. Renders the same GLB as the static
// Car prop but, once `gate` is satisfied, claims the interaction slot
// when the player is in range and triggers a cinematic teleport on
// bow.
//
// The "locked" car (gate not yet satisfied) is identical to the static
// Car: solid collider, no interaction. This way the player can see the
// car from afar before they have a reason to look inside.
export default function CarPortal({
  id,
  position,
  scale = 1,
  rotationY = 0,
  targetRegion,
  gate,
  playerPosRef,
}: Props) {
  const { scene } = useGLTF(URL);
  const groupRef = useRef<THREE.Group>(null);

  const cloned = useMemo(() => {
    const c = scene.clone(true);
    c.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });
    return c;
  }, [scene]);

  // Mesh-derived OBB collider, like the regular Car.
  useEffect(() => {
    const g = groupRef.current;
    if (!g) return;
    return registerMeshCollider(id, g, rotationY, 'box');
  }, [id, position, scale, rotationY, cloned]);

  // Read the gate flag every frame — claims slot only once unlocked.
  useFrame(() => {
    const g = groupRef.current;
    if (!g) return;
    const dx = playerPosRef.current.x - g.position.x;
    const dz = playerPosRef.current.z - g.position.z;
    const inRange = Math.hypot(dx, dz) < TRIGGER_DISTANCE;
    const unlocked = isUnlocked(gate);
    if (inRange && unlocked) useInteraction.getState().claim(id);
    else useInteraction.getState().release(id);
  });

  // Bow trigger: teleport once unlocked + in range.
  useEffect(() => {
    let lastReq = useEmote.getState().requestId;
    const unsub = useEmote.subscribe((s) => {
      if (s.requestId === lastReq) return;
      lastReq = s.requestId;
      if (!isUnlocked(gate)) return;
      if (useLevel.getState().transitionPhase !== 'idle') return;
      const g = groupRef.current;
      if (!g) return;
      const dx = playerPosRef.current.x - g.position.x;
      const dz = playerPosRef.current.z - g.position.z;
      if (Math.hypot(dx, dz) >= TRIGGER_DISTANCE) return;
      useLevel.getState().travel(targetRegion);
    });
    return unsub;
  }, [gate, targetRegion, playerPosRef]);

  useEffect(() => {
    return () => useInteraction.getState().release(id);
  }, [id]);

  return (
    <group
      ref={groupRef}
      position={position}
      rotation={[0, rotationY, 0]}
      scale={scale}
    >
      <primitive object={cloned} />
    </group>
  );
}

function isUnlocked(gate: Gate): boolean {
  const g = useGame.getState();
  return gate === 'bobbleVanished' ? g.bobbleVanished : g.hasKey;
}

useGLTF.preload(URL);
