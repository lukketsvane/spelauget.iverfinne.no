'use client';

import { useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useInput } from '@/store/input';

// Pool of small "dust puff" sprites that spawn under the character's
// feet while they're moving. Each puff fades + expands over its short
// life and gets recycled — fixed-size BufferGeometry means zero
// allocations on the hot path.
//
// Tuned for the iso pixel-art look: puffs sit just above ground (y ≈
// 0.05 m), additive-blend over the gradient-mapped ground, and read as
// soft pinkish glints rather than sharp dust clumps.

const POOL_SIZE = 24;
const PUFF_LIFE = 0.85; // seconds
const SPAWN_INTERVAL = 0.18; // seconds between puffs while moving
const PUFF_BASE_SIZE = 0.55;
const PUFF_GROW = 0.55; // additional size at end of life
const Y_BASE = 0.05;

type Puff = {
  x: number;
  z: number;
  age: number; // seconds since spawn; -1 means slot is free
  jitterX: number;
  jitterZ: number;
};

type Props = { playerPosRef: MutableRefObject<THREE.Vector3> };

export default function Footsteps({ playerPosRef }: Props) {
  const pointsRef = useRef<THREE.Points>(null);
  const puffsRef = useRef<Puff[]>(
    Array.from({ length: POOL_SIZE }, () => ({
      x: 0,
      z: 0,
      age: -1,
      jitterX: 0,
      jitterZ: 0,
    })),
  );
  const sinceLastSpawnRef = useRef(0);

  const dotMap = useMemo(makeSoftDot, []);

  // Static-size buffers — we mutate position / size / opacity per
  // frame and signal needsUpdate, never reallocate.
  const geometry = useMemo(() => {
    const positions = new Float32Array(POOL_SIZE * 3);
    const sizes = new Float32Array(POOL_SIZE);
    const opacities = new Float32Array(POOL_SIZE);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute('opacity', new THREE.BufferAttribute(opacities, 1));
    geo.setDrawRange(0, POOL_SIZE);
    return geo;
  }, []);

  // Custom shader so we can fade individual puffs out via per-vertex
  // opacity. PointsMaterial doesn't support per-point opacity natively.
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      uniforms: {
        uMap: { value: dotMap },
      },
      vertexShader: /* glsl */ `
        attribute float size;
        attribute float opacity;
        varying float vOpacity;
        void main() {
          vOpacity = opacity;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          // Size attenuation matched to PointsMaterial sizeAttenuation:true.
          gl_PointSize = size * (300.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap;
        varying float vOpacity;
        void main() {
          vec4 tex = texture2D(uMap, gl_PointCoord);
          // Soft pinkish puff colour. Multiplied by per-puff opacity.
          gl_FragColor = vec4(vec3(1.0, 0.86, 0.94) * tex.a, tex.a * vOpacity);
        }
      `,
    });
  }, [dotMap]);

  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);

  useFrame((_, dt) => {
    const puffs = puffsRef.current;
    const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute;
    const sizeAttr = geometry.getAttribute('size') as THREE.BufferAttribute;
    const opAttr = geometry.getAttribute('opacity') as THREE.BufferAttribute;
    const posArr = posAttr.array as Float32Array;
    const sizeArr = sizeAttr.array as Float32Array;
    const opArr = opAttr.array as Float32Array;

    // Spawn cadence: count time since last spawn, then drop a puff if
    // the player is actually moving. Reading useInput.moveX/Y tells us
    // both keyboard and pointer-driven motion.
    sinceLastSpawnRef.current += dt;
    const input = useInput.getState();
    const moving = Math.hypot(input.moveX, input.moveY) > 0.05 || input.destination !== null;
    if (moving && sinceLastSpawnRef.current >= SPAWN_INTERVAL) {
      sinceLastSpawnRef.current = 0;
      // Find a free slot (or recycle the oldest one).
      let slot = -1;
      let oldestAge = -Infinity;
      for (let i = 0; i < POOL_SIZE; i++) {
        if (puffs[i].age < 0) {
          slot = i;
          break;
        }
        if (puffs[i].age > oldestAge) {
          oldestAge = puffs[i].age;
          slot = i;
        }
      }
      if (slot >= 0) {
        const p = puffs[slot];
        p.x = playerPosRef.current.x;
        p.z = playerPosRef.current.z;
        p.jitterX = (Math.random() - 0.5) * 0.4;
        p.jitterZ = (Math.random() - 0.5) * 0.4;
        p.age = 0;
      }
    }

    // Step every puff and write into the buffers. Inactive slots get
    // zero opacity so they're invisible, no need for a draw-range
    // dance.
    for (let i = 0; i < POOL_SIZE; i++) {
      const p = puffs[i];
      if (p.age < 0) {
        opArr[i] = 0;
        continue;
      }
      p.age += dt;
      if (p.age >= PUFF_LIFE) {
        p.age = -1;
        opArr[i] = 0;
        continue;
      }
      const t = p.age / PUFF_LIFE;
      // Quick rise to full opacity, slow fade-out — feels more like
      // settling dust than a flash-pop.
      const fade = Math.max(0, 1 - t * t);
      const grow = PUFF_BASE_SIZE + PUFF_GROW * t;
      const drift = t * 0.4;
      posArr[i * 3 + 0] = p.x + p.jitterX * drift;
      posArr[i * 3 + 1] = Y_BASE + t * 0.25;
      posArr[i * 3 + 2] = p.z + p.jitterZ * drift;
      sizeArr[i] = grow * 60; // tuned for size-attenuation pixel-size
      opArr[i] = fade * 0.55;
    }
    posAttr.needsUpdate = true;
    sizeAttr.needsUpdate = true;
    opAttr.needsUpdate = true;
  });

  return <points ref={pointsRef} geometry={geometry} material={material} frustumCulled={false} />;
}

// Reused soft-radial alpha sprite. Same approach as Particles.tsx but
// inlined here to avoid a circular import; the sprite is cheap (one
// 64×64 canvas).
function makeSoftDot(): THREE.Texture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.Texture();
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.45, 'rgba(255,255,255,0.35)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  return tex;
}
