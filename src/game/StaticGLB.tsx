'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { registerMeshCollider } from '@/store/collision';

export type StaticGLBKind =
  | 'glowing_purple_coral'
  | 'neon_vascular_tree'
  | 'purple_coral'
  | 'purple_coral_alt'
  | 'purple_stone_cairn'
  | 'tangled_root_sculpture'
  | 'mythical_horse';

// Per-kind tweaks for material tint + collider behaviour. Keeping
// these here (rather than in levels.ts) so a level designer dropping
// a coral down doesn't need to remember the right emissive colour;
// the spawn config stays minimal.
const KIND_CONFIG: Record<
  StaticGLBKind,
  {
    url: string;
    color: string;
    emissive: string;
    emissiveIntensity: number;
    // Collider mode + per-kind inflate. Round-ish props use 'circle'
    // with a tighter inflate so the player can graze them; tall
    // skeletal pieces use 'box' so the trunk is solid but you can
    // walk past the silhouette edges.
    colliderKind: 'circle' | 'box' | 'auto';
    colliderInflate?: number;
  }
> = {
  glowing_purple_coral: {
    url: '/models/glowing_purple_coral.glb',
    color: '#a04ed2',
    emissive: '#7a2db8',
    emissiveIntensity: 0.85,
    colliderKind: 'circle',
    colliderInflate: 0.7,
  },
  neon_vascular_tree: {
    url: '/models/neon_vascular_tree.glb',
    color: '#7a4ea8',
    emissive: '#3a1a5a',
    emissiveIntensity: 0.55,
    colliderKind: 'circle',
    colliderInflate: 0.5,
  },
  purple_coral: {
    url: '/models/purple_coral.glb',
    color: '#7a4ea8',
    emissive: '#1f1130',
    emissiveIntensity: 0.45,
    colliderKind: 'circle',
    colliderInflate: 0.7,
  },
  purple_coral_alt: {
    url: '/models/purple_coral_alt.glb',
    color: '#8654c4',
    emissive: '#221140',
    emissiveIntensity: 0.5,
    colliderKind: 'circle',
    colliderInflate: 0.7,
  },
  purple_stone_cairn: {
    url: '/models/purple_stone_cairn.glb',
    color: '#5e4d75',
    emissive: '#15102a',
    emissiveIntensity: 0.35,
    colliderKind: 'circle',
    colliderInflate: 0.85,
  },
  tangled_root_sculpture: {
    url: '/models/tangled_root_sculpture.glb',
    color: '#4a3768',
    emissive: '#1a0e30',
    emissiveIntensity: 0.4,
    colliderKind: 'circle',
    colliderInflate: 0.65,
  },
  mythical_horse: {
    url: '/models/mythical_horse.glb',
    // Bone-pink with a strong emissive so the figure reads as
    // luminous against Blodverden's deep red atmosphere — same tonal
    // family as the painted blod_hest card it replaces.
    color: '#f0c8c8',
    emissive: '#7a3838',
    emissiveIntensity: 0.45,
    colliderKind: 'box',
    colliderInflate: 0.85,
  },
};

type Props = {
  kindName: StaticGLBKind;
  id: string;
  position: [number, number, number];
  scale?: number;
  rotationY?: number;
};

// Generic prop component for the new natural-asset GLBs. Each instance
// clones the shared scene, swaps every mesh's material for a tinted
// MeshLambertMaterial (so day-cycle lighting drives them), and
// registers a mesh-derived collider so the player walks around the
// visible silhouette.
//
// One component instead of six dedicated wrappers: the kinds differ
// only in URL + colour + collider tightness, all of which collapse
// nicely into KIND_CONFIG. Adding a new natural asset is one row in
// that table.
export default function StaticGLB({ kindName, id, position, scale = 1, rotationY = 0 }: Props) {
  const cfg = KIND_CONFIG[kindName];
  const { scene } = useGLTF(cfg.url);
  const groupRef = useRef<THREE.Group>(null);

  const cloned = useMemo(() => {
    const c = scene.clone(true);
    const mat = new THREE.MeshLambertMaterial({
      color: cfg.color,
      emissive: new THREE.Color(cfg.emissive),
      emissiveIntensity: cfg.emissiveIntensity,
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
  }, [scene, cfg.color, cfg.emissive, cfg.emissiveIntensity]);

  useEffect(() => {
    const g = groupRef.current;
    if (!g) return;
    return registerMeshCollider(id, g, rotationY, cfg.colliderKind, {
      inflate: cfg.colliderInflate,
    });
  }, [id, position, scale, rotationY, cloned, cfg.colliderKind, cfg.colliderInflate]);

  return (
    <group ref={groupRef} position={position} rotation={[0, rotationY, 0]} scale={scale}>
      <primitive object={cloned} />
    </group>
  );
}

// Preload every model so the first time the player walks near one we
// don't get a frame stall while the GLB parses.
for (const kind of Object.keys(KIND_CONFIG) as StaticGLBKind[]) {
  useGLTF.preload(KIND_CONFIG[kind].url);
}
