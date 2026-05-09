'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrthographicCamera } from '@react-three/drei';
import * as THREE from 'three';
import Character from './Character';
import Ground from './Ground';
import Plants from './Plants';
import Particles from './Particles';
import Spawns from './Spawns';
import { CAMERA } from './config';
import { useInput } from '@/store/input';
import { dayBrightness, dayHueAngle, dayPhase } from './dayCycle';
import { makeGradientTexture, setGradientTexture, updateGradientUniforms } from './gradients';
import { LEVELS } from './levels';
import { useLevel } from '@/store/level';

const LIGHT_OFFSET = new THREE.Vector3(8, 14, 6);

// Background colour and fog match — distant geometry blends into the
// horizon for a deeper, more atmospheric feel.
const NIGHT = '#0a0418';

export default function Scene() {
  const camRef = useRef<THREE.OrthographicCamera>(null);
  const lightRef = useRef<THREE.DirectionalLight>(null);
  const ambientRef = useRef<THREE.AmbientLight>(null);
  const hemisphereRef = useRef<THREE.HemisphereLight>(null);
  const fogRef = useRef<THREE.Fog>(null);
  const lightTargetRef = useRef<THREE.Object3D>(new THREE.Object3D());
  const target = useRef(new THREE.Vector3());
  const characterPos = useRef(new THREE.Vector3());

  // Reusable colour scratch — avoid GC churn on the hot path.
  const dayColor = useRef(new THREE.Color(NIGHT));

  const { size, gl } = useThree();

  const setCamera = useInput((s) => s.setCamera);
  const setCanvasEl = useInput((s) => s.setCanvasEl);
  useEffect(() => {
    setCanvasEl(gl.domElement);
    return () => setCanvasEl(null);
  }, [gl.domElement, setCanvasEl]);

  useEffect(() => {
    const cam = camRef.current;
    if (!cam) return;
    const aspect = size.width / Math.max(1, size.height);
    const v = CAMERA.viewSize;
    cam.left = (-v * aspect) / 2;
    cam.right = (v * aspect) / 2;
    cam.top = v / 2;
    cam.bottom = -v / 2;
    cam.updateProjectionMatrix();
    setCamera(cam);
  }, [size.width, size.height, setCamera]);

  // Swap gradient textures whenever the level changes. Subscribing
  // imperatively avoids React state for the gradient (uniform writes
  // are GPU-only side effects). Initial mount also runs once so the
  // active palette is applied even on first render.
  const currentLevelId = useLevel((s) => s.currentLevelId);

  // No-plant bubbles around every NPC / prop so the digging character,
  // huts, rocks, etc. always have a clean ring of bare ground around
  // them. Recomputed when the level changes; Plants.tsx clears its
  // chunk cache on this change.
  const plantExclusions = useMemo(() => {
    const def = LEVELS[currentLevelId];
    return def.spawns
      .filter(
        (s) =>
          s.kind === 'star_npc' ||
          s.kind === 'boble_npc' ||
          s.kind === 'stone_hut' ||
          s.kind === 'rock_stack' ||
          s.kind === 'trilo' ||
          s.kind === 'relic' ||
          s.kind === 'car' ||
          s.kind === 'portal',
      )
      .map((s) => {
        // Rough per-kind clearance radius. Big NPCs get the widest ring.
        const r =
          s.kind === 'star_npc'
            ? 6
            : s.kind === 'boble_npc'
              ? 5
              : s.kind === 'stone_hut'
                ? 7
                : s.kind === 'car'
                  ? 4.5
                  : s.kind === 'portal'
                    ? 4
                    : s.kind === 'relic'
                      ? 2.5
                      : 3.5;
        return { x: s.position[0], z: s.position[1], r };
      });
  }, [currentLevelId]);
  useEffect(() => {
    const def = LEVELS[currentLevelId];
    const g = makeGradientTexture(def.groundGradient);
    const p = makeGradientTexture(def.plantGradient);
    const h = makeGradientTexture(def.plantHaloGradient);
    const r = makeGradientTexture(def.relicGradient);
    setGradientTexture('ground', g);
    setGradientTexture('plant', p);
    setGradientTexture('plant_halo', h);
    setGradientTexture('relic', r);
    return () => {
      g.dispose();
      p.dispose();
      h.dispose();
      r.dispose();
    };
  }, [currentLevelId]);

  useFrame(() => {
    target.current.lerp(characterPos.current, CAMERA.followLerp);

    const cam = camRef.current;
    if (cam) {
      cam.position.set(
        target.current.x + CAMERA.offset.x,
        target.current.y + CAMERA.offset.y,
        target.current.z + CAMERA.offset.z,
      );
      cam.lookAt(target.current);
    }

    const light = lightRef.current;
    if (light) {
      light.position.set(
        target.current.x + LIGHT_OFFSET.x,
        target.current.y + LIGHT_OFFSET.y,
        target.current.z + LIGHT_OFFSET.z,
      );
      lightTargetRef.current.position.copy(target.current);
      lightTargetRef.current.updateMatrixWorld();
    }

    // 10-minute UTC-synced day/night cycle. Drives gradient uniforms and
    // the analog scene lights together so day reads bright and warm,
    // night reads cool and dim — synced across all clients.
    const phase = dayPhase();
    const brightness = dayBrightness(phase);
    const hue = dayHueAngle(phase);
    updateGradientUniforms(hue, brightness);

    if (ambientRef.current) ambientRef.current.intensity = 1.1 * brightness;
    if (hemisphereRef.current) hemisphereRef.current.intensity = 0.95 * brightness;
    if (light) light.intensity = 1.4 * brightness;

    // Fog tint follows the cycle so distant geometry blends into a sky
    // that matches the current "time of day".
    if (fogRef.current) {
      // 0.6 darker at midnight, 1.4 brighter at noon — relative to base.
      const tint = 0.6 + 0.8 * brightness;
      dayColor.current.set(NIGHT).multiplyScalar(tint);
      fogRef.current.color.copy(dayColor.current);
    }
  });

  return (
    <>
      {/* Atmospheric fog: distant trees fade into the sky. Colour is
          updated each frame so it follows the day/night tint. */}
      <fog ref={fogRef} attach="fog" args={[NIGHT, 24, 60]} />
      <color attach="background" args={[NIGHT]} />

      <OrthographicCamera
        ref={camRef}
        makeDefault
        manual
        near={-100}
        far={200}
        position={[CAMERA.offset.x, CAMERA.offset.y, CAMERA.offset.z]}
      />

      {/* Cool low ambient + violet hemisphere = night gloom. Intensities
          are mutated each frame by the day-cycle loop above. */}
      <ambientLight ref={ambientRef} intensity={0.45} color="#5a4a8a" />
      <hemisphereLight ref={hemisphereRef} args={['#7c5fb8', '#0a0418', 0.55]} />
      <directionalLight
        ref={lightRef}
        position={[LIGHT_OFFSET.x, LIGHT_OFFSET.y, LIGHT_OFFSET.z]}
        intensity={0.85}
        color="#cdb6ff"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-22}
        shadow-camera-right={22}
        shadow-camera-top={22}
        shadow-camera-bottom={-22}
        shadow-camera-near={0.1}
        shadow-camera-far={70}
        shadow-bias={-0.0005}
        target={lightTargetRef.current}
      />
      <primitive object={lightTargetRef.current} />

      <Ground />
      <Plants playerPosRef={characterPos} exclusions={plantExclusions} />
      <Particles playerPosRef={characterPos} />
      <Spawns playerPosRef={characterPos} />
      <Character positionRef={characterPos} />
    </>
  );
}
