'use client';

import { useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

const URL = '/models/rock_stack.glb';

type Props = {
  position: [number, number, number];
  scale?: number;
  rotationY?: number;
};

// Static stone stack. Default scale = 1 so the GLB's authored size in
// Blender is the source of truth — bump or shrink it there rather than
// here in code.
export default function RockStack({ position, scale = 1, rotationY = 0 }: Props) {
  const { scene } = useGLTF(URL);

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

  return (
    <group position={position} rotation={[0, rotationY, 0]} scale={scale}>
      <primitive object={cloned} />
    </group>
  );
}

useGLTF.preload(URL);
