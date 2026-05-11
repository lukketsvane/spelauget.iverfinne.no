'use client';

import { useRef, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGame } from '@/store/game';
import { useToast } from '@/store/toast';
import { getRegion, type RegionId } from './regions';

// Tighter pickup radius than Key/Crystal — the player has to walk
// almost on top of it. Artefacts are hidden by design.
const PICKUP_RADIUS = 1.6;
// Sits low to the ground, not floating dramatically.
const HOVER_Y = 0.55;

type Props = {
  id: string;
  position: [number, number, number];
  // Which world's artefact this is. Recorded into useGame.artifacts
  // verbatim — the senter ending reads this set as a 4-bit bitmask.
  region: RegionId;
  playerPosRef: MutableRefObject<THREE.Vector3>;
};

// Hidden, optional collectible. One per outer world (blod, geometri,
// siste, lysningen). Visually the OPPOSITE of Key: small, dim,
// near-ground, no halo, no spin — a half-buried thing the player
// notices only if they walk close enough. Reads as "you weren't
// supposed to see this, but you can take it if you want".
//
// On pickup: adds `region` to useGame.artifacts (idempotent), records
// the spawn id in collectedItems so it never re-renders, and toasts
// a deliberately vague message — the player shouldn't immediately
// know what they just took.
export default function Artifact({ id, position, region, playerPosRef }: Props) {
  const groupRef = useRef<THREE.Group>(null);
  const collected = useGame((s) => s.collectedItems.includes(id));

  useFrame((state) => {
    if (collected) return;
    const g = groupRef.current;
    if (!g) return;

    const t = state.clock.elapsedTime;
    // Much subtler bob than Key/Crystal — barely perceptible. Reads
    // as a small object resting on uneven ground rather than a
    // beckoning pickup.
    const bob = Math.sin(t * 0.6 + position[0] * 0.13) * 0.04;
    g.position.y = HOVER_Y + bob;
    // No spin — keep it visually still so it doesn't compete for
    // attention with crystals/keys nearby.

    // Pickup check.
    const dx = playerPosRef.current.x - position[0];
    const dz = playerPosRef.current.z - position[2];
    if (Math.hypot(dx, dz) < PICKUP_RADIUS) {
      const game = useGame.getState();
      if (!game.collectedItems.includes(id)) {
        game.addArtifact(region);
        game.collectItem(id);
        // Vague message — the player learns the artefact's identity
        // by piecing together the four they collected (or didn't).
        const r = getRegion(region);
        useToast.getState().push(`Something from ${r.name}`, 'success');
      }
    }
  });

  if (collected) return null;

  return (
    <group ref={groupRef} position={[position[0], HOVER_Y, position[2]]}>
      {/* A small dodecahedron — reads as a "polished stone" or
          "carved fragment" rather than a magical pickup. Dark base
          colour with a faint emissive hint so it's visible against
          dark ground but doesn't glow. */}
      <mesh castShadow>
        <dodecahedronGeometry args={[0.28, 0]} />
        <meshStandardMaterial
          color="#3a2a4e"
          emissive="#1a1228"
          emissiveIntensity={0.4}
          toneMapped={false}
          metalness={0.3}
          roughness={0.6}
        />
      </mesh>
      {/* No halo. The whole point is that artefacts don't broadcast. */}
    </group>
  );
}
