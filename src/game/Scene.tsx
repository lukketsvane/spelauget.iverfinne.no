'use client';

import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrthographicCamera } from '@react-three/drei';
import * as THREE from 'three';
import Character from './Character';
import Ground from './Ground';
import Plants from './Plants';
import Particles from './Particles';
import Portal from './Portal';
import StarNpc from './StarNpc';
import { CAMERA } from './config';
import { useInput } from '@/store/input';
import { dayBrightness, dayHueAngle, dayPhase } from './dayCycle';
import { updateGradientUniforms } from './gradients';

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

    if (ambientRef.current) ambientRef.current.intensity = 0.45 * brightness;
    if (hemisphereRef.current) hemisphereRef.current.intensity = 0.55 * brightness;
    if (light) light.intensity = 0.85 * brightness;

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
      <Plants playerPosRef={characterPos} />
      <Particles playerPosRef={characterPos} />
      <Portal position={[-8, 2.4, -8]} radius={2.2} />
      <StarNpc playerPosRef={characterPos} />
      <Character positionRef={characterPos} />
    </>
  );
}
