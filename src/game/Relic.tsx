'use client';

import { useEffect, useMemo } from 'react';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { collision } from '@/store/collision';
import { applyGradientMap, makeGradientTexture } from './gradients';
import { LEVELS } from './levels';
import { useLevel } from '@/store/level';

const FACE_CAMERA_Y = Math.PI / 4;
// Half-depth of the relic card's collision footprint along the local
// Z axis (perpendicular to the painted face). The card is a flat
// plane, so this is just enough thickness to feel solid when the
// player runs into it edge-on.
const CARD_THICKNESS = 0.18;

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
//
// Collider is a thin OBB rotated to match the card's orientation so
// the player can pass close along the edge but is blocked when
// walking face-on into the painting. Width comes from the actual
// rendered card so a wider painting blocks a wider strip.
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

  // Thin OBB matching the card's ground footprint. Half-extents are
  // (w/2) along the card's local X (its width) and a tiny constant
  // along local Z (depth). The same FACE_CAMERA_Y rotation that
  // orients the painting also orients the collider.
  useEffect(() => {
    collision.registerBox(
      id,
      position[0],
      position[2],
      dims.w / 2,
      CARD_THICKNESS,
      FACE_CAMERA_Y,
    );
    return () => collision.unregister(id);
  }, [id, position, dims.w]);

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
