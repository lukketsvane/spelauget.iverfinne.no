'use client';

import { useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, useAnimations } from '@react-three/drei';
import * as THREE from 'three';
import { CHARACTER, STARFISH_URL } from './config';
import { useInput } from '@/store/input';

type Props = { positionRef: MutableRefObject<THREE.Vector3> };
type Role = 'idle' | 'walk' | 'run';

export default function Character({ positionRef }: Props) {
  // Outer group: position/rotation we mutate every frame.
  const group = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF(STARFISH_URL);

  // Configure shadow casting on the meshes once. We deliberately do NOT
  // touch scene.position or scene.scale — mutating the cached glTF scene
  // breaks skeleton binding under React StrictMode's double-mount.
  useEffect(() => {
    scene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = false;
        mesh.frustumCulled = false; // skinned meshes can self-cull at edges
      }
    });
  }, [scene]);

  // Foot-lift: how far up to push the model so its lowest vertex sits on
  // y=0. Computed once from the pristine scene; the inner group below
  // applies it together with the visual scale.
  const footLift = useMemo(() => {
    const box = new THREE.Box3().setFromObject(scene);
    return -box.min.y * CHARACTER.scale;
  }, [scene]);

  const { actions, names } = useAnimations(animations, group);

  const clipsByRole = useRef<Record<Role, THREE.AnimationAction | null>>({
    idle: null,
    walk: null,
    run: null,
  });
  const currentRole = useRef<Role>('idle');

  useEffect(() => {
    if (!names.length) return;
    const byDuration = names
      .map((n) => ({ name: n, dur: actions[n]?.getClip().duration ?? 0 }))
      .sort((a, b) => a.dur - b.dur);

    // Shortest = run, middle = walk, longest = idle. With 4 clips, the
    // longest pair is idle + extra; first long one wins as idle.
    const shortest = byDuration[0]?.name ?? names[0];
    const middle = byDuration[1]?.name ?? shortest;
    const longest = byDuration[byDuration.length - 1]?.name ?? shortest;

    clipsByRole.current = {
      run: actions[shortest] ?? null,
      walk: actions[middle] ?? null,
      idle: actions[longest] ?? actions[names[0]] ?? null,
    };

    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.log(
        '[Character] clips:',
        byDuration.map((c) => `${c.name}=${c.dur.toFixed(2)}s`).join(', '),
        '→ idle:', longest, 'walk:', middle, 'run:', shortest,
      );
    }

    for (const action of Object.values(actions)) {
      if (action) action.setLoop(THREE.LoopRepeat, Infinity);
    }
    const idle = clipsByRole.current.idle;
    if (idle) {
      idle.reset().fadeIn(CHARACTER.fadeSeconds).play();
      currentRole.current = 'idle';
    }

    return () => {
      idle?.fadeOut(CHARACTER.fadeSeconds);
    };
  }, [actions, names]);

  // Reusable scratch — avoid per-frame allocation.
  const moveVec = useRef(new THREE.Vector3());
  const targetQuat = useRef(new THREE.Quaternion());
  const upY = useRef(new THREE.Vector3(0, 1, 0));

  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;

    const { moveX, moveY } = useInput.getState();

    // Screen-space input → world-space (45° iso rotation baked in: camera
    // sits on the +X +Z diagonal looking back to origin, so screen-up maps
    // to world (-X, -Z)).
    const c = Math.SQRT1_2;
    const wx = moveX * c - moveY * c;
    const wz = -moveX * c - moveY * c;
    moveVec.current.set(wx, 0, wz);

    const mag = moveVec.current.length();
    const moving = mag > 0.05;

    if (moving) {
      const dirMag = Math.min(1, mag);
      moveVec.current.normalize().multiplyScalar(dirMag);
      const speed = THREE.MathUtils.lerp(CHARACTER.walkSpeed, CHARACTER.runSpeed, dirMag);
      g.position.addScaledVector(moveVec.current, speed * dt);

      // Yaw to face move direction. modelForwardYaw compensates for the
      // GLB's local forward axis (see config.ts).
      const yaw = Math.atan2(moveVec.current.x, moveVec.current.z) + CHARACTER.modelForwardYaw;
      targetQuat.current.setFromAxisAngle(upY.current, yaw);
      g.quaternion.rotateTowards(targetQuat.current, CHARACTER.turnSpeed * dt);
    }

    const desired: Role = !moving ? 'idle' : mag > 0.85 ? 'run' : 'walk';
    if (desired !== currentRole.current) {
      const from = clipsByRole.current[currentRole.current];
      const to = clipsByRole.current[desired];
      if (to) {
        from?.fadeOut(CHARACTER.fadeSeconds);
        to.reset().fadeIn(CHARACTER.fadeSeconds).play();
        currentRole.current = desired;
      }
    }

    positionRef.current.copy(g.position);
  });

  return (
    <group ref={group} dispose={null}>
      {/* Inner group applies visual transforms. Outer group is what we
          translate/rotate per-frame; keeping these separate means scale
          and lift are re-applied as JSX every render (idempotent) and
          never bleed into the cached glTF scene. */}
      <group scale={CHARACTER.scale} position-y={footLift}>
        <primitive object={scene} />
      </group>
    </group>
  );
}

useGLTF.preload(STARFISH_URL);
