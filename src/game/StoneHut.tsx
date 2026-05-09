'use client';

import { useEffect, useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { collision } from '@/store/collision';

const URL = '/models/stone_hut.glb';
// Approximate footprint of a scale-1 hut. Per-instance scale multiplies
// this when the spawn overrides it.
const COLLISION_RADIUS = 4.5;

type Props = {
  id: string;
  position: [number, number, number];
  scale?: number;
  rotationY?: number;
};

// Static stone hut. The GLB is untextured (Tripo export with neutral
// baseColor) so we tint the material into the moody palette via a
// MeshLambertMaterial swap.
export default function StoneHut({ id, position, scale = 1, rotationY = 0 }: Props) {
  const { scene } = useGLTF(URL);

  const cloned = useMemo(() => {
    const c = scene.clone(true);
    c.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.material = new THREE.MeshLambertMaterial({
          color: '#5e4d75',
          emissive: new THREE.Color('#1a1130'),
          emissiveIntensity: 0.4,
        });
      }
    });
    return c;
  }, [scene]);

  // Register collider centred on the prop's world position.
  useEffect(() => {
    collision.register(id, position[0], position[2], COLLISION_RADIUS * scale);
    return () => collision.unregister(id);
  }, [id, position, scale]);

  return (
    <group position={position} rotation={[0, rotationY, 0]} scale={scale}>
      <primitive object={cloned} />
    </group>
  );
}

useGLTF.preload(URL);
