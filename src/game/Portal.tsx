'use client';

import { useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useEmote } from '@/store/emote';
import { useGame } from '@/store/game';
import { useInteraction } from '@/store/interaction';
import { useLevel } from '@/store/level';
import { useSettings } from '@/store/settings';
import type { LevelId } from './levels';

const TRIGGER_DISTANCE = 3.6;

type Props = {
  id: string;
  position: [number, number, number];
  radius?: number;
  colorA?: string;
  colorB?: string;
  targetLevel: LevelId;
  playerPosRef: MutableRefObject<THREE.Vector3>;
};

// Vertical disc with an animated shimmer / glance shader. Bow within
// range to teleport to `targetLevel`.
export default function Portal({
  id,
  position,
  radius = 2.2,
  colorA = '#ffd5e8',
  colorB = '#7a4cff',
  targetLevel,
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
    const hasKey = useGame.getState().hasKey;
    if (inRange && hasKey) useInteraction.getState().claim(id);
    else useInteraction.getState().release(id);
  });

  // Subscribe to bow trigger; teleport only if the player has the key.
  // teleport() runs the cinematic fade — fade-to-black, swap level
  // mid-cover, fade-from-black — so the world transition reads as a
  // dramatic moment rather than an instant pop.
  useEffect(() => {
    let lastReq = useEmote.getState().requestId;
    const unsub = useEmote.subscribe((s) => {
      if (s.requestId === lastReq) return;
      lastReq = s.requestId;
      if (!useGame.getState().hasKey) return;
      // Already mid-teleport? Don't queue a second one.
      if (useLevel.getState().transitionPhase !== 'idle') return;
      const g = groupRef.current;
      if (!g) return;
      const dx = playerPosRef.current.x - g.position.x;
      const dz = playerPosRef.current.z - g.position.z;
      if (Math.hypot(dx, dz) >= TRIGGER_DISTANCE) return;
      useLevel.getState().teleport(targetLevel);
    });
    return unsub;
  }, [id, playerPosRef, targetLevel]);

  // On unmount, drop our claim so a future portal can take over.
  useEffect(() => {
    return () => useInteraction.getState().release(id);
  }, [id]);

  return (
    <group ref={groupRef} position={position}>
      <mesh>
        <circleGeometry args={[radius, 64]} />
        <primitive ref={matRef} object={material} attach="material" />
      </mesh>
    </group>
  );
}
