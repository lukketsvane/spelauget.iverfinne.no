'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useLevel } from '@/store/level';

// Flat translucent fog plane that hovers just above the Blodverden
// ground — gives the world its smouldering "mist over a battlefield"
// feel without changing the per-pixel scene fog. The plane drifts
// laterally over time so the haze never reads as a static texture.
//
// Only renders when the active region is `blod`; other worlds keep
// their existing fog tuning.

type Props = {
  // World-space half-extent of the haze plane along X and Z. Defaults
  // sized to roughly fill the Blodverden region disc.
  size?: number;
  // Height above the ground (y in metres).
  height?: number;
};

const PINK = new THREE.Color('#ff3a4a');

export default function BlodFogLayer({ size = 200, height = 1.2 }: Props) {
  const isBlod = useLevel((s) => s.currentRegionId === 'blod');
  const meshRef = useRef<THREE.Mesh>(null);

  // Soft radial alpha texture so the slab has no hard edges — fog
  // fades out toward the rectangle's rim.
  const texture = useMemo(() => {
    const size = 256;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d')!;
    const grd = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grd.addColorStop(0, 'rgba(255, 92, 96, 0.55)');
    grd.addColorStop(0.55, 'rgba(255, 70, 80, 0.35)');
    grd.addColorStop(1, 'rgba(255, 60, 70, 0.0)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(4, 4);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);

  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: texture,
        color: PINK,
        transparent: true,
        opacity: 0.75,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    [texture],
  );

  useFrame(({ clock }) => {
    if (!isBlod) return;
    const m = meshRef.current;
    if (!m) return;
    const t = clock.getElapsedTime() * 0.04;
    // Drift the texture UV so the haze pattern flows slowly across
    // the surface — pure decoration, no parallax.
    texture.offset.set(t, t * 0.6);
  });

  if (!isBlod) return null;

  // Anchor the plane to the Blodverden region centre. The size is
  // big enough that the player never sees an edge.
  return (
    <mesh
      ref={meshRef}
      position={[-90, height, -50]}
      rotation={[-Math.PI / 2, 0, 0]}
      renderOrder={2}
      material={material}
    >
      <planeGeometry args={[size, size]} />
    </mesh>
  );
}
