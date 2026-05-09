// Pixel-grid level format. Each character in a row is one cell of the
// world. The grid is centred on world origin (0,0). Add new levels here
// — the rest of the game is data-driven from this map.
//
// Symbol → entity:
//   .  empty (open ground)
//   @  player spawn point (only one per level)
//   N  star NPC
//   #  stone hut
//   r  rock stack
//   1  portal to level1
//   2  portal to level2
//
// Edit by hand or paint visually; rows must be the same length.

export const LEVEL_CELL_SIZE = 4; // world units per grid cell

export type CellKind =
  | 'empty'
  | 'player_spawn'
  | 'star_npc'
  | 'stone_hut'
  | 'rock_stack'
  | 'portal_to_level1'
  | 'portal_to_level2';

const CELL_MAP: Record<string, CellKind> = {
  '.': 'empty',
  '@': 'player_spawn',
  N: 'star_npc',
  '#': 'stone_hut',
  r: 'rock_stack',
  '1': 'portal_to_level1',
  '2': 'portal_to_level2',
};

export type LevelDefinition = {
  id: string;
  name: string;
  rows: string[];
};

export const LEVELS = {
  level1: {
    id: 'level1',
    name: 'Lysningen',
    rows: [
      '..............',
      '..............',
      '......#.......',
      '..............',
      '.....N........',
      '..............',
      '......@.......',
      '..............',
      '......r.......',
      '..............',
      '..............',
      '.........2....',
      '..............',
      '..............',
    ],
  },
  level2: {
    id: 'level2',
    name: 'Stjerneengen',
    rows: [
      '..............',
      '...1..........',
      '..............',
      '..............',
      '......@.......',
      '..............',
      '...#....#.....',
      '..............',
      '......r.......',
      '..............',
      '......N.......',
      '..............',
      '..............',
      '..............',
    ],
  },
} as const satisfies Record<string, LevelDefinition>;

export type LevelId = keyof typeof LEVELS;

export type Spawn = {
  kind: CellKind;
  x: number; // world units
  z: number;
  // Stable id so React keys + interaction claims don't collide.
  id: string;
};

export function parseLevelSpawns(level: LevelDefinition): Spawn[] {
  const rows = level.rows;
  const height = rows.length;
  const width = rows[0]?.length ?? 0;
  // Centre the grid on world origin.
  const offsetX = (width - 1) / 2;
  const offsetZ = (height - 1) / 2;
  const spawns: Spawn[] = [];
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < rows[r].length; c++) {
      const ch = rows[r][c];
      const kind = CELL_MAP[ch];
      if (!kind || kind === 'empty') continue;
      spawns.push({
        kind,
        x: (c - offsetX) * LEVEL_CELL_SIZE,
        z: (r - offsetZ) * LEVEL_CELL_SIZE,
        id: `${level.id}:${kind}:${c},${r}`,
      });
    }
  }
  return spawns;
}

export function findPlayerSpawn(level: LevelDefinition): { x: number; z: number } {
  const found = parseLevelSpawns(level).find((s) => s.kind === 'player_spawn');
  return found ? { x: found.x, z: found.z } : { x: 0, z: 0 };
}
