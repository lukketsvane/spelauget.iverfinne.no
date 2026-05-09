'use client';

import { useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, useAnimations } from '@react-three/drei';
import * as THREE from 'three';
import { ANIM, CHARACTER, STARFISH_URL } from './config';
import { useInput } from '@/store/input';

type Props = { positionRef: MutableRefObject<THREE.Vector3> };

export default function Character({ positionRef }: Props) {
  const group = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF(STARFISH_URL);
  const { actions, mixer } = useAnimations(animations, group);

  // Clone so multiple instances would be safe; also gives us a fresh material slot.
  const root = useMemo(() => {
    const cloned = scene.clone(true);
    cloned.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = false;
        mesh.frustumCulled = false; // skinned meshes can wrongly cull
      }
    });
    return cloned;
  }, [scene]);

  // Start in idle.
  useEffect(() => {
    const idle = actions[ANIM.idle];
    idle?.reset().fadeIn(CHARACTER.fadeSeconds).play();
    return () => {
      idle?.fadeOut(CHARACTER.fadeSeconds);
    };
  }, [actions]);

  // Track which clip is currently playing to avoid restart churn.
  const currentClip = useRef<string>(ANIM.idle);

  // Reusable scratch vectors — allocating in useFrame creates GC pressure.
  const moveVec = useRef(new THREE.Vector3());
  const targetQuat = useRef(new THREE.Quaternion());
  const upY = useRef(new THREE.Vector3(0, 1, 0));

  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;

    // Read input. Joystick/keyboard already in screen space (x right, y up).
    const { moveX, moveY } = useInput.getState();

    // Convert screen-space input → world-space relative to an isometric camera.
    // Camera sits at (+x,+z) so screen-up = world (-x, -z) (north-west).
    // We bake that as a 45° rotation around Y of the input vector.
    const cos = Math.SQRT1_2;
    const sin = Math.SQRT1_2;
    const wx = moveX * cos - moveY * sin;
    const wz = -moveX * sin - moveY * cos;
    moveVec.current.set(wx, 0, wz);

    const mag = moveVec.current.length();
    const moving = mag > 0.05;

    if (moving) {
      moveVec.current.normalize().multiplyScalar(mag); // preserve analog magnitude
      const speed = THREE.MathUtils.lerp(CHARACTER.walkSpeed, CHARACTER.runSpeed, Math.min(1, mag));
      g.position.addScaledVector(moveVec.current, speed * dt);

      // Smoothly rotate to face movement direction.
      const yaw = Math.atan2(moveVec.current.x, moveVec.current.z);
      targetQuat.current.setFromAxisAngle(upY.current, yaw);
      g.quaternion.rotateTowards(targetQuat.current, CHARACTER.turnSpeed * dt);
    }

    // Pick animation by speed.
    const desired = !moving ? ANIM.idle : mag > 0.85 ? ANIM.run : ANIM.walk;
    if (desired !== currentClip.current) {
      const from = actions[currentClip.current];
      const to = actions[desired];
      if (to) {
        from?.fadeOut(CHARACTER.fadeSeconds);
        to.reset().fadeIn(CHARACTER.fadeSeconds).play();
        currentClip.current = desired;
      }
    }

    mixer.update(0); // useAnimations also ticks; passing 0 is a no-op safety
    positionRef.current.copy(g.position);
  });

  return (
    <group ref={group} dispose={null}>
      <primitive object={root} />
    </group>
  );
}

useGLTF.preload(STARFISH_URL);
