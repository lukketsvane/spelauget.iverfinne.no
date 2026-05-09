'use client';

import { Canvas } from '@react-three/fiber';
import { Suspense } from 'react';
import * as THREE from 'three';
import Scene from './Scene';
import HUD from '@/hud/HUD';
import EmoteButton from '@/hud/EmoteButton';
import PointerInput from './PointerInput';
import KeyboardInput from './KeyboardInput';

export default function Game() {
  return (
    <>
      <Canvas
        shadows={{ type: THREE.PCFSoftShadowMap, enabled: true }}
        dpr={[1, 2]}
        gl={{
          antialias: true,
          powerPreference: 'high-performance',
        }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.NoToneMapping;
          gl.outputColorSpace = THREE.SRGBColorSpace;
          gl.setClearColor('#ffffff', 1);
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
    </>
  );
}
