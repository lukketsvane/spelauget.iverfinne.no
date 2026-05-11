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
import TeleportOverlay from '@/hud/TeleportOverlay';
import MenuHotkey from '@/hud/MenuHotkey';
import TravelHotkey from '@/hud/TravelHotkey';
import FpsOverlay from '@/hud/FpsOverlay';
import ToastHost from '@/hud/ToastHost';
import VoiceHost from '@/hud/VoiceHost';
import GradientTuner from '@/hud/GradientTuner';
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
        // pixel-art upscale. 0.45 is a touch finer than the original 0.3
        // — enough that small details (NPC eyes, plant edges) read
        // crisp without losing the chunky pixel-art identity.
        dpr={0.45}
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
          <ToastHost />
          {/* Dev-only palette + fog tuner. Strip before shipping. */}
          <GradientTuner />
        </>
      )}

      {!inGame && <MainMenu />}

      <BlackOverlay />
      <TeleportOverlay />
      <MenuHotkey />
      <TravelHotkey />
      <FpsOverlay />
      <BackgroundMusic />
      <VoiceHost />
      <ServiceWorker />
    </>
  );
}
