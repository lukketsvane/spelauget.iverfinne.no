'use client';

import { useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// Floating glowy dust around the player. Additive blending + a soft
// radial alpha makes them read as bright pinpricks of light against the
// dark scene; bloom pass turns them into proper bokeh-style sparkles.
const COUNT = 350;
const RADIUS = 24; // metres from player at which particles cycle
const MIN_HEIGHT = 0.2;
const MAX_HEIGHT = 6;
const PALETTE = ['#ffd5e8', '#a4d8ff', '#e0c0ff', '#ffffff', '#ff9bd6'];

type Props = { playerPosRef: MutableRefObject<THREE.Vector3> };

export default function Particles({ playerPosRef }: Props) {
  const pointsRef = useRef<THREE.Points>(null);

  // Build initial buffers + per-particle drift velocities once.
  const { geometry, drifts } = useMemo(() => {
    const positions = new Float32Array(COUNT * 3);
    const colors = new Float32Array(COUNT * 3);
    const sizes = new Float32Array(COUNT);
    const drift = new Float32Array(COUNT * 3);

    const tmp = new THREE.Color();
    for (let i = 0; i < COUNT; i++) {
      // Random point inside a disc, height anywhere in band.
      const angle = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * RADIUS;
      positions[i * 3 + 0] = Math.cos(angle) * r;
      positions[i * 3 + 1] = MIN_HEIGHT + Math.random() * (MAX_HEIGHT - MIN_HEIGHT);
      positions[i * 3 + 2] = Math.sin(angle) * r;

      tmp.set(PALETTE[Math.floor(Math.random() * PALETTE.length)]);
      // HDR-ish boost so bloom picks them up reliably.
      const boost = 1.6 + Math.random() * 0.8;
      colors[i * 3 + 0] = tmp.r * boost;
      colors[i * 3 + 1] = tmp.g * boost;
      colors[i * 3 + 2] = tmp.b * boost;

      sizes[i] = 0.05 + Math.random() * 0.12;

      drift[i * 3 + 0] = (Math.random() - 0.5) * 0.18;
      drift[i * 3 + 1] = 0.08 + Math.random() * 0.32;
      drift[i * 3 + 2] = (Math.random() - 0.5) * 0.18;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    return { geometry: geo, drifts: drift };
  }, []);

  // Soft radial sprite — drawn once into a canvas, reused for every point.
  const dotMap = useMemo(makeSoftDot, []);

  const material = useMemo(() => {
    return new THREE.PointsMaterial({
      size: 0.45,
      map: dotMap,
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
      toneMapped: false, // keep HDR colours so bloom can lift them
    });
  }, [dotMap]);

  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);

  useFrame((_, dt) => {
    const px = playerPosRef.current.x;
    const pz = playerPosRef.current.z;
    const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute;
    const arr = posAttr.array as Float32Array;

    for (let i = 0; i < COUNT; i++) {
      arr[i * 3 + 0] += drifts[i * 3 + 0] * dt;
      arr[i * 3 + 1] += drifts[i * 3 + 1] * dt;
      arr[i * 3 + 2] += drifts[i * 3 + 2] * dt;

      const dx = arr[i * 3 + 0] - px;
      const dz = arr[i * 3 + 2] - pz;
      const dist = Math.hypot(dx, dz);
      // Recycle when out of disc or above ceiling — respawn in a fresh
      // random spot near the player so the air always looks alive.
      if (dist > RADIUS || arr[i * 3 + 1] > MAX_HEIGHT) {
        const angle = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random()) * RADIUS;
        arr[i * 3 + 0] = px + Math.cos(angle) * r;
        arr[i * 3 + 1] = MIN_HEIGHT;
        arr[i * 3 + 2] = pz + Math.sin(angle) * r;
      }
    }
    posAttr.needsUpdate = true;
  });

  return <points ref={pointsRef} geometry={geometry} material={material} frustumCulled={false} />;
}

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
