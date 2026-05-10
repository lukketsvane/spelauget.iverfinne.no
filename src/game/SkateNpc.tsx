'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, useAnimations } from '@react-three/drei';
import * as THREE from 'three';

const URL = '/models/skate.glb';
const FADE = 0.25;

type Props = {
  id: string;
  // World-space centre the skate orbits.
  center: [number, number];
  // Orbit radius in metres.
  radius: number;
  // Height above ground at which it flies.
  height: number;
  // Seconds per full revolution. Negative reverses direction.
  period: number;
  // Visual scale.
  scale?: number;
  // Phase offset in radians so multiple skates don't bunch up.
  phase?: number;
};

// Stingray-style ambient creature that orbits a fixed centre point on
// a horizontal circle, hovering at a constant height. Plays whatever
// animation clip the GLB ships with on a loop (the swim cycle); if
// the model has no clips, the orbital motion alone keeps it visibly
// alive.
//
// Pure decoration — no collision, no interaction, no dialogue. Lives
// the whole session like other ambient props.
export default function SkateNpc({
  id: _id,
  center,
  radius,
  height,
  period,
  scale = 2.5,
  phase = 0,
}: Props) {
  const group = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF(URL);
  // Clone the scene so multiple skates don't share one mesh — drei's
  // useGLTF caches the parsed glTF, and reusing the same object tree
  // for multiple <primitive> nodes desyncs their bone matrices.
  const clonedScene = useMemo(() => scene.clone(true), [scene]);
  const { actions, mixer } = useAnimations(animations, group);

  // Mount: configure shadows, then start the longest clip on a loop.
  useEffect(() => {
    clonedScene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = false;
      mesh.frustumCulled = false;
    });
  }, [clonedScene]);

  useEffect(() => {
    if (animations.length === 0) return;
    const longest = [...animations].sort((a, b) => b.duration - a.duration)[0];
    const action = actions[longest.name];
    if (!action) return;
    action.setLoop(THREE.LoopRepeat, Infinity);
    action.reset().fadeIn(FADE).play();
    return () => {
      action.fadeOut(FADE);
    };
  }, [animations, actions]);

  const startTime = useRef(performance.now() / 1000);

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const t = performance.now() / 1000 - startTime.current;
    const omega = (Math.PI * 2) / period;
    const theta = omega * t + phase;

    g.position.x = center[0] + Math.cos(theta) * radius;
    g.position.z = center[1] + Math.sin(theta) * radius;
    g.position.y = height;

    // Velocity direction = derivative of position w.r.t. theta:
    //   (-sin θ, cos θ). Yaw so the model's local +X (its head, after
    // the Blender rig conventions other NPCs use) faces along that
    // tangent. atan2(vx, vz) - π/2 matches the offset BobleNpc/StarNpc
    // use to align +X to "forward".
    const vx = -Math.sin(theta) * Math.sign(period);
    const vz = Math.cos(theta) * Math.sign(period);
    g.rotation.y = Math.atan2(vx, vz) - Math.PI / 2;
  });

  return (
    <group ref={group}>
      <group scale={scale}>
        <primitive object={clonedScene} />
      </group>
    </group>
  );
}

useGLTF.preload(URL);
