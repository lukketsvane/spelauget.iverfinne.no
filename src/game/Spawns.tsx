'use client';

import { useEffect, useMemo, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { useLevel } from '@/store/level';
import { useInteraction } from '@/store/interaction';
import { LEVELS, parseLevelSpawns } from './levels';
import StarNpc from './StarNpc';
import Portal from './Portal';
import StoneHut from './StoneHut';
import RockStack from './RockStack';

type Props = { playerPosRef: MutableRefObject<THREE.Vector3> };

// Reads the active level definition and mounts a component per spawn
// cell. Components are keyed by stable spawn id, so React unmounts the
// old level's entities cleanly when the level changes — useful for
// freeing GLB clones, dialogue state, animation mixers, etc.
export default function Spawns({ playerPosRef }: Props) {
  const currentLevelId = useLevel((s) => s.currentLevelId);

  const spawns = useMemo(() => parseLevelSpawns(LEVELS[currentLevelId]), [currentLevelId]);

  // Reset interaction claim slot whenever the level changes — old owners
  // are about to unmount and would race with the new ones for the slot.
  useEffect(() => {
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
                position={[s.x, 0, s.z]}
                playerPosRef={playerPosRef}
              />
            );
          case 'portal_to_level1':
            return (
              <Portal
                key={s.id}
                id={s.id}
                position={[s.x, 2.4, s.z]}
                targetLevel="level1"
                playerPosRef={playerPosRef}
                colorA="#a4d8ff"
                colorB="#3a4cff"
              />
            );
          case 'portal_to_level2':
            return (
              <Portal
                key={s.id}
                id={s.id}
                position={[s.x, 2.4, s.z]}
                targetLevel="level2"
                playerPosRef={playerPosRef}
              />
            );
          case 'stone_hut':
            return <StoneHut key={s.id} position={[s.x, 0, s.z]} />;
          case 'rock_stack':
            return <RockStack key={s.id} position={[s.x, 0, s.z]} />;
          default:
            // 'player_spawn' / 'empty' — no entity rendered.
            return null;
        }
      })}
    </>
  );
}
