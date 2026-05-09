'use client';

import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrthographicCamera } from '@react-three/drei';
import * as THREE from 'three';
import Character from './Character';
import Ground from './Ground';
import { CAMERA } from './config';

export default function Scene() {
  const camRef = useRef<THREE.OrthographicCamera>(null);
  const target = useRef(new THREE.Vector3());
  const { size } = useThree();

  // Anchor that the character writes its position into each frame.
  const characterPos = useRef(new THREE.Vector3());

  useFrame(() => {
    const cam = camRef.current;
    if (!cam) return;
    target.current.lerp(characterPos.current, CAMERA.followLerp);
    cam.position.set(
      target.current.x + CAMERA.offset.x,
      target.current.y + CAMERA.offset.y,
      target.current.z + CAMERA.offset.z,
    );
    cam.lookAt(target.current);
  });

  // Ortho frustum sized for a comfortable iso view; scale by viewport aspect.
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

      {/* Bright ambient + a key light from above-right that casts a hard shadow.
          Keeping ambient strong is what gives the "white room with one cast shadow" look. */}
      <ambientLight intensity={1.1} />
      <hemisphereLight args={['#ffffff', '#e6e6e6', 0.4]} />
      <directionalLight
        position={[8, 14, 6]}
        intensity={1.4}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
        shadow-camera-near={0.1}
        shadow-camera-far={50}
        shadow-bias={-0.0005}
      />

      <Ground />
      <Character positionRef={characterPos} />
    </>
  );
}
