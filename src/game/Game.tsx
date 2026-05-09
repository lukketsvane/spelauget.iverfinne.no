'use client';

import { Canvas } from '@react-three/fiber';
import { Suspense } from 'react';
import * as THREE from 'three';
import Scene from './Scene';
import HUD from '@/hud/HUD';
import EmoteButton from '@/hud/EmoteButton';
import Dialogue from '@/hud/Dialogue';
import LevelLabel from '@/hud/LevelLabel';
import MainMenu from '@/hud/MainMenu';
import PauseMenuButton from '@/hud/PauseMenuButton';
import BlackOverlay from '@/hud/BlackOverlay';
import PointerInput from './PointerInput';
import KeyboardInput from './KeyboardInput';
import BackgroundMusic from './BackgroundMusic';
import ServiceWorker from './ServiceWorker';
import { useMenu } from '@/store/menu';

export default function Game() {
  const inGame = useMenu((s) => s.inGame);
  return (
    <>
      {/* Canvas is mounted from the start so heavy assets (GLBs, textures)
          can preload while the menu is on screen. The MainMenu overlay
          covers it and intercepts pointer events until the player picks
          New Game / Continue. */}
      <Canvas
        shadows={{ type: THREE.PCFSoftShadowMap, enabled: true }}
        // dpr < 1 renders to a smaller framebuffer; the canvas is then
        // stretched up via CSS image-rendering: pixelated for the crisp
        // pixel-art upscale.
        dpr={0.3}
        gl={{ antialias: false, powerPreference: 'high-performance' }}
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

      {/* In-game HUD only renders once the menu is dismissed. */}
      {inGame && (
        <>
          <KeyboardInput />
          <HUD />
          <PointerInput />
          <EmoteButton />
          <Dialogue />
          <LevelLabel />
          <PauseMenuButton />
        </>
      )}

      {!inGame && <MainMenu />}

      <BlackOverlay />
      <BackgroundMusic />
      <ServiceWorker />
    </>
  );
}
