'use client';

import { useEffect, useRef, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, useAnimations } from '@react-three/drei';
import * as THREE from 'three';
import { CHARACTER, STARFISH_URL } from './config';
import { useInput } from '@/store/input';

type Props = { positionRef: MutableRefObject<THREE.Vector3> };

// Roles in priority order: which clip we use for idle / walk / run.
type Role = 'idle' | 'walk' | 'run';

export default function Character({ positionRef }: Props) {
  const group = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF(STARFISH_URL);

  // Use the loaded scene directly (no clone). Cloning a skinned mesh with
  // Object3D.clone copies the SkinnedMesh but not the skeleton bind — the
  // mixer then animates the *original* off-screen bones and the on-screen
  // mesh stays in T-pose. Single instance → just use the source scene.
  useEffect(() => {
    scene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = false;
        mesh.frustumCulled = false; // skinned meshes can self-cull at edges
      }
    });

    // Scale up and lift so the model's feet rest on y=0. The GLB's origin is
    // near the character's centre, so without this the lower half clips
    // through the ground. Box3 needs world matrices to be current.
    scene.position.set(0, 0, 0);
    scene.scale.setScalar(CHARACTER.scale);
    scene.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(scene);
    scene.position.y = -box.min.y;
  }, [scene]);

  const { actions, names } = useAnimations(animations, group);

  // Resolve clip names by length heuristic: longest clips → idle/extra,
  // shorter → walk/run. Falls back to declared order if everything's similar.
  // This is what makes us robust to Blender's "NlaTrack.NNN" generic naming.
  const clipsByRole = useRef<Record<Role, THREE.AnimationAction | null>>({
    idle: null,
    walk: null,
    run: null,
  });

  useEffect(() => {
    if (!names.length) return;
    const byDuration = names
      .map((n) => ({ name: n, dur: actions[n]?.getClip().duration ?? 0 }))
      .sort((a, b) => a.dur - b.dur);

    // Shortest = run, middle = walk, longest = idle. With 4 clips, the longest
    // pair is idle + extra; first long one wins as idle.
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

    // All clips loop. Start idle (or whichever survived as a fallback).
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

  const currentRole = useRef<Role>('idle');

  // Reusable scratch — avoid per-frame allocation.
  const moveVec = useRef(new THREE.Vector3());
  const targetQuat = useRef(new THREE.Quaternion());
  const upY = useRef(new THREE.Vector3(0, 1, 0));

  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;

    const { moveX, moveY } = useInput.getState();

    // Screen-space input → world-space (45° iso rotation baked in).
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

      const yaw = Math.atan2(moveVec.current.x, moveVec.current.z);
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
      <primitive object={scene} />
    </group>
  );
}

useGLTF.preload(STARFISH_URL);
