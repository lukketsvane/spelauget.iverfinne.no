'use client';

import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, useAnimations } from '@react-three/drei';
import * as THREE from 'three';
import { useDialogue, type DialogueLine } from '@/store/dialogue';
import { useEmote } from '@/store/emote';
import { useGame } from '@/store/game';
import { useInteraction } from '@/store/interaction';

const URL = '/models/stjernekarakter.glb';
const TRIGGER_DISTANCE = 4.5;
// If the player walks past this distance during dialogue, the
// conversation is auto-cancelled — the NPC won't shout from afar.
const CANCEL_DISTANCE = 9.0;
const SCALE = 4.5;
const FADE = 0.25;

type Props = {
  id: string;
  position: [number, number, number];
  dialogue: DialogueLine[];
  playerPosRef: MutableRefObject<THREE.Vector3>;
};

// Star NPC. Always digs in place (longest available clip on a loop).
// Bow within range opens the dialogue, but the digging never stops —
// the character stays buried in the dirt the entire conversation. When
// the dialogue ends we hand the player the key, which unlocks the
// teleporters.
export default function StarNpc({ id, position, dialogue, playerPosRef }: Props) {
  const group = useRef<THREE.Group>(null);
  const innerGroup = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF(URL);
  const { actions } = useAnimations(animations, group);

  // Marks that *we* started the active dialogue (so the dialogue-end
  // listener only delivers the key for our own conversation, not a
  // different NPC's).
  const ourDialogue = useRef(false);

  // Pick the dig clip by duration. Reading from `animations` directly
  // (not actions[n].getClip()) because drei initialises actions
  // lazily — first useMemo pass would otherwise see 0 s durations.
  const digClipName = useMemo(() => {
    if (animations.length === 0) return null;
    const sorted = [...animations].sort((a, b) => b.duration - a.duration);
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.log(
        '[StarNpc] clips:',
        sorted.map((c) => `${c.name}=${c.duration.toFixed(2)}s`).join(', '),
        '→ dig:',
        sorted[0]?.name,
      );
    }
    return sorted[0]?.name ?? null;
  }, [animations]);

  // Mount: start the dig loop and keep it running forever.
  useEffect(() => {
    if (!digClipName) return;
    const action = actions[digClipName];
    if (!action) return;
    action.setLoop(THREE.LoopRepeat, Infinity);
    action.timeScale = 1;
    action.reset().fadeIn(FADE).play();
    return () => {
      action.fadeOut(FADE);
    };
  }, [digClipName, actions]);

  // Bow trigger: open the inline dialogue when the player emotes within
  // range. Animation is unaffected — the NPC keeps digging.
  useEffect(() => {
    let lastReq = useEmote.getState().requestId;
    const unsub = useEmote.subscribe((s) => {
      if (s.requestId === lastReq) return;
      lastReq = s.requestId;
      const g = group.current;
      if (!g) return;
      const dx = playerPosRef.current.x - g.position.x;
      const dz = playerPosRef.current.z - g.position.z;
      if (Math.hypot(dx, dz) >= TRIGGER_DISTANCE) return;
      ourDialogue.current = true;
      useDialogue.getState().start(dialogue);
    });
    return unsub;
  }, [playerPosRef, dialogue]);

  // When *our* dialogue closes, hand the player the key. The character
  // stays digging — no animation change.
  useEffect(() => {
    let wasActive = useDialogue.getState().active;
    const unsub = useDialogue.subscribe((s) => {
      if (s.active === wasActive) return;
      wasActive = s.active;
      if (s.active) return;
      if (!ourDialogue.current) return;
      ourDialogue.current = false;
      useGame.getState().giveKey();
    });
    return unsub;
  }, []);

  // Per-frame: claim interaction slot when in range; safety net to
  // ensure dig keeps driving the bones even after a paused tab etc.
  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const dx = playerPosRef.current.x - g.position.x;
    const dz = playerPosRef.current.z - g.position.z;
    const dist = Math.hypot(dx, dz);

    if (dist < TRIGGER_DISTANCE) useInteraction.getState().claim(id);
    else useInteraction.getState().release(id);

    // Cancel our active dialogue if the player wanders out of range.
    if (
      ourDialogue.current &&
      useDialogue.getState().active &&
      dist > CANCEL_DISTANCE
    ) {
      useDialogue.getState().close();
    }

    if (digClipName) {
      const action = actions[digClipName];
      if (action && action.getEffectiveWeight() < 0.01) {
        action.setLoop(THREE.LoopRepeat, Infinity);
        action.timeScale = 1;
        action.reset().fadeIn(FADE).play();
      }
    }
  });

  useEffect(() => {
    return () => useInteraction.getState().release(id);
  }, [id]);

  // Foot lift in the dig pose so the body rests on y = 0.
  const [footLift, setFootLift] = useState(0);
  useEffect(() => {
    const handle = requestAnimationFrame(() => {
      const inner = innerGroup.current;
      if (!inner) return;
      const box = new THREE.Box3().setFromObject(inner);
      setFootLift(-box.min.y);
    });
    return () => cancelAnimationFrame(handle);
  }, [scene]);

  useEffect(() => {
    scene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const m = obj as THREE.Mesh;
        m.castShadow = true;
        m.receiveShadow = false;
        m.frustumCulled = false;
      }
    });
  }, [scene]);

  return (
    <group ref={group} position={position}>
      <group ref={innerGroup} scale={SCALE} position-y={footLift}>
        <primitive object={scene} />
      </group>
    </group>
  );
}

useGLTF.preload(URL);
