'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrthographicCamera } from '@react-three/drei';
import * as THREE from 'three';
import Character from './Character';
import Ground from './Ground';
import Plants from './Plants';
import Underbrush from './Underbrush';
import Particles from './Particles';
import Spawns from './Spawns';
import ExposureSync from './ExposureSync';
import { CAMERA } from './config';
import { useInput } from '@/store/input';
import { dayBrightness, dayHueAngle, dayPhase } from './dayCycle';
import { setGradientTexture, updateGradientUniforms } from './gradients';
import { WORLD_SPAWNS } from './levels';
import { makeRegionGradientTexture } from './regions';
import { useLevel } from '@/store/level';
import { useTuner } from '@/store/tuner';

const LIGHT_OFFSET = new THREE.Vector3(8, 14, 6);

// Default background / fog tint — used as a fallback only; the
// per-region fog config now lives in useTuner.fogByRegion so the
// dev tuner panel can edit it live.
const NIGHT = '#1a1230';

// The day/night cycle changes brightness over a 10-minute period, i.e.
// the visible delta per frame is microscopic. Quantising the uniform
// writes to ~4 Hz drops 56 redundant updates per second across plant /
// ground / halo materials with no visible difference. The 250 ms tick
// is small enough that hue/brightness still feels continuous.
const DAY_CYCLE_INTERVAL_MS = 250;

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
  // Last wall-clock time the day-cycle uniforms were updated. Tested
  // each frame so we can quantise to DAY_CYCLE_INTERVAL_MS without a
  // separate setInterval and its own timer drift.
  const lastDayUpdateRef = useRef(0);

  const { size, gl, scene } = useThree();

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
    // Desktop gets a tighter frustum for a more cinematic, zoomed-in
    // shot; small screens stay wider so the player still sees enough
    // of the world to navigate on a phone.
    const v =
      size.width >= CAMERA.desktopBreakpoint
        ? CAMERA.viewSizeDesktop
        : CAMERA.viewSize;
    cam.left = (-v * aspect) / 2;
    cam.right = (v * aspect) / 2;
    cam.top = v / 2;
    cam.bottom = -v / 2;
    cam.updateProjectionMatrix();
    setCamera(cam);
  }, [size.width, size.height, setCamera]);

  // No-plant bubbles around every NPC / prop so the digging character,
  // huts, rocks, etc. always have a clean ring of bare ground around
  // them. Recomputed when the active region's spawn list changes so
  // a brand-new empty world doesn't carry over Hagen's exclusion
  // bubbles.
  const regionId = useLevel((s) => s.currentRegionId);
  const plantExclusions = useMemo(() => {
    const spawns = WORLD_SPAWNS[regionId] ?? [];
    return spawns
      .filter(
        (s) =>
          s.kind === 'star_npc' ||
          s.kind === 'boble_npc' ||
          s.kind === 'stone_hut' ||
          s.kind === 'rock_stack' ||
          s.kind === 'trilo' ||
          s.kind === 'relic' ||
          s.kind === 'remnant' ||
          s.kind === 'car' ||
          s.kind === 'car_portal' ||
          s.kind === 'portal' ||
          s.kind === 'glowing_purple_coral' ||
          s.kind === 'neon_vascular_tree' ||
          s.kind === 'purple_coral' ||
          s.kind === 'purple_coral_alt' ||
          s.kind === 'purple_stone_cairn' ||
          s.kind === 'tangled_root_sculpture' ||
          s.kind === 'crystal_altar',
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
                : s.kind === 'car' || s.kind === 'car_portal'
                  ? 4.5
                  : s.kind === 'portal'
                    ? 4
                    : s.kind === 'relic' || s.kind === 'remnant'
                      ? 2.5
                      : s.kind === 'crystal_altar'
                        ? 3.5
                        : 3;
        return { x: s.position[0], z: s.position[1], r };
      });
  }, [regionId]);
  // Build the four region-blended 2D gradient textures once at mount;
  // every gradient-mapped surface samples them via the registry. The
  // textures are immutable for the lifetime of the world (palettes
  // are baked at build time).
  useEffect(() => {
    const g = makeRegionGradientTexture('ground');
    const p = makeRegionGradientTexture('plant');
    const h = makeRegionGradientTexture('halo');
    const r = makeRegionGradientTexture('relic');
    setGradientTexture('ground', g);
    setGradientTexture('plant', p);
    setGradientTexture('halo', h);
    setGradientTexture('relic', r);
    return () => {
      g.dispose();
      p.dispose();
      h.dispose();
      r.dispose();
    };
  }, []);

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
    // night reads cool and dim — synced across all clients. Throttled
    // to ~4 Hz: the cycle's per-frame delta is invisible at 60 fps and
    // recomputing brightness/hue + writing to every gradient material
    // each frame is pure waste.
    const now = performance.now();
    if (now - lastDayUpdateRef.current >= DAY_CYCLE_INTERVAL_MS) {
      lastDayUpdateRef.current = now;
      const phase = dayPhase();
      const brightness = dayBrightness(phase);
      const hue = dayHueAngle(phase);
      updateGradientUniforms(hue, brightness);

      if (ambientRef.current) ambientRef.current.intensity = 1.7 * brightness;
      if (hemisphereRef.current) hemisphereRef.current.intensity = 1.4 * brightness;
      if (light) light.intensity = 1.7 * brightness;

      // Fog tint + distance follows the active region. Day-cycle
      // brightness multiplies the base colour so each region still
      // breathes with the noon/midnight cycle. Fog near/far updates
      // every cycle tick too — switching region snaps to that
      // region's mist density without a fade (visually OK because
      // region transitions already happen behind the fade-to-black).
      if (fogRef.current) {
        const fogByRegion = useTuner.getState().fogByRegion;
        const regionId = useLevel.getState().currentRegionId;
        const atmos = fogByRegion[regionId] ?? {
          color: NIGHT,
          near: 40,
          far: 95,
        };
        const tint = 0.6 + 0.8 * brightness;
        dayColor.current.set(atmos.color).multiplyScalar(tint);
        fogRef.current.color.copy(dayColor.current);
        fogRef.current.near = atmos.near;
        fogRef.current.far = atmos.far;
        // Background: same colour family as fog so the horizon line
        // disappears. set() reuses the THREE.Color object from
        // dayColor — assigning it to scene.background overrides the
        // <color attach="background"> set at mount time.
        if (scene.background instanceof THREE.Color) {
          scene.background.copy(dayColor.current);
        } else {
          scene.background = dayColor.current.clone();
        }
      }
    }
  });

  return (
    <>
      {/* Atmospheric fog: distant trees fade into the sky. Colour is
          updated each frame so it follows the day/night tint. */}
      <fog ref={fogRef} attach="fog" args={[NIGHT, 40, 95]} />
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
      <ambientLight ref={ambientRef} intensity={0.7} color="#7060a0" />
      <hemisphereLight ref={hemisphereRef} args={['#9a78d0', '#1a1230', 0.8]} />
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
      <Underbrush playerPosRef={characterPos} exclusions={plantExclusions} />
      <Plants playerPosRef={characterPos} exclusions={plantExclusions} />
      <Particles playerPosRef={characterPos} />
      <Spawns playerPosRef={characterPos} />
      <Character positionRef={characterPos} />
      <ExposureSync />
    </>
  );
}
