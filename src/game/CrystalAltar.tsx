'use client';

import { useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { useDialogue } from '@/store/dialogue';
import { useEmote } from '@/store/emote';
import { useGame } from '@/store/game';
import { useInteraction } from '@/store/interaction';
import { useToast } from '@/store/toast';
import { registerMeshCollider } from '@/store/collision';

const URL = '/models/purple_stone_cairn.glb';
const TRIGGER_DISTANCE = 4.2;
// XP awarded per crystal consumed at this altar. Tuned to push the
// player visibly along the XP bar so the reward feels tangible.
const XP_PER_CRYSTAL = 25;

type Props = {
  id: string;
  position: [number, number, number];
  playerPosRef: MutableRefObject<THREE.Vector3>;
  scale?: number;
  rotationY?: number;
};

// Cairn-altar that consumes a crystal + grants XP on bow. One-shot
// per altar (tracked via `useGame.activatedAltars`); after activation
// the floating crystal vanishes and the altar no longer claims the
// interaction slot.
//
// Plumbing mirrors Portal / CarPortal: emote subscriber + range +
// dialogue + transition guards. The interaction button only
// surfaces when the player both has a crystal AND is in range, so
// the spiral icon doubles as a "you can spend a crystal here" hint.
export default function CrystalAltar({
  id,
  position,
  playerPosRef,
  scale = 1.6,
  rotationY = 0,
}: Props) {
  const { scene } = useGLTF(URL);
  const groupRef = useRef<THREE.Group>(null);
  const crystalRef = useRef<THREE.Group>(null);
  const activated = useGame((s) => s.activatedAltars.includes(id));

  const cloned = useMemo(() => {
    const c = scene.clone(true);
    const mat = new THREE.MeshLambertMaterial({
      color: '#5e4d75',
      emissive: new THREE.Color('#1a1130'),
      emissiveIntensity: 0.4,
    });
    c.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.material = mat;
      }
    });
    return c;
  }, [scene]);

  // Mesh-derived collider, like the static cairns.
  useEffect(() => {
    const g = groupRef.current;
    if (!g) return;
    return registerMeshCollider(id, g, rotationY, 'circle', { inflate: 0.85 });
  }, [id, position, scale, rotationY, cloned]);

  // Per-frame: bob the floating crystal + claim the interaction
  // slot when the player has a crystal and is in range.
  useFrame((state) => {
    const c = crystalRef.current;
    if (c && !activated) {
      const t = state.clock.elapsedTime;
      c.position.y = 4.2 + Math.sin(t * 1.2) * 0.22;
      c.rotation.y = t * 0.55;
      c.rotation.x = Math.sin(t * 0.4) * 0.18;
    }

    if (activated) {
      useInteraction.getState().release(id);
      return;
    }
    const dx = playerPosRef.current.x - position[0];
    const dz = playerPosRef.current.z - position[2];
    const inRange = Math.hypot(dx, dz) < TRIGGER_DISTANCE;
    const hasCrystal = useGame.getState().crystals > 0;
    if (inRange && hasCrystal) useInteraction.getState().claim(id);
    else useInteraction.getState().release(id);
  });

  // Bow trigger.
  useEffect(() => {
    let lastReq = useEmote.getState().requestId;
    const unsub = useEmote.subscribe((s) => {
      if (s.requestId === lastReq) return;
      lastReq = s.requestId;
      if (useDialogue.getState().active) return;
      const game = useGame.getState();
      if (game.activatedAltars.includes(id)) return;
      if (game.crystals <= 0) return;
      const dx = playerPosRef.current.x - position[0];
      const dz = playerPosRef.current.z - position[2];
      if (Math.hypot(dx, dz) >= TRIGGER_DISTANCE) return;

      // Activate.
      const consumed = game.useCrystal();
      if (!consumed) return;
      game.activateAltar(id);
      game.addXp(XP_PER_CRYSTAL);
      useToast.getState().push(`+${XP_PER_CRYSTAL} XP — the altar drinks the crystal`, 'success');
    });
    return unsub;
  }, [id, position, playerPosRef]);

  useEffect(() => {
    return () => useInteraction.getState().release(id);
  }, [id]);

  return (
    <group ref={groupRef} position={position} rotation={[0, rotationY, 0]}>
      <group scale={scale}>
        <primitive object={cloned} />
      </group>
      {/* Floating crystal hovering above the cairn — vanishes once
          the altar has been activated. */}
      {!activated && (
        <group ref={crystalRef} position={[0, 4.2, 0]}>
          <mesh castShadow>
            <octahedronGeometry args={[0.7, 0]} />
            <meshStandardMaterial
              color="#bbeefa"
              emissive="#5cc8e6"
              emissiveIntensity={2.2}
              toneMapped={false}
              metalness={0.4}
              roughness={0.15}
            />
          </mesh>
          {/* Halo. */}
          <mesh>
            <octahedronGeometry args={[1.05, 0]} />
            <meshBasicMaterial
              color="#9be8fa"
              transparent
              opacity={0.2}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
        </group>
      )}
    </group>
  );
}

useGLTF.preload(URL);
