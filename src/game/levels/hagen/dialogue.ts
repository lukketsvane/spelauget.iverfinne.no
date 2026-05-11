// Per-spawn dialogue tables for Hagen. Keyed by the spawn `id` in
// spawns.json — the loader in index.ts merges these into the
// matching star_npc / boble_npc spawns at runtime.
//
// Dialogue stays in TS (not JSON) because the structured text + the
// `action: true` marker are awkward to author in Blender custom
// properties; the level editor only owns geometry / transforms /
// kind-specific knobs. Add a new spawn id here as soon as you add a
// new NPC in Blender.

import type { DialogueLine } from '@/store/dialogue';

export const HAGEN_DIALOGUE: Record<string, DialogueLine[]> = {
  'lys.star.welcome': [
    { text: 'Stand still for a moment.' },
    {
      text: "Do you hear it? Under the earth. I'm not the one making that sound. I've lain here for three days listening, and I'm fairly sure now.",
    },
    {
      text: 'There is someone breathing down there. Or someone speaking, slowly, as if they forget the words between each one.',
    },
    { action: true, text: 'reaches something out through the soil' },
    {
      text: "Here. It wasn't mine. I found it beneath a stone that wouldn't move, until it suddenly would. You shouldn't trust stones like that, but you can trust keys. Keys only want one thing.",
    },
    {
      text: 'Carry it all the way in. All, all the way in. To where the clearing stops being a clearing.',
    },
  ],
  'lys.boble.bobble': [
    { text: 'Oh, a fresh face. The lights felt it before I did.' },
    { text: "I'm Bobble. I don't have legs. Just opinions, and wind." },
    { action: true, text: 'tilts, drifts a hand-width sideways, drifts back' },
    {
      text: 'So the digger gave you the key. They give it to most. I never asked why.',
    },
    {
      text: "Take it north. The clearing thins out up there. You'll see what they meant.",
    },
  ],
};
