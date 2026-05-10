'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { registerMeshCollider } from '@/store/collision';

// The two parked-car models the user authored. car_01 is the
// digger-warned-about car (clean silhouette); car_02 is the
// abandoned-wreck variant we use as Remnants atmosphere.
export type CarModel = 'car_01' | 'car_02';
const CAR_URLS: Record<CarModel, string> = {
  car_01: '/models/car_01.glb',
  car_02: '/models/car_02.glb',
};

type Props = {
  id: string;
  position: [number, number, number];
  scale?: number;
  rotationY?: number;
  model?: CarModel;
};

// Static car prop. Left mostly un-tinted on purpose — it's supposed
// to feel out-of-place in the meadow, the way the digger warned.
//
// Collider is an OBB matching the car's actual silhouette: rotated
// rectangle so the player can squeeze past the front bumper without
// being blocked from a metre away by a fat tangent circle.
export default function Car({ id, position, scale = 1, rotationY = 0, model = 'car_01' }: Props) {
  const { scene } = useGLTF(CAR_URLS[model]);
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

  useEffect(() => {
    const g = groupRef.current;
    if (!g) return;
    return registerMeshCollider(id, g, rotationY, 'box');
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

useGLTF.preload(CAR_URLS.car_01);
useGLTF.preload(CAR_URLS.car_02);
