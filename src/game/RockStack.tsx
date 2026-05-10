'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { registerMeshCollider } from '@/store/collision';

const URL = '/models/rock_stack.glb';

type Props = {
  id: string;
  position: [number, number, number];
  scale?: number;
  rotationY?: number;
};

// Stack of irregular rocks. The footprint is roughly round so a
// circle collider matches it about as well as anything; the radius
// comes from the actual mesh bounds rather than a fixed constant.
export default function RockStack({ id, position, scale = 1, rotationY = 0 }: Props) {
  const { scene } = useGLTF(URL);
  const groupRef = useRef<THREE.Group>(null);

  const cloned = useMemo(() => {
    const c = scene.clone(true);
    const mat = new THREE.MeshLambertMaterial({
      color: '#6b5a85',
      emissive: new THREE.Color('#1a1130'),
      emissiveIntensity: 0.35,
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

  useEffect(() => {
    const g = groupRef.current;
    if (!g) return;
    // Slight inflate so the collider feels firm against the player
    // rather than letting them clip the rough silhouette by a sliver.
    return registerMeshCollider(id, g, rotationY, 'circle', { inflate: 0.85 });
  }, [id, position, scale, rotationY, cloned]);

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

useGLTF.preload(URL);
