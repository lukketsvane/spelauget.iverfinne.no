'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { registerMeshCollider } from '@/store/collision';

const URL = '/models/trilo.glb';

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
//
// Footprint is sphere-like → circle collider derived from the actual
// rendered bounds, so a 1.5×-scale trilo gets a tighter ring than a
// 2.0× one without relying on a hardcoded radius constant.
export default function Trilo({
  id,
  position,
  scale = 1.5,
  rotationY = 0,
  color = '#7a4ea8',
  emissive = '#1f1130',
}: Props) {
  const { scene } = useGLTF(URL);
  const groupRef = useRef<THREE.Group>(null);

  const cloned = useMemo(() => {
    const c = scene.clone(true);
    // Body material — soft, matte Lambert so the carapace reads as
    // organic shell rather than wet plastic.
    const bodyMat = new THREE.MeshLambertMaterial({
      color,
      emissive: new THREE.Color(emissive),
      emissiveIntensity: 0.4,
    });
    // Eye material — glossy clearcoat physical material with bright
    // emissive so each eye reads as a wet bead catching the light,
    // matching the user's "shiny trilobite eyes" brief. The trilo
    // GLB ships with the body as "Quad Sphere" and the two eyes as
    // separate Sphere meshes — anything whose name starts with
    // "Sphere" (but isn't the Quad Sphere body) gets the eye material.
    const eyeMat = new THREE.MeshPhysicalMaterial({
      color: '#ffffff',
      emissive: new THREE.Color('#a8d8ff'),
      emissiveIntensity: 0.6,
      roughness: 0.04,
      metalness: 0.1,
      clearcoat: 1.0,
      clearcoatRoughness: 0.02,
    });
    c.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        const name = mesh.name ?? '';
        const isEye = /sphere/i.test(name) && !/quad/i.test(name);
        mesh.material = isEye ? eyeMat : bodyMat;
      }
    });
    return c;
  }, [scene, color, emissive]);

  useEffect(() => {
    const g = groupRef.current;
    if (!g) return;
    return registerMeshCollider(id, g, rotationY, 'circle', { inflate: 0.8 });
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
