'use client';

import { useMemo, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { useGame } from '@/store/game';
import { LEVELS } from './levels';
import StarNpc from './StarNpc';
import BobleNpc from './BobleNpc';
import Portal from './Portal';
import StoneHut from './StoneHut';
import RockStack from './RockStack';
import Trilo from './Trilo';
import Relic from './Relic';
import Car from './Car';
import CarPortal from './CarPortal';
import Remnant from './Remnant';
import StaticGLB from './StaticGLB';

type Props = { playerPosRef: MutableRefObject<THREE.Vector3> };

// One mega-map: spawns are constant for the lifetime of the play
// session. We mount everything once and let the entities live the
// whole game. Fast-travel just relocates the player; nothing here
// re-mounts on a waypoint hop, which means GLB clones / mixer state /
// dialogue subscriptions stay intact across travels.
export default function Spawns({ playerPosRef }: Props) {
  // Portals only manifest once the digger has handed over the key —
  // before that they shouldn't even appear on the map.
  const hasKey = useGame((s) => s.hasKey);
  const spawns = useMemo(() => LEVELS.world.spawns, []);

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
                leadTo={s.leadTo}
              />
            );
          case 'portal':
            if (!hasKey) return null;
            return (
              <Portal
                key={s.id}
                id={s.id}
                position={[s.position[0], 2.4, s.position[1]]}
                targetRegion={s.targetRegion}
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
          case 'relic':
            return (
              <Relic
                key={s.id}
                id={s.id}
                position={[s.position[0], 0, s.position[1]]}
                texture={s.texture}
                height={s.height}
                scale={s.scale}
              />
            );
          case 'car':
            return (
              <Car
                key={s.id}
                id={s.id}
                position={[s.position[0], 0, s.position[1]]}
                scale={s.scale}
                rotationY={s.rotation}
                model={s.model}
              />
            );
          case 'car_portal':
            return (
              <CarPortal
                key={s.id}
                id={s.id}
                position={[s.position[0], 0, s.position[1]]}
                scale={s.scale}
                rotationY={s.rotation}
                targetRegion={s.targetRegion}
                gate={s.gate ?? 'bobbleVanished'}
                playerPosRef={playerPosRef}
              />
            );
          case 'remnant':
            return (
              <Remnant
                key={s.id}
                id={s.id}
                position={[s.position[0], 0, s.position[1]]}
                texture={s.texture}
                height={s.height}
                scale={s.scale}
                rotationOffset={s.rotationOffset}
              />
            );
          case 'glowing_purple_coral':
          case 'neon_vascular_tree':
          case 'purple_coral':
          case 'purple_coral_alt':
          case 'purple_stone_cairn':
          case 'tangled_root_sculpture':
            return (
              <StaticGLB
                key={s.id}
                id={s.id}
                kindName={s.kind}
                position={[s.position[0], 0, s.position[1]]}
                scale={s.scale}
                rotationY={s.rotation}
              />
            );
          default:
            return null;
        }
      })}
    </>
  );
}
