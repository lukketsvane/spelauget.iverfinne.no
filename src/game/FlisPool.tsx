'use client';

import { useMemo, useRef } from 'react';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';

const TILE_TEXTURE_URL = '/flis_tilable_texture.png';

// Sunken swimming-pool prop. There are NO walls or pillars around the
// pool — the player walks on the same wet tile floor the sculptures
// sit on (deck level = y=0). The pool itself is a rectangular basin
// recessed BELOW the floor, with tile-clad inner walls and a water
// plane sitting just under the deck rim.
//
// Coordinates are local to the group: +X = east, +Z = south. Position
// the entire prop with the spawn's `position`; rotation rotates the
// basin in place.

type Props = {
  id: string;
  position: [number, number, number];
  rotationY?: number;
  scale?: number;
};

// Geometry parameters. Keep the interior count odd × even so the
// basin reads as a rectangle, not a square.
export const POOL_TILE = 8.0; // metres — tile size used by FlisFloor too
export const POOL_TILES_X = 7;
export const POOL_TILES_Z = 3;
// Depth of the basin below the deck. Big enough to feel like a real
// pool at this scale, shallow enough that the iso camera still sees
// the water from a couple of metres away.
const POOL_RECESS = 4.0;
// Water surface sits just below the rim — gives the pool that
// "filled to the brim" look.
const WATER_LEVEL = -0.4;

export default function FlisPool({
  id: _id,
  position,
  rotationY = 0,
  scale = 1,
}: Props) {
  const groupRef = useRef<THREE.Group>(null);
  const tex = useTexture(TILE_TEXTURE_URL);

  // Wet-tile basin material — MeshPhysicalMaterial with a clearcoat
  // layer gives the surface a glossy specular highlight even without
  // an environment map. emissiveMap keeps the mint pattern legible
  // under the strongly-tinted GEOMETRI region lighting.
  const basinMaterial = useMemo(() => {
    const t = tex.clone();
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    t.repeat.set(POOL_TILES_X, POOL_TILES_Z);
    t.needsUpdate = true;
    return new THREE.MeshPhysicalMaterial({
      map: t,
      color: '#ffffff',
      emissiveMap: t,
      emissive: new THREE.Color('#b8e8d8'),
      emissiveIntensity: 0.35,
      roughness: 0.18,
      metalness: 0.05,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      side: THREE.DoubleSide,
    });
  }, [tex]);

  // Inner pool-wall material — tile texture at a coarser density so
  // the wall reads as a few large tiles per face rather than a
  // smeared blur.
  const innerWallMaterial = useMemo(() => {
    const t = tex.clone();
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    t.repeat.set(POOL_TILES_X, 1);
    t.needsUpdate = true;
    return new THREE.MeshPhysicalMaterial({
      map: t,
      color: '#ffffff',
      emissiveMap: t,
      emissive: new THREE.Color('#b8e8d8'),
      emissiveIntensity: 0.35,
      roughness: 0.18,
      metalness: 0.05,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      side: THREE.DoubleSide,
    });
  }, [tex]);

  const innerWallMaterialZ = useMemo(() => {
    const t = tex.clone();
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    t.repeat.set(POOL_TILES_Z, 1);
    t.needsUpdate = true;
    return new THREE.MeshPhysicalMaterial({
      map: t,
      color: '#ffffff',
      emissiveMap: t,
      emissive: new THREE.Color('#b8e8d8'),
      emissiveIntensity: 0.35,
      roughness: 0.18,
      metalness: 0.05,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      side: THREE.DoubleSide,
    });
  }, [tex]);

  const waterMaterial = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: '#5dc6e6',
        emissive: new THREE.Color('#3aa0d4'),
        emissiveIntensity: 0.4,
        transparent: true,
        opacity: 0.82,
        depthWrite: false,
        roughness: 0.05,
        metalness: 0.0,
        clearcoat: 1.0,
        clearcoatRoughness: 0.02,
      }),
    [],
  );

  const poolWidth = POOL_TILES_X * POOL_TILE;
  const poolDepth = POOL_TILES_Z * POOL_TILE;
  // Basin floor sits this far below the world deck.
  const basinY = -POOL_RECESS;

  return (
    <group ref={groupRef} position={position} rotation={[0, rotationY, 0]} scale={scale}>
      {/* Basin floor — tile-textured plane at the bottom of the recess. */}
      <mesh
        position={[0, basinY, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        material={basinMaterial}
        receiveShadow
      >
        <planeGeometry args={[poolWidth, poolDepth]} />
      </mesh>

      {/* Four inner walls of the basin — tile-clad rectangles facing
          INWARD so the player sees the tiled bath from above. */}
      <mesh
        position={[0, basinY / 2, -poolDepth / 2 + 0.01]}
        material={innerWallMaterial}
        receiveShadow
      >
        <planeGeometry args={[poolWidth, POOL_RECESS]} />
      </mesh>
      <mesh
        position={[0, basinY / 2, poolDepth / 2 - 0.01]}
        rotation={[0, Math.PI, 0]}
        material={innerWallMaterial}
        receiveShadow
      >
        <planeGeometry args={[poolWidth, POOL_RECESS]} />
      </mesh>
      <mesh
        position={[-poolWidth / 2 + 0.01, basinY / 2, 0]}
        rotation={[0, Math.PI / 2, 0]}
        material={innerWallMaterialZ}
        receiveShadow
      >
        <planeGeometry args={[poolDepth, POOL_RECESS]} />
      </mesh>
      <mesh
        position={[poolWidth / 2 - 0.01, basinY / 2, 0]}
        rotation={[0, -Math.PI / 2, 0]}
        material={innerWallMaterialZ}
        receiveShadow
      >
        <planeGeometry args={[poolDepth, POOL_RECESS]} />
      </mesh>

      {/* Water surface — sits just below the deck rim. Transparent so
          the basin floor tint shows through faintly. */}
      <mesh
        position={[0, WATER_LEVEL, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        material={waterMaterial}
      >
        <planeGeometry args={[poolWidth - 0.04, poolDepth - 0.04]} />
      </mesh>
    </group>
  );
}
