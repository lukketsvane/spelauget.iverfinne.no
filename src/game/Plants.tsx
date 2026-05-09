'use client';

import { useMemo } from 'react';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';

// Source images (transparent PNGs) and a "natural" world height in meters
// for each. Aspect ratio is read from the loaded texture so width auto-fits.
const PLANT_SOURCES = [
  { url: '/plante_01.png', height: 2.4 },
  { url: '/plante_02.png', height: 3.0 },
  { url: '/plante_03.png', height: 4.2 }, // the curly tree — taller
  { url: '/plante._01.png', height: 2.2 },
] as const;

// Cards face the camera at iso angle (camera is at +X +Z so cards rotate to
// (1,0,1)). Camera doesn't yaw, so a fixed rotation looks "always facing"
// without billboard wobble — and the resulting drop-shadow is consistent.
const FACE_CAMERA_Y = Math.PI / 4;

// Number of plants distributed in an annulus around origin (player space).
const PLANT_COUNT = 80;
const INNER_RADIUS = 4;
const OUTER_RADIUS = 30;

export default function Plants() {
  const textures = useTexture(PLANT_SOURCES.map((p) => p.url));

  // Configure textures once — color space, no mipmap shimmer, hard edges.
  useMemo(() => {
    for (const t of textures) {
      t.colorSpace = THREE.SRGBColorSpace;
      t.minFilter = THREE.LinearFilter;
      t.magFilter = THREE.LinearFilter;
      t.anisotropy = 4;
      t.needsUpdate = true;
    }
  }, [textures]);

  const placements = useMemo(() => buildPlacements(), []);

  return (
    <group>
      {placements.map((p, i) => {
        const tex = textures[p.idx];
        const img = tex.image as { width?: number; height?: number } | undefined;
        const aspect = img?.width && img?.height ? img.width / img.height : 1;
        const h = PLANT_SOURCES[p.idx].height * p.scale;
        const w = h * aspect;

        return (
          <mesh
            key={i}
            position={[p.x, h / 2, p.z]}
            rotation={[0, FACE_CAMERA_Y, 0]}
            scale={[p.flip ? -1 : 1, 1, 1]}
            castShadow
          >
            <planeGeometry args={[w, h]} />
            <meshBasicMaterial
              map={tex}
              transparent
              alphaTest={0.5}
              side={THREE.DoubleSide}
              toneMapped={false}
            />
          </mesh>
        );
      })}
    </group>
  );
}

type Placement = { idx: number; x: number; z: number; scale: number; flip: boolean };

function buildPlacements(): Placement[] {
  const rng = mulberry32(20260509);
  const items: Placement[] = [];
  for (let i = 0; i < PLANT_COUNT; i++) {
    const angle = rng() * Math.PI * 2;
    // sqrt() for uniform area distribution, not bunched near the inner ring.
    const r = Math.sqrt(rng()) * (OUTER_RADIUS - INNER_RADIUS) + INNER_RADIUS;
    const idx = Math.floor(rng() * PLANT_SOURCES.length);
    items.push({
      idx,
      x: Math.cos(angle) * r,
      z: Math.sin(angle) * r,
      scale: 0.7 + rng() * 0.7, // 0.7..1.4
      flip: rng() > 0.5,
    });
  }
  return items;
}

// Tiny seeded PRNG so placements are stable across reloads.
function mulberry32(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Pre-warm so plants are ready when Scene mounts.
useTexture.preload(PLANT_SOURCES.map((p) => p.url));
