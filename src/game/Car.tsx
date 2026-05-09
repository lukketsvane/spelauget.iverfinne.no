'use client';

import { useEffect, useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { collision } from '@/store/collision';

const URL = '/models/car_01.glb';
const COLLISION_RADIUS = 2.4;

type Props = {
  id: string;
  position: [number, number, number];
  scale?: number;
  rotationY?: number;
};

// Static car prop. Left mostly un-tinted on purpose — it's supposed
// to feel out-of-place in the meadow, the way the digger warned.
export default function Car({ id, position, scale = 1, rotationY = 0 }: Props) {
  const { scene } = useGLTF(URL);

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
