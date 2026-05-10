'use client';

import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { useSettings } from '@/store/settings';
import type { PlantExclusion } from './Plants';

// A field of small ground-hugging plants — a layer between the bare
// ground texture and the taller plant sprites. Tiled near-flat (slight
// upward tilt so the iso camera sees it as a thin mat with depth) and
// chunked around the player so memory stays bounded as they walk.
//
// Each tile is the same `underbrush.png` (the gray-on-white blob field)
// sampled with random offsets + rotations so the player rarely sees the
// same patch twice. The shader pushes the alpha-cut shapes away from
// the player's feet to mimic stepping through grass, and tiles cast a
// soft shadow onto the ground below.

const URL = '/underbrush.png';
const CHUNK_SIZE = 12;
const CHUNK_RADIUS = 3;
const TILE_SIZE = 6;
// Lift the mat juuust above the ground so it doesn't z-fight with the
// ground plane, but stays low enough to read as ground cover.
const TILE_Y = 0.04;
// How far above-the-ground the alpha-cut blob centroids tilt up. With
// the iso camera this is enough to see a sliver of "side" on the
// blobs and read them as 3D rather than a printed pattern.
const TILT_X = 0.15;

type Props = {
  playerPosRef: MutableRefObject<THREE.Vector3>;
  // Same exclusion list Plants uses — keep underbrush out of NPC / prop
  // bubbles so it doesn't poke through huts and digger shoulders.
  exclusions?: PlantExclusion[];
};

type Placement = { x: number; z: number; rot: number; size: number };
type Chunk = { key: string; placements: Placement[] };

export default function Underbrush({ playerPosRef, exclusions }: Props) {
  const tex = useTexture(URL);

  useEffect(() => {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.anisotropy = 4;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.needsUpdate = true;
  }, [tex]);

  // Track every per-material uniform so the useFrame loop can push
  // shared time + player position without rebinding ref hooks.
  const uniformList = useRef<{ uTime: { value: number }; uPlayerPos: { value: THREE.Vector3 } }[]>(
    [],
  );

  // Single shared material — patched once via onBeforeCompile so all
  // tiles render with the same shader. Uses a custom path that:
  //  1. Multiplies the tile's white-background image by an inverted
  //     alpha mask so the gray blobs become dark "leaves" against
  //     transparent everywhere else.
  //  2. Applies wind sway based on world-space xz so neighbouring
  //     tiles sway in different phases.
  //  3. Pushes the blob centroids away from the player like grass.
  const material = useMemo(() => {
    uniformList.current = [];
    const m = new THREE.MeshLambertMaterial({
      map: tex,
      transparent: true,
      alphaTest: 0.35,
      side: THREE.DoubleSide,
      // Plants gradient gets reused implicitly via lighting — tone
      // down the underbrush so it reads darker than the foreground
      // plant sprites and recedes visually.
      color: '#3a2a55',
    });

    const uTime = { value: 0 };
    const uPlayerPos = { value: new THREE.Vector3() };
    uniformList.current.push({ uTime, uPlayerPos });

    m.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = uTime;
      shader.uniforms.uPlayerPos = uPlayerPos;

      // -- Vertex: wind sway + player push ---------------------------
      // The geometry is a tilted plane with uv.y = 0 at the bottom
      // edge and 1 at the top. We treat that as the "lift" weight so
      // the bottom anchored to the ground stays fixed while the top
      // can sway / be pushed.
      shader.vertexShader =
        /* glsl */ `
          uniform float uTime;
          uniform vec3 uPlayerPos;
        ` + shader.vertexShader;

      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        /* glsl */ `
          #include <begin_vertex>

          vec3 wp = (modelMatrix * vec4(transformed, 1.0)).xyz;

          // Slow sway, much smaller amplitude than the tall plants
          // (this is brush, not bushes).
          float windPhase = uTime * 1.1 + wp.x * 0.55 + wp.z * 0.42;
          float sway = uv.y * 0.06;
          transformed.x += sin(windPhase) * sway;
          transformed.z += cos(windPhase * 0.9) * sway * 0.5;

          // Player push: the brush flattens / parts when the player
          // walks over it. Soft falloff over ~1.6 m, weighted by the
          // tile's lift weight so blades higher off the ground move
          // more than the anchored stems.
          vec2 toPlayer = wp.xz - uPlayerPos.xz;
          float dSq = dot(toPlayer, toPlayer);
          float pushRadius = 1.6;
          float push = max(0.0, 1.0 - dSq / (pushRadius * pushRadius));
          push *= push;
          vec2 pushDir = normalize(toPlayer + vec2(0.0001));
          float scale = push * uv.y * 0.7;
          transformed.x += pushDir.x * scale;
          transformed.z += pushDir.y * scale;
        `,
      );

      // -- Fragment: invert the gray-on-white source PNG --------------
      // The source is dark blobs on a near-white background. We treat
      // (1 - luminance) as the alpha so the blobs show through and
      // the white background becomes transparent.
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <map_fragment>',
        /* glsl */ `
          #ifdef USE_MAP
            vec4 sampled = texture2D( map, vMapUv );
            float lum = dot( sampled.rgb, vec3(0.299, 0.587, 0.114) );
            float a = clamp(1.0 - lum, 0.0, 1.0);
            // Sharpen the cutoff so blobs have crisp pixel edges
            // when the canvas is rendered at low dpr.
            a = smoothstep(0.35, 0.55, a);
            sampled.a *= a;
            sampled.rgb *= a;
            diffuseColor *= sampled;
          #endif
        `,
      );
    };
    return m;
  }, [tex]);

  // Dispose material + texture when the component unmounts.
  useEffect(() => () => material.dispose(), [material]);

  // -- Chunk streaming -----------------------------------------------
  const lastChunk = useRef<{ cx: number; cz: number } | null>(null);
  const [chunks, setChunks] = useState<Map<string, Chunk>>(() => new Map());

  // Reset on exclusion change so newly-mounted props clear their bubbles.
  useEffect(() => {
    setChunks(new Map());
    lastChunk.current = null;
  }, [exclusions]);

  useFrame((state) => {
    // Drive shared uniforms once per frame; cheap (single material).
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
    if (
      lastChunk.current &&
      lastChunk.current.cx === ccx &&
      lastChunk.current.cz === ccz
    ) {
      return;
    }
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
          next.set(k, {
            key: k,
            placements: buildChunk(cx, cz, exclusions),
          });
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  });

  return (
    <group>
      {Array.from(chunks.values()).flatMap((chunk) =>
        chunk.placements.map((p, i) => (
          <mesh
            key={`${chunk.key}:${i}`}
            position={[p.x, TILE_Y, p.z]}
            // Tilt slightly up toward the camera so the mat reads as
            // having depth, then twist around Y for variation.
            rotation={[-Math.PI / 2 + TILT_X, 0, p.rot]}
            scale={p.size}
            castShadow
            receiveShadow
          >
            <planeGeometry args={[TILE_SIZE, TILE_SIZE, 8, 8]} />
            <primitive object={material} attach="material" />
          </mesh>
        )),
      )}
    </group>
  );
}

function buildChunk(
  cx: number,
  cz: number,
  exclusions?: PlantExclusion[],
): Placement[] {
  const rng = mulberry32(hash2(cx, cz));
  const items: Placement[] = [];
  // 1–2 tiles per chunk — they're large (TILE_SIZE m) so a couple of
  // overlapping tiles fully cover a 12×12 m chunk.
  const count = 1 + Math.floor(rng() * 2);
  for (let i = 0; i < count; i++) {
    const lx = (rng() - 0.5) * CHUNK_SIZE;
    const lz = (rng() - 0.5) * CHUNK_SIZE;
    const wx = cx * CHUNK_SIZE + lx + CHUNK_SIZE / 2;
    const wz = cz * CHUNK_SIZE + lz + CHUNK_SIZE / 2;
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
      x: wx,
      z: wz,
      rot: rng() * Math.PI * 2,
      size: 0.9 + rng() * 0.4,
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

useTexture.preload(URL);
