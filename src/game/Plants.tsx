'use client';

import { useMemo, useRef, useState, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import {
  applyGradientMap,
  makeGradientTexture,
  PLANT_GRADIENT,
  PLANT_HALO_GRADIENT,
} from './gradients';

const PLANT_SOURCES = [
  { url: '/plante_01.png', height: 2.4 },
  { url: '/plante_02.png', height: 3.0 },
  { url: '/plante_03.png', height: 4.2 },
  { url: '/plante_04.png', height: 4.0 },
  { url: '/plante._01.png', height: 2.2 },
] as const;

const FACE_CAMERA_Y = Math.PI / 4;
const CHUNK_SIZE = 12;
const CHUNK_RADIUS = 3;
const PLANTS_PER_CHUNK_MIN = 5;
const PLANTS_PER_CHUNK_MAX = 9;
const PLAYER_SPAWN_SAFE_RADIUS = 3.0;

type Placement = { idx: number; x: number; z: number; scale: number; flip: boolean };
type Chunk = { key: string; cx: number; cz: number; placements: Placement[] };
type Props = { playerPosRef: MutableRefObject<THREE.Vector3> };

export default function Plants({ playerPosRef }: Props) {
  const textures = useTexture(PLANT_SOURCES.map((p) => p.url));

  useMemo(() => {
    for (const t of textures) {
      t.colorSpace = THREE.SRGBColorSpace;
      t.minFilter = THREE.LinearFilter;
      t.magFilter = THREE.LinearFilter;
      t.anisotropy = 4;
      t.needsUpdate = true;
    }
  }, [textures]);

  const dims = useMemo(
    () =>
      PLANT_SOURCES.map((src, i) => {
        const img = textures[i].image as { width?: number; height?: number } | undefined;
        const aspect = img?.width && img?.height ? img.width / img.height : 1;
        return { w: src.height * aspect, h: src.height };
      }),
    [textures],
  );

  // Two materials per source: a base gradient-mapped pass and an additive
  // halo pass. The halo's gradient blacks out the dark half of the source
  // texture so only the bright edges contribute, giving a self-emissive
  // glow without a post-processing bloom step.
  const gradientTex = useMemo(() => makeGradientTexture(PLANT_GRADIENT), []);
  const haloTex = useMemo(() => makeGradientTexture(PLANT_HALO_GRADIENT), []);
  const materials = useMemo(() => {
    return PLANT_SOURCES.map((_, i) => {
      const base = new THREE.MeshBasicMaterial({
        map: textures[i],
        transparent: true,
        alphaTest: 0.5,
        side: THREE.DoubleSide,
        toneMapped: false,
      });
      applyGradientMap(base, gradientTex);
      const halo = new THREE.MeshBasicMaterial({
        map: textures[i],
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        toneMapped: false,
      });
      applyGradientMap(halo, haloTex);
      return { base, halo };
    });
  }, [textures, gradientTex, haloTex]);

  const lastChunk = useRef<{ cx: number; cz: number } | null>(null);
  const [chunks, setChunks] = useState<Map<string, Chunk>>(() => new Map());

  useFrame(() => {
    const px = playerPosRef.current.x;
    const pz = playerPosRef.current.z;
    const ccx = Math.floor(px / CHUNK_SIZE);
    const ccz = Math.floor(pz / CHUNK_SIZE);

    if (lastChunk.current && lastChunk.current.cx === ccx && lastChunk.current.cz === ccz) return;
    lastChunk.current = { cx: ccx, cz: ccz };

    const desired = new Set<string>();
    for (let dx = -CHUNK_RADIUS; dx <= CHUNK_RADIUS; dx++) {
      for (let dz = -CHUNK_RADIUS; dz <= CHUNK_RADIUS; dz++) {
        desired.add(`${ccx + dx},${ccz + dz}`);
      }
    }

    setChunks((prev) => {
      const next = new Map(prev);
      let changed = false;
      for (const k of next.keys()) {
        if (!desired.has(k)) {
          next.delete(k);
          changed = true;
        }
      }
      for (const k of desired) {
        if (!next.has(k)) {
          const [cx, cz] = k.split(',').map(Number);
          next.set(k, { key: k, cx, cz, placements: buildChunk(cx, cz) });
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  });

  return (
    <group>
      {Array.from(chunks.values()).flatMap((chunk) =>
        chunk.placements.map((p, i) => {
          const { w, h } = dims[p.idx];
          const sw = w * p.scale;
          const sh = h * p.scale;
          const m = materials[p.idx];
          return (
            <group
              key={`${chunk.key}:${i}`}
              position={[p.x, sh / 2, p.z]}
              rotation={[0, FACE_CAMERA_Y, 0]}
              scale={[p.flip ? -1 : 1, 1, 1]}
            >
              <mesh castShadow>
                <planeGeometry args={[sw, sh]} />
                <primitive object={m.base} attach="material" />
              </mesh>
              {/* Additive halo nudged forward so it z-sorts above the base. */}
              <mesh position={[0, 0, 0.005]}>
                <planeGeometry args={[sw * 1.04, sh * 1.04]} />
                <primitive object={m.halo} attach="material" />
              </mesh>
            </group>
          );
        }),
      )}
    </group>
  );
}

function buildChunk(cx: number, cz: number): Placement[] {
  const rng = mulberry32(hash2(cx, cz));
  const items: Placement[] = [];
  const count = Math.floor(
    PLANTS_PER_CHUNK_MIN + rng() * (PLANTS_PER_CHUNK_MAX - PLANTS_PER_CHUNK_MIN + 1),
  );
  for (let i = 0; i < count; i++) {
    const lx = (rng() - 0.5) * CHUNK_SIZE;
    const lz = (rng() - 0.5) * CHUNK_SIZE;
    const wx = cx * CHUNK_SIZE + lx + CHUNK_SIZE / 2;
    const wz = cz * CHUNK_SIZE + lz + CHUNK_SIZE / 2;
    if (Math.hypot(wx, wz) < PLAYER_SPAWN_SAFE_RADIUS) continue;
    items.push({
      idx: Math.floor(rng() * PLANT_SOURCES.length),
      x: wx,
      z: wz,
      scale: 0.7 + rng() * 0.7,
      flip: rng() > 0.5,
    });
  }
  return items;
}

function hash2(a: number, b: number): number {
  let h = (a | 0) * 0x27d4eb2d ^ ((b | 0) * 0x165667b1 + 0x9e3779b9);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

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

useTexture.preload(PLANT_SOURCES.map((p) => p.url));
