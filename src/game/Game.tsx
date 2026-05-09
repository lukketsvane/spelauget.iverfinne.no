'use client';

import { Canvas } from '@react-three/fiber';
import { Suspense } from 'react';
import * as THREE from 'three';
import Scene from './Scene';
import HUD from '@/hud/HUD';
import EmoteButton from '@/hud/EmoteButton';
import Dialogue from '@/hud/Dialogue';
import PointerInput from './PointerInput';
import KeyboardInput from './KeyboardInput';
import ServiceWorker from './ServiceWorker';

export default function Game() {
  return (
    <>
      <Canvas
        shadows={{ type: THREE.PCFSoftShadowMap, enabled: true }}
        // dpr < 1 renders the scene to a smaller framebuffer; the canvas
        // is then stretched up to fit the layout via CSS image-rendering:
        // pixelated, giving a crisp pixel-art upscale. 0.3 ≈ 1/3 the CSS
        // pixel size — chunky pixels even at 100 % browser zoom.
        dpr={0.3}
        gl={{
          antialias: false,
          powerPreference: 'high-performance',
        }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.0;
          gl.outputColorSpace = THREE.SRGBColorSpace;
          gl.setClearColor('#0a0418', 1);
        }}
        camera={{ position: [10, 10, 10], near: 0.1, far: 200 }}
      >
        <Suspense fallback={null}>
          <Scene />
        </Suspense>
      </Canvas>
      <KeyboardInput />
      <HUD />
      <PointerInput />
      <EmoteButton />
      <Dialogue />
      <ServiceWorker />
    </>
  );
}
