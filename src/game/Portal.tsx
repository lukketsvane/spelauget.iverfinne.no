'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

type Props = {
  position?: [number, number, number];
  radius?: number;
  // Two-tone palette for the shimmer; a → centre, b → outer flares.
  colorA?: string;
  colorB?: string;
};

// Vertical disc with an animated shimmer / glance shader. The fragment
// blends a slow rotating swirl with fast radial rays and an outer edge
// glow, all driven by uTime — gives the portal a living, pulsing aura.
export default function Portal({
  position = [10, 2.4, -10],
  radius = 2.2,
  colorA = '#ffd5e8',
  colorB = '#7a4cff',
}: Props) {
  const matRef = useRef<THREE.ShaderMaterial>(null);

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

        // 2D simplex-ish hash for cheap noise.
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
          float r = length(p) * 2.0; // 0 at centre, 1 at edge

          // Discard pixels outside the disc with a soft edge.
          if (r > 1.05) discard;
          float disc = smoothstep(1.0, 0.95, r);

          float angle = atan(p.y, p.x);

          // Slow rotating swirl — primary motion.
          float swirl = sin(angle * 3.0 + uTime * 0.9 + r * 5.0) * 0.5 + 0.5;

          // Faster radial rays sweeping around the centre.
          float rays = sin(angle * 7.0 - uTime * 1.6) * 0.5 + 0.5;
          rays *= sin(uTime * 2.4 + r * 9.0) * 0.5 + 0.5;

          // Centre flicker — short bursts of brightness in the middle.
          float core = pow(1.0 - r, 2.5);
          core *= 0.6 + 0.4 * sin(uTime * 4.0);

          // Drifting noise layer for sparkle.
          float n = noise(vec2(p.x * 5.0 + uTime * 0.4, p.y * 5.0 - uTime * 0.6));

          // Compose colour: swirl picks between palette stops, rays
          // brighten on top, core flares the centre.
          vec3 col = mix(uColorB, uColorA, swirl);
          col += uColorA * rays * 0.55;
          col += uColorA * core * 1.4;
          col += uColorA * n * 0.2;

          // Outer rim emphasis so the boundary glows.
          float rim = smoothstep(0.85, 1.0, r) * 1.2;
          col += uColorA * rim * 0.7;

          float alpha = disc * (0.55 + 0.45 * (swirl + rays * 0.4 + core));
          gl_FragColor = vec4(col, alpha);
        }
      `,
    });
  }, [colorA, colorB]);

  useFrame((state) => {
    if (matRef.current) {
      matRef.current.uniforms.uTime.value = state.clock.elapsedTime;
    }
  });

  return (
    <mesh position={position}>
      <circleGeometry args={[radius, 64]} />
      <primitive ref={matRef} object={material} attach="material" />
    </mesh>
  );
}
