'use client';

import { useEffect, useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

const URL = '/models/stone_hut.glb';

type Props = {
  position: [number, number, number];
  scale?: number;
  rotationY?: number;
};

// Static stone hut. The GLB is untextured (Tripo export with neutral
// baseColor) so we tint the material into the moody palette via a
// MeshLambertMaterial swap.
export default function StoneHut({ position, scale = 1.4, rotationY = 0 }: Props) {
  const { scene } = useGLTF(URL);

  const cloned = useMemo(() => {
    // Static (no skin) → regular clone is safe and gives us per-instance
    // materials we can tint without affecting other huts.
    const c = scene.clone(true);
    c.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        // Replace the GLB's bland baseColor material with a tinted
        // Lambert that reads as cool stone in the night palette.
        mesh.material = new THREE.MeshLambertMaterial({
          color: '#5e4d75',
          emissive: new THREE.Color('#1a1130'),
          emissiveIntensity: 0.4,
        });
      }
    });
    return c;
  }, [scene]);

  return (
    <group position={position} rotation={[0, rotationY, 0]} scale={scale}>
      <primitive object={cloned} />
    </group>
  );
}

useGLTF.preload(URL);
