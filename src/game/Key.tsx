'use client';

import { useRef, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGame } from '@/store/game';
import { useToast } from '@/store/toast';
import { getRegion, type RegionId } from './regions';

// Pickup radius — generous so the player only has to wander past,
// not bow at it. Same reasoning as Crystal: passive collectables.
const PICKUP_RADIUS = 2.6;
// Hover height — slightly higher than crystals so a key reads as the
// "more important" pickup when the two are near each other.
const HOVER_Y = 1.7;

type Props = {
  id: string;
  position: [number, number, number];
  // RegionId of the portal this key unlocks. Recorded into
  // useGame.keys on pickup; consumed by Portal/CarPortal isUnlocked.
  opens: RegionId;
  playerPosRef: MutableRefObject<THREE.Vector3>;
};

// Floating portal-key pickup. Visually distinct from Crystal: a
// taller, brass-toned silhouette that reads as "important / take
// me". Bobs up/down + slowly spins so the silhouette catches the
// eye against any region's ground gradient. On pickup, adds `opens`
// to useGame.keys (idempotent), records the spawn id in
// collectedItems so it never re-renders, and toasts the destination
// region's name so the player gets a hint about what it unlocks.
export default function Key({ id, position, opens, playerPosRef }: Props) {
  const groupRef = useRef<THREE.Group>(null);
  // Same pattern as Crystal: read collected once for the early-out,
  // poll the store inside useFrame for the pickup check (avoids
  // re-rendering every frame).
  const collected = useGame((s) => s.collectedItems.includes(id));

  useFrame((state) => {
    if (collected) return;
    const g = groupRef.current;
    if (!g) return;

    const t = state.clock.elapsedTime;
    // Bob — phase offset by world position so adjacent keys don't
    // sync up.
    const bob = Math.sin(t * 1.3 + position[0] * 0.21 + position[2] * 0.17) * 0.22;
    g.position.y = HOVER_Y + bob;
    // Slow spin around vertical so the key's silhouette rotates and
    // catches all camera angles equally.
    g.rotation.y = t * 0.7;
    // Slight wobble around the forward axis so it doesn't look
    // mechanically rigid.
    g.rotation.z = Math.sin(t * 0.6) * 0.12;

    // Pickup check.
    const dx = playerPosRef.current.x - position[0];
    const dz = playerPosRef.current.z - position[2];
    if (Math.hypot(dx, dz) < PICKUP_RADIUS) {
      const game = useGame.getState();
      // Guard against double-pickup if the player oscillates around
      // the boundary while React batches updates.
      if (!game.collectedItems.includes(id)) {
        game.addKey(opens);
        game.collectItem(id);
        const region = getRegion(opens);
        useToast.getState().push(`Key acquired: ${region.name}`, 'success');
      }
    }
  });

  if (collected) return null;

  return (
    <group ref={groupRef} position={[position[0], HOVER_Y, position[2]]}>
      {/* Key shaft — a tall thin box */}
      <mesh castShadow position={[0, 0.05, 0]}>
        <boxGeometry args={[0.12, 0.95, 0.12]} />
        <meshStandardMaterial
          color="#f4c45a"
          emissive="#a87018"
          emissiveIntensity={0.9}
          toneMapped={false}
          metalness={0.7}
          roughness={0.25}
        />
      </mesh>
      {/* Key bow (the loop you grip) — a torus on top */}
      <mesh castShadow position={[0, 0.62, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.26, 0.08, 12, 24]} />
        <meshStandardMaterial
          color="#f4c45a"
          emissive="#a87018"
          emissiveIntensity={0.9}
          toneMapped={false}
          metalness={0.7}
          roughness={0.25}
        />
      </mesh>
      {/* Two key teeth at the bottom — small boxes off the side of the shaft */}
      <mesh castShadow position={[0.13, -0.32, 0]}>
        <boxGeometry args={[0.18, 0.1, 0.08]} />
        <meshStandardMaterial
          color="#f4c45a"
          emissive="#a87018"
          emissiveIntensity={0.9}
          toneMapped={false}
          metalness={0.7}
          roughness={0.25}
        />
      </mesh>
      <mesh castShadow position={[0.11, -0.5, 0]}>
        <boxGeometry args={[0.14, 0.1, 0.08]} />
        <meshStandardMaterial
          color="#f4c45a"
          emissive="#a87018"
          emissiveIntensity={0.9}
          toneMapped={false}
          metalness={0.7}
          roughness={0.25}
        />
      </mesh>
      {/* Soft halo via a slightly larger transparent shell. Reads as
          inner glow rather than a hard surface. Larger than Crystal's
          halo so the key reads as more important from far away. */}
      <mesh>
        <sphereGeometry args={[0.95, 16, 12]} />
        <meshBasicMaterial
          color="#fcdc8a"
          transparent
          opacity={0.16}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}
