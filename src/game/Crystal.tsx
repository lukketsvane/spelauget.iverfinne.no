'use client';

import { useRef, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGame } from '@/store/game';
import { useToast } from '@/store/toast';

// Pickup radius — generous so the player only has to wander past,
// not bow at it. Crystals are passive collectables, not interactables.
const PICKUP_RADIUS = 2.6;
// Vertical hover height above ground.
const HOVER_Y = 1.4;

type Props = {
  id: string;
  position: [number, number, number];
  playerPosRef: MutableRefObject<THREE.Vector3>;
};

// Floating crystal pickup. Bobs up/down + slowly rotates so the
// silhouette catches the eye against the ground gradient. Walks
// straight into the player's `crystals` count + records the spawn id
// in `collectedItems` so it never re-renders on revisit, even after
// a Continue / reload.
//
// Skipped entirely (returns null) once collected — re-entering the
// region won't show the prop again.
export default function Crystal({ id, position, playerPosRef }: Props) {
  const groupRef = useRef<THREE.Group>(null);
  // We deliberately do NOT subscribe via useGame hook — that would
  // re-render every frame the store touches anything. Instead we
  // read it inside useFrame, and only "stop rendering" through the
  // collected-flip path which calls collectItem (a state set), and
  // we read the flag once to render.
  const collected = useGame((s) => s.collectedItems.includes(id));

  useFrame((state) => {
    if (collected) return;
    const g = groupRef.current;
    if (!g) return;

    const t = state.clock.elapsedTime;
    // Bob — phase offset by world position so adjacent crystals
    // don't bob in lockstep.
    const bob = Math.sin(t * 1.5 + position[0] * 0.3 + position[2] * 0.2) * 0.18;
    g.position.y = HOVER_Y + bob;
    // Slow rotation for sparkle.
    g.rotation.y = t * 0.6;
    g.rotation.x = Math.sin(t * 0.4) * 0.2;

    // Pickup check.
    const dx = playerPosRef.current.x - position[0];
    const dz = playerPosRef.current.z - position[2];
    if (Math.hypot(dx, dz) < PICKUP_RADIUS) {
      const game = useGame.getState();
      // Guard against double-pickup if the player oscillates around
      // the boundary while React batches updates.
      if (!game.collectedItems.includes(id)) {
        game.addCrystal();
        game.collectItem(id);
        useToast.getState().push('Crystal acquired', 'success');
      }
    }
  });

  if (collected) return null;

  return (
    <group ref={groupRef} position={[position[0], HOVER_Y, position[2]]}>
      <mesh castShadow>
        <octahedronGeometry args={[0.55, 0]} />
        <meshStandardMaterial
          color="#bbeefa"
          emissive="#5cc8e6"
          emissiveIntensity={1.6}
          toneMapped={false}
          metalness={0.4}
          roughness={0.15}
        />
      </mesh>
      {/* Soft halo via a slightly larger transparent shell. Reads
          as inner glow rather than a hard surface. */}
      <mesh>
        <octahedronGeometry args={[0.85, 0]} />
        <meshBasicMaterial
          color="#9be8fa"
          transparent
          opacity={0.18}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}
