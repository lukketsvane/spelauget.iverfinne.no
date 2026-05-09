// Level definitions are pure data. Each level has a palette and a list
// of spawns; the rest of the game is driven from this map.
//
// Adding a new level:
//   1. Add a key to LEVELS with id/name/palette/playerSpawn/spawns.
//   2. Reference the level by id from a portal's targetLevel field.
//   3. (Optional) override gradient stops with a distinct mood palette.
//
// Adding a new spawn kind:
//   1. Add the variant to the Spawn union below.
//   2. Add a case in Spawns.tsx that mounts the matching component.
//
// Coordinates are in world units (metres). The grid is centred on world
// origin so positive X = east, positive Z = south. A 0.5 m tweak on a
// position is fine, no need to align to grid lines.

import type { DialogueLine } from '@/store/dialogue';
import type { Stop } from './gradients';

export type LevelId = 'level1' | 'level2';

export type StarNpcSpawn = {
  kind: 'star_npc';
  id: string;
  position: [number, number]; // [x, z]
  dialogue: DialogueLine[];
};

export type BobleNpcSpawn = {
  kind: 'boble_npc';
  id: string;
  position: [number, number];
  dialogue: DialogueLine[];
};

export type PortalSpawn = {
  kind: 'portal';
  id: string;
  position: [number, number];
  targetLevel: LevelId;
  colorA?: string;
  colorB?: string;
};

export type StoneHutSpawn = {
  kind: 'stone_hut';
  id: string;
  position: [number, number];
  scale?: number;
  rotation?: number;
};

export type RockStackSpawn = {
  kind: 'rock_stack';
  id: string;
  position: [number, number];
  scale?: number;
  rotation?: number;
};

export type Spawn =
  | StarNpcSpawn
  | BobleNpcSpawn
  | PortalSpawn
  | StoneHutSpawn
  | RockStackSpawn;

export type LevelDefinition = {
  id: LevelId;
  name: string;
  groundGradient: Stop[];
  plantGradient: Stop[];
  plantHaloGradient: Stop[];
  playerSpawn: { x: number; z: number };
  spawns: Spawn[];
};

// --- Level 1 — Lysningen — bright luminous magenta/lavender -------------
// Designed to glow against the dark fog like the bioluminescent forest
// reference: most stops sit in the bright half of the spectrum so even
// the dim parts of the source PNGs read as luminous flora.
const LYSNINGEN_GROUND: Stop[] = [
  [0.0, '#8e6dc0'],
  [0.35, '#b497d6'],
  [0.7, '#d7c2eb'],
  [1.0, '#f6e8fa'],
];
const LYSNINGEN_PLANT: Stop[] = [
  [0.0, '#5a1c95'],
  [0.3, '#b446e0'],
  [0.55, '#ff6fd0'],
  [0.8, '#ffb0e6'],
  [1.0, '#fff5fa'],
];
// Halo: starts darkening earlier so a wider band of the source pixels
// gets pushed into the bright additive layer, simulating bloom.
const LYSNINGEN_HALO: Stop[] = [
  [0.0, '#000000'],
  [0.4, '#000000'],
  [0.55, '#7a2db8'],
  [0.75, '#ff60d0'],
  [0.9, '#ffaee5'],
  [1.0, '#fff5fc'],
];

// --- Level 2 — Stjerneengen — cool aqua/teal ----------------------------
const STJERNE_GROUND: Stop[] = [
  [0.0, '#1f4658'],
  [0.35, '#3b758a'],
  [0.7, '#7ab2c0'],
  [1.0, '#c7e8ec'],
];
const STJERNE_PLANT: Stop[] = [
  [0.0, '#062840'],
  [0.35, '#1b6e94'],
  [0.6, '#2eb6b8'],
  [0.85, '#7ff0d4'],
  [1.0, '#e8fff5'],
];
const STJERNE_HALO: Stop[] = [
  [0.0, '#000000'],
  [0.55, '#000000'],
  [0.7, '#0f4a6e'],
  [0.85, '#3df0d8'],
  [1.0, '#ddfff8'],
];

export const LEVELS: Record<LevelId, LevelDefinition> = {
  level1: {
    id: 'level1',
    name: 'Lysningen',
    groundGradient: LYSNINGEN_GROUND,
    plantGradient: LYSNINGEN_PLANT,
    plantHaloGradient: LYSNINGEN_HALO,
    playerSpawn: { x: 0, z: 0 },
    spawns: [
      {
        kind: 'stone_hut',
        id: 'l1.hut.center',
        position: [0, -16],
        scale: 16,
      },
      {
        kind: 'rock_stack',
        id: 'l1.rock.south',
        position: [0, 8],
      },
      {
        kind: 'star_npc',
        id: 'l1.star.welcome',
        position: [-4, -8],
        dialogue: [
          { text: 'Stå stille et øyeblikk.' },
          {
            text: 'Hører du det? Under jorda. Det er ikke meg som lager den lyden. Jeg har ligget her i tre dager og lyttet, og jeg er ganske sikker nå.',
          },
          {
            text: 'Det er noen som puster der nede. Eller noen som snakker, men sakte, som om de glemmer ordene mellom hver gang.',
          },
          { action: true, text: 'rekker fram noe gjennom jorda' },
          {
            text: 'Her. Den var ikke min. Jeg fant den under en stein som ikke ville flytte seg, helt til den plutselig ville. Sånne steiner skal man ikke stole på, men nøkler kan man stole på. Nøkler vil bare én ting.',
          },
          {
            text: 'Bær den helt inn. Helt, helt inn. Til der hvor lysninga slutter å være lysning.',
          },
          {
            text: 'Og — hvis du møter en bil som står parkert hvor det ikke skal stå en bil: gå rundt. Ikke se inn.',
          },
        ],
      },
      {
        kind: 'portal',
        id: 'l1.portal.to.l2',
        position: [12, 16],
        targetLevel: 'level2',
      },
    ],
  },

  level2: {
    id: 'level2',
    name: 'Stjerneengen',
    groundGradient: STJERNE_GROUND,
    plantGradient: STJERNE_PLANT,
    plantHaloGradient: STJERNE_HALO,
    playerSpawn: { x: 0, z: 0 },
    spawns: [
      {
        kind: 'portal',
        id: 'l2.portal.to.l1',
        position: [-12, -20],
        targetLevel: 'level1',
        colorA: '#a4d8ff',
        colorB: '#3a4cff',
      },
      {
        kind: 'stone_hut',
        id: 'l2.hut.west',
        position: [-12, 4],
        scale: 14,
        rotation: 0.3,
      },
      {
        kind: 'stone_hut',
        id: 'l2.hut.east',
        position: [12, 4],
        scale: 14,
        rotation: -0.4,
      },
      {
        kind: 'rock_stack',
        id: 'l2.rock.center',
        position: [0, 8],
      },
      {
        kind: 'star_npc',
        id: 'l2.star.elder',
        position: [0, 16],
        dialogue: [
          { text: 'her er det enno blåare enn der borte' },
          { text: 'om du går langt nok, kjem du fram til verdsenden' },
          { text: 'eller kanskje berre tilbake til Lysningen' },
        ],
      },
      {
        kind: 'boble_npc',
        id: 'l2.boble.bobble',
        position: [8, -8],
        dialogue: [
          { text: 'hei eg heiter Bobble' },
          { text: 'velkommen til Stjerneengen' },
          { text: 'her snur lyset blått om natta' },
          { text: 'ein dag finn du kanskje vegen heim' },
        ],
      },
    ],
  },
};

export function findPlayerSpawn(level: LevelDefinition): { x: number; z: number } {
  return level.playerSpawn;
}
