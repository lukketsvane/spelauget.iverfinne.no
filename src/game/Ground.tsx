'use client';

import { useEffect, useMemo } from 'react';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { applyGradientMap, GROUND_GRADIENT, makeGradientTexture } from './gradients';

const GROUND_TEXTURE = '/bakke_tile_01.png';
const GROUND_SIZE = 400;
const TILE_SIZE = 6;

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

  // Lambert is shaded by the directional light, so cast shadows visibly
  // darken the surface; gradient remap then tones the whole thing into
  // deep night-purple regardless of the source PNG's grey midtones.
  const gradientTex = useMemo(() => makeGradientTexture(GROUND_GRADIENT), []);
  const material = useMemo(() => {
    const m = new THREE.MeshLambertMaterial({ map: tex, color: '#ffffff' });
    applyGradientMap(m, gradientTex);
    return m;
  }, [tex, gradientTex]);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
      <planeGeometry args={[GROUND_SIZE, GROUND_SIZE]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

useTexture.preload(GROUND_TEXTURE);
