'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { registerMeshCollider } from '@/store/collision';

const GIANTESS_URL = '/models/giantess_squat.glb';

type Props = {
  id: string;
  // [x, y, z]. The level's spawn point feeds [x, 0, z] by default; pass
  // a non-zero y from the spawn config (via `yOffset` in the spawn
  // type) to perch the figure on top of a raised structure.
  position: [number, number, number];
  scale?: number;
  rotationY?: number;
  // Hot pink / magenta default matches the reference renders — the
  // figures around the pool read as a single material rather than the
  // raw GLB's PBR. Override per spawn if you want variations.
  color?: string;
  emissive?: string;
  emissiveIntensity?: number;
};

export default function Giantess({
  id,
  position,
  scale = 11.0,
  rotationY = 0,
  color = '#ff8ec8',
  emissive = '#c44a8a',
  emissiveIntensity = 0.45,
}: Props) {
  const { scene } = useGLTF(GIANTESS_URL);
  const groupRef = useRef<THREE.Group>(null);

  const cloned = useMemo(() => {
    const c = scene.clone(true);
    // Glossy pink physical material so the figures feel as wet as the
    // tiles — clearcoat + low roughness gives them the same specular
    // highlight the pool walls have.
    const mat = new THREE.MeshPhysicalMaterial({
      color,
      emissive: new THREE.Color(emissive),
      emissiveIntensity,
      roughness: 0.25,
      metalness: 0.05,
      clearcoat: 0.8,
      clearcoatRoughness: 0.12,
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
  }, [scene, color, emissive, emissiveIntensity]);

  useEffect(() => {
    const g = groupRef.current;
    if (!g) return;
    return registerMeshCollider(id, g, rotationY, 'circle', { inflate: 0.75 });
  }, [id, position, scale, rotationY, cloned]);

  return (
    <group ref={groupRef} position={position} rotation={[0, rotationY, 0]} scale={scale}>
      <primitive object={cloned} />
    </group>
  );
}

useGLTF.preload(GIANTESS_URL);
