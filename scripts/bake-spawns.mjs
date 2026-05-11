// Bake per-world spawn arrays from their current hand-authored TS
// state into /src/game/levels/<world>/spawns.json.
//
// One-shot seed for the Blender level editor workflow. After this
// runs, the JSON files become the source of truth: Blender imports
// them, lets the designer move/scale/rotate everything visually, and
// the addon's exporter writes the JSON back. Dialogue stays in TS
// (per-world dialogue.ts), keyed by spawn id.
//
// Run with: node scripts/bake-spawns.mjs
//
// The data below is duplicated from the original /levels/<world>/index.ts
// files — keep them in sync ONCE, then never edit this script again.

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// --- Region centres (mirrors src/game/regions.ts) -------------------
const REGIONS = {
  lysningen: { center: [0, -30] },
  blod: { center: [-90, -50] },
  geometri: { center: [-90, 60] },
  siste: { center: [90, -50] },
  senter: { center: [90, 70] },
};

// --- Hageverden perimeter ring (mirrors levels/helpers.ts) ---------
const WORLD_RADIUS = 120;
const WORLD_SCALE = 2;
const BOUNDARY_RING_R = WORLD_RADIUS - 4;

function perimeterRing() {
  const out = [];
  const count = 28;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const r = BOUNDARY_RING_R + (((i * 31) % 7) - 3) * 0.6;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const angDeg = (a * 180) / Math.PI;
    const isSouthGate = angDeg > 82 && angDeg < 98;
    if (isSouthGate) continue;
    const kind = i % 3 === 0
      ? 'rock_stack'
      : i % 3 === 1
        ? 'purple_stone_cairn'
        : 'tangled_root_sculpture';
    if (kind === 'rock_stack') {
      out.push({
        kind: 'rock_stack',
        id: `boundary.${i}`,
        position: [x, z],
        scale: 1.1 + ((i * 17) % 5) * 0.08,
        rotation: ((i * 0.7) % (Math.PI * 2)) - Math.PI,
      });
    } else {
      out.push({
        kind,
        id: `boundary.${i}`,
        position: [x, z],
        scale: 1.2 + ((i * 11) % 5) * 0.09,
        rotation: ((i * 1.3) % (Math.PI * 2)) - Math.PI,
      });
    }
  }
  return out;
}

function trailCairn(id, x, z, scale = 0.7) {
  return {
    kind: 'purple_stone_cairn',
    id,
    position: [x, z],
    scale,
    rotation: ((x * 7 + z * 13) % 6) - 3,
  };
}

function applyWorldScale(spawns) {
  return spawns.map((s) => {
    const out = {
      ...s,
      position: [s.position[0] * WORLD_SCALE, s.position[1] * WORLD_SCALE],
    };
    if (s.kind === 'boble_npc' && s.leadTo) {
      out.leadTo = [s.leadTo[0] * WORLD_SCALE, s.leadTo[1] * WORLD_SCALE];
    }
    return out;
  });
}

// --- HAGEVERDEN -----------------------------------------------------
// Authored in the 60-radius design frame; applyWorldScale (×2)
// stretches to the runtime 120-radius frame at bake time.

const HAGEVERDEN_BASE_SPAWNS = [
  { kind: 'purple_coral', id: 'lys.coral.start.a', position: [-9, 4], scale: 1.3 },
  { kind: 'glowing_purple_coral', id: 'lys.coral.start.b', position: [10, 2], scale: 1.2 },
  { kind: 'purple_coral_alt', id: 'lys.coral.start.c', position: [8, -6], scale: 1.1 },
  { kind: 'purple_stone_cairn', id: 'lys.cairn.start.a', position: [3, 6], scale: 0.8 },
  { kind: 'purple_stone_cairn', id: 'lys.cairn.start.b', position: [-7, 2], scale: 0.65 },
  { kind: 'tangled_root_sculpture', id: 'lys.roots.start', position: [6, 6], scale: 0.95, rotation: 0.9 },
  { kind: 'star_npc', id: 'lys.star.welcome', position: [0, -9] },
  { kind: 'glowing_purple_coral', id: 'lys.coral.digger.beacon', position: [3, -8], scale: 1.2 },
  { kind: 'tangled_root_sculpture', id: 'lys.roots.digger.a', position: [-8, -16], scale: 1.2, rotation: -0.4 },
  { kind: 'tangled_root_sculpture', id: 'lys.roots.digger.b', position: [8, -16], scale: 0.9, rotation: 1.1 },
  { kind: 'purple_coral_alt', id: 'lys.coral.digger.a', position: [-10, -6], scale: 0.9 },
  { kind: 'purple_stone_cairn', id: 'lys.cairn.digger.a', position: [-4, -16], scale: 0.7 },
  { kind: 'purple_stone_cairn', id: 'lys.cairn.digger.b', position: [6, -14], scale: 0.6 },
  { kind: 'stone_hut', id: 'lys.hut.upper-right', position: [18, -22], rotation: -0.3, scale: 0.9 },
  { kind: 'boble_npc', id: 'lys.boble.bobble', position: [28, -16] },
  { kind: 'glowing_purple_coral', id: 'lys.coral.hut.a', position: [12, -10], scale: 1.0 },
  { kind: 'purple_coral', id: 'lys.coral.hut.b', position: [24, -10], scale: 1.1 },
  { kind: 'purple_coral_alt', id: 'lys.coral.hut.c', position: [22, -28], scale: 0.95 },
  { kind: 'purple_stone_cairn', id: 'lys.cairn.hut.a', position: [10, -28], scale: 1.0 },
  { kind: 'purple_stone_cairn', id: 'lys.cairn.hut.b', position: [25, -18], scale: 0.7 },
  { kind: 'tangled_root_sculpture', id: 'lys.roots.hut', position: [32, -22], scale: 1.0, rotation: -0.7 },
  { kind: 'rock_stack', id: 'lys.rock.nw.a', position: [-26, -12], scale: 1.0 },
  { kind: 'rock_stack', id: 'lys.rock.nw.b', position: [-36, -22], scale: 0.85, rotation: 0.5 },
  { kind: 'purple_stone_cairn', id: 'lys.cairn.nw.a', position: [-32, -8], scale: 1.1 },
  { kind: 'purple_stone_cairn', id: 'lys.cairn.nw.b', position: [-40, -2], scale: 0.85 },
  { kind: 'tangled_root_sculpture', id: 'lys.roots.nw', position: [-22, -28], scale: 1.3, rotation: 0.6 },
  { kind: 'glowing_purple_coral', id: 'lys.coral.nw', position: [-30, -18], scale: 1.1 },
  { kind: 'purple_coral', id: 'lys.coral.nw.b', position: [-38, -12], scale: 0.95 },
  { kind: 'neon_vascular_tree', id: 'lys.tree.north', position: [4, -32], scale: 1.3, rotation: 0.2 },
  { kind: 'tangled_root_sculpture', id: 'lys.roots.north', position: [-6, -28], scale: 1.1, rotation: 0.4 },
  { kind: 'glowing_purple_coral', id: 'lys.coral.north', position: [-16, -32], scale: 1.0 },
  { kind: 'purple_stone_cairn', id: 'lys.cairn.north', position: [10, -36], scale: 0.9 },
  { kind: 'neon_vascular_tree', id: 'lys.tree.a', position: [-18, 4], scale: 1.2, rotation: 0.4 },
  { kind: 'neon_vascular_tree', id: 'lys.tree.b', position: [32, -8], scale: 1.0, rotation: -0.2 },
  { kind: 'trilo', id: 'lys.trilo.a', position: [-15, 8], scale: 1.3, rotation: 0.8, color: '#a456c8', emissive: '#2a1140' },
  { kind: 'trilo', id: 'lys.trilo.b', position: [10, 12], scale: 1.1, rotation: -1.1, color: '#bf5fd8', emissive: '#321252' },
  { kind: 'trilo', id: 'lys.trilo.c', position: [22, 4], scale: 1.0, rotation: 0.3, color: '#9c4fb8', emissive: '#220a35' },
  trailCairn('trail.a', 2, 14),
  trailCairn('trail.b', -2, 24),
];

const HAGEVERDEN_WORLD_SPAWNS = [
  { kind: 'artifact', id: 'chain.artifact.lysningen', position: [-32, -55], region: 'lysningen' },
  {
    kind: 'portal',
    id: 'chain.portal.blod',
    position: [0, -90],
    targetRegion: 'blod',
    requiredKey: 'blod',
    colorA: '#ff8a8a',
    colorB: '#5a0408',
    texture: '/hageverden/world-portal.gif',
  },
  { kind: 'purple_stone_cairn', id: 'chain.trail.lys.a', position: [-5, -30], scale: 0.55 },
  { kind: 'purple_stone_cairn', id: 'chain.trail.lys.b', position: [5, -45], scale: 0.55 },
  { kind: 'purple_stone_cairn', id: 'chain.trail.lys.c', position: [-5, -60], scale: 0.6 },
  { kind: 'purple_stone_cairn', id: 'chain.trail.lys.d', position: [5, -72], scale: 0.6 },
  { kind: 'purple_stone_cairn', id: 'chain.trail.lys.e', position: [-5, -84], scale: 0.7 },
  { kind: 'skate', id: 'skate.clearing.orbit', position: [0, -2], radius: 45, height: 5, period: 48, scale: 0.2 },
];

const HAGEVERDEN = {
  spawnPoint: { x: 0, z: 0 },
  spawns: [...applyWorldScale(HAGEVERDEN_BASE_SPAWNS), ...HAGEVERDEN_WORLD_SPAWNS, ...perimeterRing()],
};

// --- BLODVERDEN -----------------------------------------------------
const blodCenter = REGIONS.blod.center;
const BCX = blodCenter[0];
const BCZ = blodCenter[1];
const ASSET_BLOD = '/blodverden/';
const PLANT = `${ASSET_BLOD}antler-plant.png`;
const HEART_WING = `${ASSET_BLOD}heart-wing.png`;
const MOTH = `${ASSET_BLOD}moth.png`;
const PORTAL_TEX = `${ASSET_BLOD}gothic-arch.png`;
const FLIS_PORTAL = `${ASSET_BLOD}butterfly-portal.png`;

const BLODVERDEN_SPAWNS = [
  { kind: 'blod_sprite', id: 'blod.heart.center', position: [BCX, BCZ], texture: HEART_WING, height: 22, glow: 1.0, tint: '#ffffff' },
  { kind: 'mythical_horse', id: 'blod.horse.center', position: [BCX + 12, BCZ + 8], scale: 10.0, rotation: -Math.PI / 6 },
  { kind: 'blod_sprite', id: 'blod.plant.a', position: [BCX - 10, BCZ - 4], texture: PLANT, height: 2.4, tint: '#e8b8b8', glow: 0.7 },
  { kind: 'blod_sprite', id: 'blod.plant.b', position: [BCX + 12, BCZ - 8], texture: PLANT, height: 2.6, tint: '#f0c0c0', glow: 0.7 },
  { kind: 'blod_sprite', id: 'blod.plant.c', position: [BCX - 16, BCZ + 4], texture: PLANT, height: 2.2, tint: '#e0a8a8', glow: 0.7 },
  { kind: 'blod_sprite', id: 'blod.plant.d', position: [BCX + 18, BCZ + 6], texture: PLANT, height: 2.8, tint: '#ecb4b4', glow: 0.7 },
  { kind: 'blod_sprite', id: 'blod.plant.e', position: [BCX - 6, BCZ + 16], texture: PLANT, height: 2.1, tint: '#d8a0a0', glow: 0.7 },
  { kind: 'blod_sprite', id: 'blod.plant.f', position: [BCX + 4, BCZ - 18], texture: PLANT, height: 2.4, tint: '#e8b0b0', glow: 0.7 },
  { kind: 'blod_sprite', id: 'blod.plant.g', position: [BCX - 20, BCZ - 12], texture: PLANT, height: 2.6, tint: '#f0bcbc', glow: 0.7 },
  { kind: 'blod_sprite', id: 'blod.plant.h', position: [BCX + 16, BCZ - 22], texture: PLANT, height: 2.5, tint: '#dcacac', glow: 0.7 },
  { kind: 'blod_sprite', id: 'blod.plant.i', position: [BCX - 4, BCZ - 12], texture: PLANT, height: 2.0, tint: '#e4acac', glow: 0.7 },
  { kind: 'blod_sprite', id: 'blod.plant.j', position: [BCX + 8, BCZ + 14], texture: PLANT, height: 2.3, tint: '#e8b4b4', glow: 0.7 },
  { kind: 'blod_sprite', id: 'blod.plant.k', position: [BCX - 30, BCZ - 4], texture: PLANT, height: 2.7, tint: '#f0c4c4', glow: 0.7 },
  { kind: 'blod_sprite', id: 'blod.plant.l', position: [BCX + 28, BCZ - 2], texture: PLANT, height: 2.5, tint: '#e4b0b0', glow: 0.7 },
  { kind: 'blod_sprite', id: 'blod.plant.m', position: [BCX - 26, BCZ + 18], texture: PLANT, height: 2.4, tint: '#d8a4a4', glow: 0.7 },
  { kind: 'blod_sprite', id: 'blod.plant.n', position: [BCX + 24, BCZ + 22], texture: PLANT, height: 2.8, tint: '#f0c8c8', glow: 0.7 },
  { kind: 'blod_sprite', id: 'blod.plant.o', position: [BCX - 34, BCZ + 10], texture: PLANT, height: 2.2, tint: '#e0a8a8', glow: 0.7 },
  { kind: 'blod_sprite', id: 'blod.plant.p', position: [BCX + 32, BCZ + 12], texture: PLANT, height: 2.6, tint: '#ecb4b4', glow: 0.7 },
  { kind: 'blod_sprite', id: 'blod.plant.q', position: [BCX - 14, BCZ + 26], texture: PLANT, height: 2.3, tint: '#d8a0a0', glow: 0.7 },
  { kind: 'blod_sprite', id: 'blod.plant.r', position: [BCX + 14, BCZ + 28], texture: PLANT, height: 2.5, tint: '#e8b8b8', glow: 0.7 },
  { kind: 'blod_sprite', id: 'blod.plant.s', position: [BCX - 8, BCZ - 28], texture: PLANT, height: 2.4, tint: '#e4acac', glow: 0.7 },
  { kind: 'blod_sprite', id: 'blod.plant.t', position: [BCX + 22, BCZ - 14], texture: PLANT, height: 2.7, tint: '#f0bcbc', glow: 0.7 },
  { kind: 'blod_sprite', id: 'blod.plant.u', position: [BCX - 22, BCZ - 22], texture: PLANT, height: 2.5, tint: '#dcacac', glow: 0.7 },
  { kind: 'blod_sprite', id: 'blod.plant.v', position: [BCX + 6, BCZ + 32], texture: PLANT, height: 2.3, tint: '#e8b0b0', glow: 0.7 },
  { kind: 'blod_sprite', id: 'blod.plant.w', position: [BCX - 12, BCZ + 10], texture: PLANT, height: 2.1, tint: '#d4a0a0', glow: 0.7 },
  { kind: 'blod_sprite', id: 'blod.plant.x', position: [BCX + 10, BCZ - 28], texture: PLANT, height: 2.6, tint: '#ecb8b8', glow: 0.7 },
  { kind: 'blod_sprite', id: 'blod.plant.y', position: [BCX - 18, BCZ + 2], texture: PLANT, height: 2.2, tint: '#e0a8a8', glow: 0.7 },
  { kind: 'blod_sprite', id: 'blod.plant.z', position: [BCX + 18, BCZ + 10], texture: PLANT, height: 2.4, tint: '#e4b0b0', glow: 0.7 },
  { kind: 'blod_sprite', id: 'blod.moth.center', position: [BCX + 6, BCZ - 6], texture: MOTH, height: 3.4, yOffset: 4.0, glow: 1.0, tint: '#e0f2ff', noCollide: true },
  { kind: 'blod_sprite', id: 'blod.moth.west', position: [BCX - 12, BCZ + 2], texture: MOTH, height: 2.8, yOffset: 5.0, glow: 1.0, tint: '#d4e8ff', noCollide: true },
  { kind: 'blod_sprite', id: 'blod.moth.south', position: [BCX + 2, BCZ + 10], texture: MOTH, height: 3.0, yOffset: 3.5, glow: 1.0, tint: '#e8f4ff', noCollide: true },
  { kind: 'blod_sprite', id: 'blod.portal.north', position: [BCX, BCZ - 22], texture: PORTAL_TEX, height: 11, glow: 1.0 },
  { kind: 'blod_sprite', id: 'blod.portal.flis', position: [BCX - 22, BCZ + 4], texture: FLIS_PORTAL, height: 9, glow: 0.9, tint: '#ffe8d8' },
  { kind: 'key', id: 'blod.key.geometri', position: [BCX + 12, BCZ + 4], opens: 'geometri' },
];

const BLODVERDEN = {
  spawnPoint: { x: BCX, z: BCZ + 18 },
  spawns: BLODVERDEN_SPAWNS,
};

// --- FLISVERDEN -----------------------------------------------------
const geoCenter = REGIONS.geometri.center;
const GCX = geoCenter[0];
const GCZ = geoCenter[1];
// FlisPool constants (POOL_TILE=8, POOL_TILES_X=7, POOL_TILES_Z=3)
const POOL_TILE = 8.0;
const POOL_TILES_X = 7;
const POOL_TILES_Z = 3;
const POOL_CX = GCX;
const POOL_CZ = GCZ - 4;
const POOL_HALF_X = (POOL_TILES_X * POOL_TILE) / 2;
const POOL_HALF_Z = (POOL_TILES_Z * POOL_TILE) / 2;
const PLAZA_HALF = 110;
const NORTH_DEPTH = POOL_CZ - POOL_HALF_Z - (GCZ - PLAZA_HALF);
const SOUTH_DEPTH = (GCZ + PLAZA_HALF) - (POOL_CZ + POOL_HALF_Z);
const SIDE_WIDTH = (GCX + PLAZA_HALF) - (POOL_CX + POOL_HALF_X);

const FLISVERDEN = {
  spawnPoint: { x: POOL_CX, z: POOL_CZ + POOL_HALF_Z + 6 },
  spawns: [
    { kind: 'flis_floor', id: 'flis.floor.north', position: [GCX, POOL_CZ - POOL_HALF_Z - NORTH_DEPTH / 2], width: PLAZA_HALF * 2, depth: NORTH_DEPTH, tileSize: POOL_TILE },
    { kind: 'flis_floor', id: 'flis.floor.south', position: [GCX, POOL_CZ + POOL_HALF_Z + SOUTH_DEPTH / 2], width: PLAZA_HALF * 2, depth: SOUTH_DEPTH, tileSize: POOL_TILE },
    { kind: 'flis_floor', id: 'flis.floor.east', position: [POOL_CX + POOL_HALF_X + SIDE_WIDTH / 2, POOL_CZ], width: SIDE_WIDTH, depth: POOL_HALF_Z * 2, tileSize: POOL_TILE },
    { kind: 'flis_floor', id: 'flis.floor.west', position: [POOL_CX - POOL_HALF_X - SIDE_WIDTH / 2, POOL_CZ], width: SIDE_WIDTH, depth: POOL_HALF_Z * 2, tileSize: POOL_TILE },
    { kind: 'flis_pool', id: 'flis.pool.main', position: [POOL_CX, POOL_CZ] },
    { kind: 'giantess', id: 'flis.giantess.nw', position: [POOL_CX - POOL_HALF_X - 10, POOL_CZ - POOL_HALF_Z - 4], rotation: -Math.PI / 4 },
    { kind: 'giantess', id: 'flis.giantess.ne', position: [POOL_CX + POOL_HALF_X + 10, POOL_CZ - POOL_HALF_Z - 4], rotation: Math.PI + Math.PI / 4 },
    { kind: 'giantess', id: 'flis.giantess.n', position: [POOL_CX, POOL_CZ - POOL_HALF_Z - 14], rotation: Math.PI },
    { kind: 'key', id: 'flis.key.siste', position: [POOL_CX + POOL_HALF_X + 4, POOL_CZ], opens: 'siste' },
  ],
};

// --- SALTVERDEN -----------------------------------------------------
const siCenter = REGIONS.siste.center;
const SCX = siCenter[0];
const SCZ = siCenter[1];
const SALTVERDEN = {
  spawnPoint: { x: SCX, z: SCZ },
  spawns: [
    { kind: 'key', id: 'salt.key.senter', position: [SCX + 4, SCZ + 2], opens: 'senter' },
  ],
};

// --- SPEILVERDEN ----------------------------------------------------
const seCenter = REGIONS.senter.center;
const ECX = seCenter[0];
const ECZ = seCenter[1];
const SPEILVERDEN = {
  spawnPoint: { x: ECX, z: ECZ },
  spawns: [
    { kind: 'kjeller_mirror', id: 'kjeller.mirror.floor', position: [ECX, ECZ], width: 240, depth: 240, color: '#ffffff', resolution: 1024 },
  ],
};

// --- write ----------------------------------------------------------
const targets = [
  { name: 'hageverden', data: HAGEVERDEN },
  { name: 'blodverden', data: BLODVERDEN },
  { name: 'flisverden', data: FLISVERDEN },
  { name: 'saltverden', data: SALTVERDEN },
  { name: 'speilverden', data: SPEILVERDEN },
];

for (const { name, data } of targets) {
  const dest = path.join(ROOT, 'src', 'game', 'levels', name, 'spawns.json');
  fs.writeFileSync(dest, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log(`wrote ${dest} (${data.spawns.length} spawns)`);
}

console.log('done');
