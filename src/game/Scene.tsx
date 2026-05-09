'use client';

import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrthographicCamera } from '@react-three/drei';
import * as THREE from 'three';
import Character from './Character';
import Ground from './Ground';
import Plants from './Plants';
import { CAMERA } from './config';
import { useInput } from '@/store/input';

const LIGHT_OFFSET = new THREE.Vector3(8, 14, 6);

export default function Scene() {
  const camRef = useRef<THREE.OrthographicCamera>(null);
  const lightRef = useRef<THREE.DirectionalLight>(null);
  const lightTargetRef = useRef<THREE.Object3D>(new THREE.Object3D());
  const target = useRef(new THREE.Vector3());
  const characterPos = useRef(new THREE.Vector3());

  const { size, gl } = useThree();

  // Push the camera + canvas element into the input store so the HTML
  // pointer overlay can raycast tap positions to the ground plane.
  const setCamera = useInput((s) => s.setCamera);
  const setCanvasEl = useInput((s) => s.setCanvasEl);
  useEffect(() => {
    setCanvasEl(gl.domElement);
    return () => setCanvasEl(null);
  }, [gl.domElement, setCanvasEl]);

  // Imperatively rebuild the orthographic frustum on every resize and
  // expose the camera. Without this update the projection stays locked
  // to the initial aspect ratio and the scene squeezes when the window
  // changes shape.
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
  });

  return (
    <>
      <OrthographicCamera
        ref={camRef}
        makeDefault
        manual
        near={-100}
        far={200}
        position={[CAMERA.offset.x, CAMERA.offset.y, CAMERA.offset.z]}
      />

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
      <Plants playerPosRef={characterPos} />
      <Character positionRef={characterPos} />
    </>
  );
}
