// Glue between the per-world `spawns.json` (exported from Blender)
// and the runtime `Spawn[]` shape the game consumes. JSON owns
// transforms / kind / kind-specific simple fields; dialogue trees for
// star_npc / boble_npc live in a per-world dialogue.ts and get
// merged in by spawn id.

import type { DialogueLine } from '@/store/dialogue';
import type { Spawn } from './types';

export type RawLevelData = {
  spawnPoint: { x: number; z: number };
  spawns: unknown[];
};

// Reads a raw `spawns.json` payload and produces the runtime
// `Spawn[]`. NPC spawns get their dialogue table attached from the
// per-world dialogue map; non-NPC spawns pass straight through. We
// cast the raw spawn through `unknown` because TS' JSON inference
// widens enum-like strings (`kind`) into `string` — the spawn
// schema is enforced authoritatively by the Blender exporter, so
// runtime trust is fine here.
export function loadLevel(
  raw: RawLevelData,
  dialogue: Record<string, DialogueLine[]> = {},
): { spawns: Spawn[]; spawnPoint: { x: number; z: number } } {
  const spawns = raw.spawns.map((entry) => {
    const s = entry as Spawn;
    if (s.kind === 'star_npc' || s.kind === 'boble_npc') {
      return { ...s, dialogue: dialogue[s.id] ?? [] } as Spawn;
    }
    return s;
  });
  return { spawns, spawnPoint: raw.spawnPoint };
}
