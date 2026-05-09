'use client';

import { useEffect, useMemo, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { useGame } from '@/store/game';
import { useLevel } from '@/store/level';
import { useInteraction } from '@/store/interaction';
import { LEVELS } from './levels';
import StarNpc from './StarNpc';
import BobleNpc from './BobleNpc';
import Portal from './Portal';
import StoneHut from './StoneHut';
import RockStack from './RockStack';
import Trilo from './Trilo';

type Props = { playerPosRef: MutableRefObject<THREE.Vector3> };

// Reads the active level definition and mounts a component per spawn.
// Keys are stable (spawn.id), so React unmounts the old level's
// entities cleanly when the level changes — useful for freeing GLB
// clones, mixer state, dialogue subscriptions, etc.
export default function Spawns({ playerPosRef }: Props) {
  const currentLevelId = useLevel((s) => s.currentLevelId);
  // Portals only manifest once the digger has handed over the key —
  // before that they shouldn't even appear on the map.
  const hasKey = useGame((s) => s.hasKey);
  const spawns = useMemo(() => LEVELS[currentLevelId].spawns, [currentLevelId]);

  useEffect(() => {
    // Old owners are about to unmount — release the slot so the new
    // level's entities can claim it cleanly.
    useInteraction.getState().reset();
  }, [currentLevelId]);

  return (
    <>
      {spawns.map((s) => {
        switch (s.kind) {
          case 'star_npc':
            return (
              <StarNpc
                key={s.id}
                id={s.id}
                position={[s.position[0], 0, s.position[1]]}
                dialogue={s.dialogue}
                playerPosRef={playerPosRef}
              />
            );
          case 'boble_npc':
            return (
              <BobleNpc
                key={s.id}
                id={s.id}
                position={[s.position[0], 0, s.position[1]]}
                dialogue={s.dialogue}
                playerPosRef={playerPosRef}
              />
            );
          case 'portal':
            if (!hasKey) return null;
            return (
              <Portal
                key={s.id}
                id={s.id}
                position={[s.position[0], 2.4, s.position[1]]}
                targetLevel={s.targetLevel}
                playerPosRef={playerPosRef}
                colorA={s.colorA}
                colorB={s.colorB}
              />
            );
          case 'stone_hut':
            return (
              <StoneHut
                key={s.id}
                id={s.id}
                position={[s.position[0], 0, s.position[1]]}
                scale={s.scale}
                rotationY={s.rotation}
              />
            );
          case 'rock_stack':
            return (
              <RockStack
                key={s.id}
                id={s.id}
                position={[s.position[0], 0, s.position[1]]}
                scale={s.scale}
                rotationY={s.rotation}
              />
            );
          case 'trilo':
            return (
              <Trilo
                key={s.id}
                id={s.id}
                position={[s.position[0], 0, s.position[1]]}
                scale={s.scale}
                rotationY={s.rotation}
                color={s.color}
                emissive={s.emissive}
              />
            );
          default:
            return null;
        }
      })}
    </>
  );
}
