'use client';

import { useEffect, useMemo } from 'react';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { collision } from '@/store/collision';
import { applyGradientMap, makeGradientTexture } from './gradients';
import { LEVELS } from './levels';
import { useLevel } from '@/store/level';

const FACE_CAMERA_Y = Math.PI / 4;
const COLLISION_RADIUS = 1.2;

type Props = {
  id: string;
  position: [number, number, number];
  texture: string;
  // World-space height of the rendered card. Width derives from aspect.
  height?: number;
  scale?: number;
};

// Tall sprite-card relic. 2D pixel-art-ish painting on a vertical
// quad rotated 45° to face the iso camera, with an alpha-tested cutout
// for hard silhouette edges. Casts a tilted shadow on the ground.
//
// Texture luminance is remapped through the level's relic gradient so
// the relic art harmonises with the rest of the world's palette and
// follows the day-cycle hue/brightness drift.
export default function Relic({ id, position, texture, height = 4.5, scale = 1 }: Props) {
  const tex = useTexture(texture);

  useEffect(() => {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.anisotropy = 4;
    tex.needsUpdate = true;
  }, [tex]);

  // Initial gradient comes from the active level on mount; Scene's
  // level-change effect re-publishes the texture under the 'relic' role
  // so all relics swap palette together when the world changes.
  const material = useMemo(() => {
    const m = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      alphaTest: 0.5,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    const initialGradient = makeGradientTexture(
      LEVELS[useLevel.getState().currentLevelId].relicGradient,
    );
    applyGradientMap(m, initialGradient, 'relic');
    return m;
    // tex is the only meaningful dependency — gradient is patched into the
    // material at compile time and updated via the registry.
  }, [tex]);

  // Free GPU resources when the relic unmounts.
  useEffect(() => {
    return () => {
      material.dispose();
    };
  }, [material]);

  const dims = useMemo(() => {
    const img = tex.image as { width?: number; height?: number } | undefined;
    const aspect = img?.width && img?.height ? img.width / img.height : 0.5;
    const h = height * scale;
    const w = h * aspect;
    return { w, h };
  }, [tex, height, scale]);

  // Register a small collider so the player walks around tall relics.
  useEffect(() => {
    collision.register(id, position[0], position[2], COLLISION_RADIUS * scale);
    return () => collision.unregister(id);
  }, [id, position, scale]);

  return (
    <mesh
      position={[position[0], dims.h / 2, position[2]]}
      rotation={[0, FACE_CAMERA_Y, 0]}
      castShadow
    >
      <planeGeometry args={[dims.w, dims.h]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}
