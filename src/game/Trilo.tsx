'use client';

import { useEffect, useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { collision } from '@/store/collision';

const URL = '/models/trilo.glb';
const COLLISION_RADIUS = 1.6;

type Props = {
  id: string;
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
  id,
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
