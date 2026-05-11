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
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.log(
        '[SkateNpc] animations:',
        animations.map((c) => `${c.name}=${c.duration.toFixed(2)}s`).join(', ') || '(none)',
      );
    }
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
  // Inner group takes the procedural bob/bank/pitch so the orbit
  // (handled by the outer group) and the "swimming" body motion
  // (handled here) compose cleanly without fighting each other.
  const innerRef = useRef<THREE.Group>(null);

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const t = performance.now() / 1000 - startTime.current;
    const omega = (Math.PI * 2) / period;
    const theta = omega * t + phase;

    // Vertical bob: ±0.4 m at ~half the orbit speed so wing-flaps don't
    // beat against the orbit. Independent of `period` direction.
    const bob = Math.sin(omega * t * 2) * 0.4;
    g.position.x = center[0] + Math.cos(theta) * radius;
    g.position.z = center[1] + Math.sin(theta) * radius;
    g.position.y = height + bob;

    // Velocity direction = derivative of position w.r.t. theta:
    //   (-sin θ, cos θ). Yaw so the model's local +X (its head, after
    // the Blender rig conventions other NPCs use) faces along that
    // tangent. atan2(vx, vz) - π/2 matches the offset BobleNpc/StarNpc
    // use to align +X to "forward".
    const vx = -Math.sin(theta) * Math.sign(period);
    const vz = Math.cos(theta) * Math.sign(period);
    g.rotation.y = Math.atan2(vx, vz) - Math.PI / 2;

    // Procedural body motion on the inner group. The skate.glb on disk
    // is currently a static mesh (0 anims), so this is the only thing
    // that makes it look alive. When the rigged GLB lands the swim
    // clip plays simultaneously and these add a subtle bank on top.
    const inner = innerRef.current;
    if (inner) {
      // Bank into the turn: roll around its forward axis. Sign matches
      // direction of travel so it tilts the right way around the orbit.
      inner.rotation.z = 0.18 * Math.sign(period);
      // Wing-flap fake: pitch oscillation matched to the bob frequency
      // so the body subtly nods up-down with each "flap".
      inner.rotation.x = Math.sin(omega * t * 2) * 0.12;
    }
  });

  return (
    <group ref={group}>
      <group ref={innerRef} scale={scale}>
        <primitive object={clonedScene} />
      </group>
    </group>
  );
}

useGLTF.preload(URL);
