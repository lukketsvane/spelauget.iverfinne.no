'use client';

import { useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { useDialogue } from '@/store/dialogue';
import { useEmote } from '@/store/emote';
import { useGame } from '@/store/game';
import { useInteraction } from '@/store/interaction';
import { useLevel } from '@/store/level';
import { useSettings } from '@/store/settings';
import type { RegionId } from './regions';

const TRIGGER_DISTANCE = 3.6;
// Iso-camera-facing rotation around Y. Same value Relic.tsx uses so
// painted portal cards orient consistently with painted relic cards.
const FACE_CAMERA_Y = Math.PI / 4;

type Props = {
  id: string;
  position: [number, number, number];
  radius?: number;
  colorA?: string;
  colorB?: string;
  targetRegion: RegionId;
  // Key required to step through this portal. If unspecified, falls
  // back to the legacy any-key check (useGame.hasKey) — that's the
  // behaviour the original Lysningen→Stjerneengen portal expects.
  // For new portals in the 5-world chain, pass the RegionId of the
  // key that unlocks this portal (typically === targetRegion).
  requiredKey?: RegionId;
  // Optional painted-card art. When provided, the portal renders as
  // a billboarded plane (additive blend so dark backgrounds are
  // transparent) in front of the shimmer disc. The disc still sits
  // behind to provide a glow halo.
  texture?: string;
  // Height of the painted card in world metres. Width derives from
  // texture aspect.
  height?: number;
  playerPosRef: MutableRefObject<THREE.Vector3>;
};

// Vertical disc with an animated shimmer / glance shader. Bow within
// range to fast-travel to the target region's waypoint inside the
// shared world.
export default function Portal({
  id,
  position,
  radius = 2.2,
  colorA = '#ffd5e8',
  colorB = '#7a4cff',
  targetRegion,
  requiredKey,
  texture,
  height = 6,
  playerPosRef,
}: Props) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const groupRef = useRef<THREE.Group>(null);

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      uniforms: {
        uTime: { value: 0 },
        uColorA: { value: new THREE.Color(colorA) },
        uColorB: { value: new THREE.Color(colorB) },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec2 vUv;
        uniform float uTime;
        uniform vec3 uColorA;
        uniform vec3 uColorB;

        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }
        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          float a = hash(i);
          float b = hash(i + vec2(1.0, 0.0));
          float c = hash(i + vec2(0.0, 1.0));
          float d = hash(i + vec2(1.0, 1.0));
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
        }

        void main() {
          vec2 p = vUv - 0.5;
          float r = length(p) * 2.0;
          if (r > 1.05) discard;
          float disc = smoothstep(1.0, 0.95, r);

          float angle = atan(p.y, p.x);
          float swirl = sin(angle * 3.0 + uTime * 0.9 + r * 5.0) * 0.5 + 0.5;
          float rays = sin(angle * 7.0 - uTime * 1.6) * 0.5 + 0.5;
          rays *= sin(uTime * 2.4 + r * 9.0) * 0.5 + 0.5;
          float core = pow(1.0 - r, 2.5);
          core *= 0.6 + 0.4 * sin(uTime * 4.0);
          float n = noise(vec2(p.x * 5.0 + uTime * 0.4, p.y * 5.0 - uTime * 0.6));

          vec3 col = mix(uColorB, uColorA, swirl);
          col += uColorA * rays * 0.55;
          col += uColorA * core * 1.4;
          col += uColorA * n * 0.2;
          float rim = smoothstep(0.85, 1.0, r) * 1.2;
          col += uColorA * rim * 0.7;

          float alpha = disc * (0.55 + 0.45 * (swirl + rays * 0.4 + core));
          gl_FragColor = vec4(col, alpha);
        }
      `,
    });
  }, [colorA, colorB]);

  // Shimmer animation + claim/release based on player proximity AND
  // whether the player has the key. Without the key the portal is just
  // decorative — no interaction button, no teleport on bow.
  useFrame((state) => {
    // reduceMotion → freeze the shimmer to a static pose. The portal
    // is still visible and clearly clickable, just without the swirling
    // animation.
    if (matRef.current) {
      matRef.current.uniforms.uTime.value = useSettings.getState().reduceMotion
        ? 0
        : state.clock.elapsedTime;
    }

    const g = groupRef.current;
    if (!g) return;
    const dx = playerPosRef.current.x - g.position.x;
    const dz = playerPosRef.current.z - g.position.z;
    const inRange = Math.hypot(dx, dz) < TRIGGER_DISTANCE;
    const unlocked = isUnlocked(requiredKey);
    if (inRange && unlocked) useInteraction.getState().claim(id);
    else useInteraction.getState().release(id);
  });

  // Subscribe to bow trigger; fast-travel only if the player has the
  // key. travel() runs the cinematic fade — fade-to-black, relocate
  // the player to the target region's centre, fade-from-black — so
  // every waypoint hop feels like a dramatic moment rather than a
  // teleport pop.
  useEffect(() => {
    let lastReq = useEmote.getState().requestId;
    const unsub = useEmote.subscribe((s) => {
      if (s.requestId === lastReq) return;
      lastReq = s.requestId;
      if (!isUnlocked(requiredKey)) return;
      // Don't yank the player out of an active conversation.
      if (useDialogue.getState().active) return;
      // Already mid-travel? Don't queue a second one.
      if (useLevel.getState().transitionPhase !== 'idle') return;
      const g = groupRef.current;
      if (!g) return;
      const dx = playerPosRef.current.x - g.position.x;
      const dz = playerPosRef.current.z - g.position.z;
      if (Math.hypot(dx, dz) >= TRIGGER_DISTANCE) return;
      useLevel.getState().travel(targetRegion);
    });
    return unsub;
  }, [id, playerPosRef, targetRegion, requiredKey]);

  // On unmount, drop our claim so a future portal can take over.
  useEffect(() => {
    return () => useInteraction.getState().release(id);
  }, [id]);

  return (
    <group ref={groupRef} position={position}>
      {/* Shimmer disc — always rendered. With texture it sits behind
          the painted card as a halo / glow; without texture it IS the
          portal. */}
      <mesh>
        <circleGeometry args={[radius, 64]} />
        <primitive ref={matRef} object={material} attach="material" />
      </mesh>
      {texture ? <PortalCard texture={texture} height={height} /> : null}
    </group>
  );
}

// Painted portal card. Same iso-facing rotation Relic.tsx uses so
// portal art and relic art share visual orientation. Additive blend
// so the magenta-on-black source PNGs read with their black backdrop
// turning fully transparent. No depthWrite so the card layers cleanly
// against the shimmer disc behind it.
function PortalCard({ texture, height }: { texture: string; height: number }) {
  const tex = useTexture(texture);

  useEffect(() => {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.anisotropy = 4;
    tex.needsUpdate = true;
  }, [tex]);

  const dims = useMemo(() => {
    const img = tex.image as { width?: number; height?: number } | undefined;
    const aspect = img?.width && img?.height ? img.width / img.height : 1.3;
    const h = height;
    const w = h * aspect;
    return { w, h };
  }, [tex, height]);

  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        toneMapped: false,
      }),
    [tex],
  );

  useEffect(() => {
    return () => {
      material.dispose();
    };
  }, [material]);

  // Card centre is at the portal's pivot height (which the parent
  // mounts at the disc's centre — typically y=2.4 in the spawn). We
  // shift the card UP by half its height so the BOTTOM of the arch
  // sits at ground level rather than floating mid-air.
  return (
    <mesh
      position={[0, dims.h / 2 - 2.4, 0]}
      rotation={[0, FACE_CAMERA_Y, 0]}
    >
      <planeGeometry args={[dims.w, dims.h]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

// `requiredKey` undefined → fall back to the legacy any-key check
// (`hasKey`) so the original Lysningen→Stjerneengen portal still
// unlocks via the digger's gift. If specified, the player must have
// that exact key in their inventory.
function isUnlocked(requiredKey: RegionId | undefined): boolean {
  const g = useGame.getState();
  if (requiredKey === undefined) return g.hasKey;
  return g.keys.includes(requiredKey);
}
