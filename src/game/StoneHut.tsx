'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { registerMeshCollider } from '@/store/collision';

const URL = '/models/stone_hut.glb';

type Props = {
  id: string;
  position: [number, number, number];
  scale?: number;
  rotationY?: number;
};

// Static stone hut. The GLB is untextured (Tripo export with neutral
// baseColor) so we tint the material into the moody palette via a
// MeshLambertMaterial swap.
//
// Collider is derived from the actual rendered mesh's bounds (see
// registerMeshCollider) so the player walks around the visible
// rectangular footprint rather than a hardcoded "scale × constant"
// circle that didn't match the building.
export default function StoneHut({ id, position, scale = 1, rotationY = 0 }: Props) {
  const { scene } = useGLTF(URL);
  const groupRef = useRef<THREE.Group>(null);

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

  // Register an OBB collider that matches the hut's actual rectangular
  // footprint. The kind is forced to 'box' even though the GLB is
  // close to square — huts read better with sharp corners than a
  // tangent circle.
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

useGLTF.preload(URL);
