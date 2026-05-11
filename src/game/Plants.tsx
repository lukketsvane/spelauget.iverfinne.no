'use client';

import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { applyGradientMap, getGradientTexture } from './gradients';
import { makeRegionGradientTexture } from './regions';
import { useLevel } from '@/store/level';
import { useSettings } from '@/store/settings';

// height = world units tall.
// wind   = sway amplitude on the top of the sprite (0 = stiff stem, 1 = leafy).
// pushable = whether the plant bends away from the player when nearby
//   (true for soft bushes / grass, false for tree-sized plants).
const PLANT_SOURCES = [
  { url: '/plante_01.png', height: 2.4, wind: 0.7, pushable: true },
  { url: '/plante_02.png', height: 3.0, wind: 0.6, pushable: true },
  { url: '/plante_03.png', height: 4.2, wind: 0.2, pushable: false },
  { url: '/plante_04.png', height: 4.0, wind: 0.35, pushable: false },
  { url: '/plante_01.png', height: 2.2, wind: 0.8, pushable: true },
] as const;

const FACE_CAMERA_Y = Math.PI / 4;
const CHUNK_SIZE = 12;
const CHUNK_RADIUS = 3;
const PLANTS_PER_CHUNK_MIN = 5;
const PLANTS_PER_CHUNK_MAX = 9;
const PLAYER_SPAWN_SAFE_RADIUS = 3.0;

type Placement = { idx: number; x: number; z: number; scale: number; flip: boolean };
type Chunk = { key: string; cx: number; cz: number; placements: Placement[] };
export type PlantExclusion = { x: number; z: number; r: number };
type Props = {
  playerPosRef: MutableRefObject<THREE.Vector3>;
  // World-space points where plants must NOT spawn (NPCs, props, etc.).
  exclusions?: PlantExclusion[];
};

type PlantUniforms = {
  uTime: { value: number };
  uPlayerPos: { value: THREE.Vector3 };
};

export default function Plants({ playerPosRef, exclusions }: Props) {
  // Procedural plant chunks render only inside Hagen — the four
  // chain destinations (Blodverden / Flisverden / Saltverden /
  // Speilverden) are intentionally empty blank slates per the
  // user's "tomme verdener bortsett fra første" brief. Hooks below
  // still run unconditionally to keep the call order stable; we
  // just early-return null at JSX time when the active region
  // isn't Hagen.
  const isHagen = useLevel((s) => s.currentRegionId === 'lysningen');
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

  // Track every per-material uniform pair so the useFrame loop can push
  // shared time + player position without rebinding ref hooks.
  const uniformList = useRef<PlantUniforms[]>([]);

  // Region-blended gradient textures shared across the world. Built
  // once at app start by Scene.tsx; we just read the registry so all
  // plants sample the same blend.
  const gradientTex = useMemo(
    () => getGradientTexture('plant') ?? makeRegionGradientTexture('plant'),
    [],
  );
  const haloTex = useMemo(
    () => getGradientTexture('halo') ?? makeRegionGradientTexture('halo'),
    [],
  );

  const materials = useMemo(() => {
    uniformList.current = [];
    return PLANT_SOURCES.map((src, i) => {
      const base = new THREE.MeshBasicMaterial({
        map: textures[i],
        transparent: true,
        alphaTest: 0.5,
        side: THREE.DoubleSide,
        toneMapped: false,
      });
      applyGradientMap(base, gradientTex, 'plant');
      applyPlantVertexShader(base, src.wind, src.pushable, uniformList);

      const halo = new THREE.MeshBasicMaterial({
        map: textures[i],
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        toneMapped: false,
      });
      applyGradientMap(halo, haloTex, 'halo');
      // Halo gets the SAME vertex displacement so the additive layer
      // tracks the base sprite exactly while it sways.
      applyPlantVertexShader(halo, src.wind, src.pushable, uniformList);

      return { base, halo };
    });
  }, [textures, gradientTex, haloTex]);

  const lastChunk = useRef<{ cx: number; cz: number } | null>(null);
  const [chunks, setChunks] = useState<Map<string, Chunk>>(() => new Map());

  // Reset all loaded chunks whenever the exclusion zones change so the
  // new "no-plant" rules take effect immediately (e.g. after a level
  // transition that brings in different NPC / prop positions).
  useEffect(() => {
    setChunks(new Map());
    lastChunk.current = null;
  }, [exclusions]);

  useFrame((state) => {
    // Drive wind + player-push uniforms across every plant material.
    // When reduceMotion is on, freeze uTime so the wind sway is locked
    // to its zero-phase pose. Player-push still fires (it only triggers
    // on close approach and reads as feedback rather than ambient
    // motion).
    const reduceMotion = useSettings.getState().reduceMotion;
    const t = reduceMotion ? 0 : state.clock.elapsedTime;
    for (const u of uniformList.current) {
      u.uTime.value = t;
      u.uPlayerPos.value.copy(playerPosRef.current);
    }

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
          next.set(k, { key: k, cx, cz, placements: buildChunk(cx, cz, exclusions) });
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  });

  if (!isHagen) return null;

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
              {/* Halo plane is wider than the base sprite so the additive
                  glow leaks past the silhouette — fake bloom rim without
                  a postprocess pass. */}
              <mesh position={[0, 0, 0.005]}>
                <planeGeometry args={[sw * 1.2, sh * 1.2]} />
                <primitive object={m.halo} attach="material" />
              </mesh>
            </group>
          );
        }),
      )}
    </group>
  );
}

// Patches a sprite plant's vertex shader with two displacement effects
// driven from shared uniforms (uTime + uPlayerPos):
//   1. Wind sway   — top vertices oscillate horizontally; uv.y is the
//      weight so stems stay anchored at the ground.
//   2. Player push — when the player is within ~1.4 m of the world-space
//      vertex, the top of the plant bends away from them, like brushing
//      against grass. Only enabled for plants flagged `pushable`.
function applyPlantVertexShader(
  material: THREE.Material,
  windAmp: number,
  pushable: boolean,
  uniformList: { current: PlantUniforms[] },
) {
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    prev?.call(material, shader, renderer);

    const uTime = { value: 0 };
    const uPlayerPos = { value: new THREE.Vector3() };
    shader.uniforms.uTime = uTime;
    shader.uniforms.uPlayerPos = uPlayerPos;
    shader.uniforms.uWindAmp = { value: windAmp };
    shader.uniforms.uPushAmp = { value: pushable ? 1.0 : 0.0 };
    uniformList.current.push({ uTime, uPlayerPos });

    shader.vertexShader =
      /* glsl */ `
        uniform float uTime;
        uniform vec3 uPlayerPos;
        uniform float uWindAmp;
        uniform float uPushAmp;
      ` + shader.vertexShader;

    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      /* glsl */ `
        #include <begin_vertex>

        // World position before any animation displacement.
        vec3 wp = (modelMatrix * vec4(transformed, 1.0)).xyz;

        // Wind sway: top of sprite swings horizontally; world-X/Z phase
        // offset means neighbouring plants sway out of sync.
        float windPhase = uTime * 1.4 + wp.x * 0.45 + wp.z * 0.35;
        vec2 windDir = vec2(0.18, 0.06);
        float swayWeight = uv.y * uWindAmp;
        transformed.x += sin(windPhase) * windDir.x * swayWeight;
        transformed.z += cos(windPhase * 0.85) * windDir.y * swayWeight;

        // Player-push: bend the top of the plant away from the player
        // when they're within ~1.4 m. Quadratic falloff for soft edge.
        if (uPushAmp > 0.0) {
          vec2 toPlayer = wp.xz - uPlayerPos.xz;
          float dSq = dot(toPlayer, toPlayer);
          float pushRadius = 1.6;
          float push = max(0.0, 1.0 - dSq / (pushRadius * pushRadius));
          push *= push;
          vec2 pushDir = normalize(toPlayer + vec2(0.0001));
          float scale = uPushAmp * push * uv.y * 0.85;
          transformed.x += pushDir.x * scale;
          transformed.z += pushDir.y * scale;
        }
      `,
    );
  };
  material.needsUpdate = true;
}

function buildChunk(
  cx: number,
  cz: number,
  exclusions?: PlantExclusion[],
): Placement[] {
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
    // Skip plants inside any exclusion bubble (NPC bodies, props).
    let blocked = false;
    if (exclusions) {
      for (const e of exclusions) {
        if (Math.hypot(wx - e.x, wz - e.z) < e.r) {
          blocked = true;
          break;
        }
      }
    }
    if (blocked) continue;
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
