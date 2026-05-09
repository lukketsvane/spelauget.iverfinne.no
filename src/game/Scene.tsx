'use client';

import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrthographicCamera } from '@react-three/drei';
import * as THREE from 'three';
import Character from './Character';
import Ground from './Ground';
import Plants from './Plants';
import { CAMERA } from './config';

// Direction the key light points (toward the ground from above-right).
const LIGHT_OFFSET = new THREE.Vector3(8, 14, 6);

export default function Scene() {
  const camRef = useRef<THREE.OrthographicCamera>(null);
  const lightRef = useRef<THREE.DirectionalLight>(null);
  const lightTargetRef = useRef<THREE.Object3D>(new THREE.Object3D());
  const target = useRef(new THREE.Vector3());
  const { size } = useThree();

  // Anchor that the character writes its position into each frame.
  const characterPos = useRef(new THREE.Vector3());

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

    // Make the shadow-casting light follow the player. Shadow map covers a
    // small area at high res, so it must travel with the action.
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
  });

  const aspect = size.width / size.height;
  const viewSize = CAMERA.viewSize;

  return (
    <>
      <OrthographicCamera
        ref={camRef}
        makeDefault
        left={(-viewSize * aspect) / 2}
        right={(viewSize * aspect) / 2}
        top={viewSize / 2}
        bottom={-viewSize / 2}
        near={-100}
        far={200}
        position={[CAMERA.offset.x, CAMERA.offset.y, CAMERA.offset.z]}
      />

      {/* Bright ambient gives the "paper white" look; one directional key
          provides the single hard cast shadow seen in the reference art. */}
      <ambientLight intensity={1.1} />
      <hemisphereLight args={['#ffffff', '#e6e6e6', 0.4]} />
      <directionalLight
        ref={lightRef}
        position={[LIGHT_OFFSET.x, LIGHT_OFFSET.y, LIGHT_OFFSET.z]}
        intensity={1.4}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-18}
        shadow-camera-right={18}
        shadow-camera-top={18}
        shadow-camera-bottom={-18}
        shadow-camera-near={0.1}
        shadow-camera-far={60}
        shadow-bias={-0.0005}
        target={lightTargetRef.current}
      />
      <primitive object={lightTargetRef.current} />

      <Ground />
      <Plants />
      <Character positionRef={characterPos} />
    </>
  );
}
