'use client';

import { useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

const URL = '/models/trilo.glb';

type Props = {
  position: [number, number, number];
  scale?: number;
  rotationY?: number;
  // Mood tint applied to the cloned material so the prop reads as part
  // of the current biome rather than a stark white blob.
  color?: string;
  emissive?: string;
};

// Static decorative GLB. Two simple meshes (Quad Sphere + Sphere); we
// clone the scene per-instance so each placement gets its own tinted
// Lambert material, then dispatch normal castShadow + receiveShadow.
export default function Trilo({
  position,
  scale = 1.5,
  rotationY = 0,
  color = '#7a4ea8',
  emissive = '#1f1130',
}: Props) {
  const { scene } = useGLTF(URL);

  const cloned = useMemo(() => {
    const c = scene.clone(true);
    const mat = new THREE.MeshLambertMaterial({
      color,
      emissive: new THREE.Color(emissive),
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
  }, [scene, color, emissive]);

  return (
    <group position={position} rotation={[0, rotationY, 0]} scale={scale}>
      <primitive object={cloned} />
    </group>
  );
}

useGLTF.preload(URL);
