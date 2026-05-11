'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { registerMeshCollider } from '@/store/collision';
import type { FlisPropKind } from './levels/types';

// Per-asset URL + collider behaviour for the Flisverden GLB
// blueprints exported from Blender. `tile` is the only kind that
// stays passable (it IS the floor — collision would block walking).
// Inflate values are tuned to match the visible silhouette: figure
// inflated slightly tighter than its bounding box so the player
// can stand close to a knee without the collider pushing them off.
const KIND_CONFIG: Record<
  FlisPropKind,
  {
    url: string;
    colliderKind: 'circle' | 'box' | 'auto' | null;
    colliderInflate?: number;
  }
> = {
  figure_seated: {
    url: '/flisverden_models/flis_figure_seated.glb',
    colliderKind: 'circle',
    colliderInflate: 0.7,
  },
  vesica: {
    url: '/flisverden_models/flis_vesica.glb',
    // Vesica is a flat altar — leave passable so the player can
    // walk through / over it for ritual interactions later.
    colliderKind: null,
  },
  pillar: {
    url: '/flisverden_models/flis_pillar.glb',
    colliderKind: 'circle',
    colliderInflate: 0.85,
  },
  floor_tile: {
    url: '/flisverden_models/flis_floor_tile.glb',
    // Floor tiles are walking surface — never collide.
    colliderKind: null,
  },
};

type Props = {
  id: string;
  prop: FlisPropKind;
  position: [number, number, number];
  scale?: number;
  rotationY?: number;
};

// Flisverden GLB prop — block-out assets exported from Blender.
// Each instance clones the shared scene so position/rotation can
// vary, registers a collider derived from the actual mesh extent,
// and casts shadows like the rest of the world's 3D props.
//
// Materials carry their pink/cyan/magenta values from the GLB — no
// gradient remap pass here. (If we want them to react to the
// region palette later, swap in applyGradientMap on the mesh
// materials inside the traverse below.)
export default function FlisProp({
  id,
  prop,
  position,
  scale = 1,
  rotationY = 0,
}: Props) {
  const cfg = KIND_CONFIG[prop];
  const { scene } = useGLTF(cfg.url);
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
    if (cfg.colliderKind === null) return;
    return registerMeshCollider(id, g, rotationY, cfg.colliderKind, {
      inflate: cfg.colliderInflate,
    });
  }, [id, position, scale, rotationY, cloned, cfg.colliderKind, cfg.colliderInflate]);

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

// Preload all four GLBs so first-time entry into Flisverden doesn't
// stall while the meshes parse.
for (const cfg of Object.values(KIND_CONFIG)) {
  useGLTF.preload(cfg.url);
}
