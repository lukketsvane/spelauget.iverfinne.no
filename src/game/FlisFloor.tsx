'use client';

import { useMemo } from 'react';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';

const TILE_TEXTURE_URL = '/flisverden/flis_tilable_texture.png';

type Props = {
  id: string;
  position: [number, number, number];
  // Width / depth in metres. The tile texture repeats every `tileSize`
  // metres so the pattern matches the scale of the pool's tile cubes.
  width: number;
  depth: number;
  tileSize?: number;
  // Slight lift off the world ground so the bakke shader (which paints
  // the GEOMETRI gradient) doesn't z-fight with the floor. The default
  // is enough for the iso camera angles in this game.
  yOffset?: number;
};

// Flat tile-textured deck that covers part of Flisverden so the world
// reads as paved courtyard instead of pink ground. Same wet/shiny
// clearcoat material as the pool walls — light reflects off it as
// the player walks across.
export default function FlisFloor({
  id: _id,
  position,
  width,
  depth,
  tileSize = 8.0,
  yOffset = 0.02,
}: Props) {
  const tex = useTexture(TILE_TEXTURE_URL);

  const material = useMemo(() => {
    const t = tex.clone();
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    t.repeat.set(width / tileSize, depth / tileSize);
    t.needsUpdate = true;
    return new THREE.MeshPhysicalMaterial({
      map: t,
      color: '#ffffff',
      emissiveMap: t,
      emissive: new THREE.Color('#b8e8d8'),
      emissiveIntensity: 0.3,
      roughness: 0.18,
      metalness: 0.05,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
    });
  }, [tex, width, depth, tileSize]);

  return (
    <mesh
      position={[position[0], position[1] + yOffset, position[2]]}
      rotation={[-Math.PI / 2, 0, 0]}
      material={material}
      receiveShadow
    >
      <planeGeometry args={[width, depth]} />
    </mesh>
  );
}
