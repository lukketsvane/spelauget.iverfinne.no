'use client';

import { useMemo, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { useGame } from '@/store/game';
import { useLevel } from '@/store/level';
import { WORLD_SPAWNS } from './levels';
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
import Crystal from './Crystal';
import CrystalAltar from './CrystalAltar';
import Key from './Key';
import Artifact from './Artifact';
import FlisProp from './FlisProp';
import SkateNpc from './SkateNpc';
import Giantess from './Giantess';
import FlisPool from './FlisPool';
import FlisFloor from './FlisFloor';
import BlodSprite from './BlodSprite';

type Props = { playerPosRef: MutableRefObject<THREE.Vector3> };

// Per-world spawn rendering. We read the active region's spawn
// array each render — when travel() flips currentRegionId, this
// re-runs and the previous world's GLBs / NPCs / colliders unmount,
// the new world's content mounts, and the player wakes up in a
// fresh scene. Nothing leaks between worlds (modulo store state
// like inventory keys, which is what you WANT to carry over).
export default function Spawns({ playerPosRef }: Props) {
  // Portals only manifest once the digger has handed over the key —
  // before that they shouldn't even appear on the map.
  const hasKey = useGame((s) => s.hasKey);
  const regionId = useLevel((s) => s.currentRegionId);
  const spawns = useMemo(() => WORLD_SPAWNS[regionId] ?? [], [regionId]);

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
            // Legacy hide-until-keyed behaviour applies only to portals
            // that opt into the legacy any-key check (no requiredKey).
            // New 5-world chain portals declare their own requiredKey
            // and stay visible from the start — the player needs to
            // see the locked door to know it exists.
            if (s.requiredKey === undefined && !hasKey) return null;
            return (
              <Portal
                key={s.id}
                id={s.id}
                position={[s.position[0], 2.4, s.position[1]]}
                targetRegion={s.targetRegion}
                playerPosRef={playerPosRef}
                colorA={s.colorA}
                colorB={s.colorB}
                requiredKey={s.requiredKey}
                texture={s.texture}
                height={s.height}
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
          case 'crystal':
            return (
              <Crystal
                key={s.id}
                id={s.id}
                position={[s.position[0], 0, s.position[1]]}
                playerPosRef={playerPosRef}
              />
            );
          case 'crystal_altar':
            return (
              <CrystalAltar
                key={s.id}
                id={s.id}
                position={[s.position[0], 0, s.position[1]]}
                playerPosRef={playerPosRef}
                scale={s.scale}
                rotationY={s.rotation}
              />
            );
          case 'key':
            return (
              <Key
                key={s.id}
                id={s.id}
                position={[s.position[0], 0, s.position[1]]}
                opens={s.opens}
                playerPosRef={playerPosRef}
              />
            );
          case 'artifact':
            return (
              <Artifact
                key={s.id}
                id={s.id}
                position={[s.position[0], 0, s.position[1]]}
                region={s.region}
                playerPosRef={playerPosRef}
              />
            );
          case 'flis_prop':
            return (
              <FlisProp
                key={s.id}
                id={s.id}
                prop={s.prop}
                position={[s.position[0], 0, s.position[1]]}
                scale={s.scale}
                rotationY={s.rotation}
              />
            );
          case 'skate':
            return (
              <SkateNpc
                key={s.id}
                id={s.id}
                center={s.position}
                radius={s.radius}
                height={s.height}
                period={s.period}
                scale={s.scale}
                phase={s.phase}
              />
            );
          case 'giantess':
            return (
              <Giantess
                key={s.id}
                id={s.id}
                position={[s.position[0], s.yOffset ?? 0, s.position[1]]}
                scale={s.scale}
                rotationY={s.rotation}
                color={s.color}
                emissive={s.emissive}
                emissiveIntensity={s.emissiveIntensity}
              />
            );
          case 'flis_pool':
            return (
              <FlisPool
                key={s.id}
                id={s.id}
                position={[s.position[0], 0, s.position[1]]}
                rotationY={s.rotation}
                scale={s.scale}
              />
            );
          case 'flis_floor':
            return (
              <FlisFloor
                key={s.id}
                id={s.id}
                position={[s.position[0], 0, s.position[1]]}
                width={s.width}
                depth={s.depth}
                tileSize={s.tileSize}
              />
            );
          case 'blod_sprite':
            return (
              <BlodSprite
                key={s.id}
                id={s.id}
                position={[s.position[0], 0, s.position[1]]}
                texture={s.texture}
                height={s.height}
                scale={s.scale}
                rotationOffset={s.rotationOffset}
                noCollide={s.noCollide}
                yOffset={s.yOffset}
                glow={s.glow}
                tint={s.tint}
              />
            );
          default:
            return null;
        }
      })}
    </>
  );
}
