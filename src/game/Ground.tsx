'use client';

import { useEffect, useMemo } from 'react';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';

const GROUND_TEXTURE = '/bakke_tile_01.png';
const GROUND_SIZE = 400; // world units per side — large enough to never see edges
const TILE_SIZE = 6; // world units one texture tile spans

export default function Ground() {
  const tex = useTexture(GROUND_TEXTURE);

  useEffect(() => {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(GROUND_SIZE / TILE_SIZE, GROUND_SIZE / TILE_SIZE);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    tex.minFilter = THREE.LinearMipMapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = true;
    tex.needsUpdate = true;
  }, [tex]);

  // Lambert is cheap and shaded by the directional light so cast shadows
  // visibly darken the texture; emissive lifts the base brightness so the
  // overall scene stays paper-bright instead of gray.
  const material = useMemo(
    () =>
      new THREE.MeshLambertMaterial({
        map: tex,
        color: '#ffffff',
        emissive: new THREE.Color('#cccccc'),
        emissiveIntensity: 1.0,
        emissiveMap: tex,
      }),
    [tex],
  );

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
      <planeGeometry args={[GROUND_SIZE, GROUND_SIZE]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

useTexture.preload(GROUND_TEXTURE);
