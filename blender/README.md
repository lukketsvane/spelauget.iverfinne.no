# Spelauget Blender Level Editor

Edit and create entire game levels visually in Blender — drag, rotate,
scale spawns in 3D, hit **Export**, and the change shows up in the
running game on save (Next.js HMR picks up the JSON instantly).

## How the pieces fit together

```
/blender/
  spelauget_levels_addon.py        ← install this in Blender (once)
  levels/                          ← put your .blend files here
    hagen.blend
    blodverden.blend
    ...

/src/game/levels/<world>/
  spawns.json                      ← source of truth (Blender writes here)
  dialogue.ts                      ← NPC dialogue trees, keyed by spawn id
  index.ts                         ← loads spawns.json + merges dialogue

/scripts/bake-spawns.mjs           ← one-shot seed (already run; for ref)
```

The TypeScript level files have collapsed to ~10 lines each — they
just import the JSON and pass it through `loader.ts`, which mixes in
the per-world dialogue map at runtime.

## Install the addon (once per machine)

1. **Edit → Preferences → Add-ons → Install...**
2. Pick `blender/spelauget_levels_addon.py`.
3. Tick the checkbox to enable **Spelauget Level Editor**.
4. In a 3D Viewport, press **N** to open the sidebar. There's a new
   "Spelauget" tab.

## Per-`.blend`-file setup

1. Open (or create) `blender/levels/<world>.blend`. One `.blend` per
   world; the addon assumes one world per scene.
2. In the **Spelauget** sidebar:
   - Set **Repo** to the absolute path of this repo
     (e.g. `C:\Users\Shadow\Documents\GitHub\spelauget.iverfinne.no`).
   - Pick the **World** from the dropdown.
3. Hit **Import Level**. The current `spawns.json` is read in: one
   Empty per spawn, plus a sphere for the player spawn point. Painted
   sprites (`blod_sprite`, `relic`, `remnant`, portals) load their PNG
   and show as billboards.
4. Save the `.blend`.

## Editing

- **Move / rotate / scale** Empties like any object. The transform
  drives `position`, `rotation` (Z-axis = yaw), and uniform `scale`
  in the JSON.
- **Add a new spawn**: pick a **Kind** in the Add Spawn box, hit
  **+ Add Spawn**. A new Empty appears at the 3D cursor with sane
  defaults for its kind. Rename the empty to set the spawn `id`.
- **Edit kind-specific fields** (texture, height, glow, tint,
  targetRegion, opens, …): with the Empty selected, open
  **Object Properties → Custom Properties**. Each property maps 1:1
  to a field in the spawn JSON. Add a property to introduce a new
  field; delete it to drop the field.
- **Move the player spawn point**: drag the sphere named
  `__spawnpoint_<world>`. Its X / Y become `spawnPoint.x / z`.

### Coordinate mapping

| Blender                  | Game (Three.js)                                |
|--------------------------|------------------------------------------------|
| location X               | `position[0]` (x)                              |
| location Y               | `position[1]` (z, the second floor-plane axis) |
| location Z               | (ignored — JSON is 2D)                         |
| rotation Z (yaw)         | `rotation` (radians, around game Y-axis)       |
| uniform scale            | `scale`                                        |

Floor plane in Blender is XY (Z-up). Floor plane in-game is XZ
(Y-up). The addon maps Blender Y → game Z so what you see top-down
in Blender matches the iso camera framing.

## Exporting

Hit **Export Level**. The addon walks the world's collection, writes
`src/game/levels/<world>/spawns.json`, and reports the count. If
`npm run dev` is running, Next.js HMR re-imports the JSON and the
level updates without a page reload.

## Adding a new spawn kind

If you introduced a new `Spawn` variant in `src/game/levels/types.ts`:

1. Open `blender/spelauget_levels_addon.py`.
2. Add a row to `KIND_ITEMS` (the dropdown).
3. Optional: add a row to `KIND_DEFAULTS` so newly-added spawns of
   that kind start with sensible field values.
4. Disable + re-enable the addon, or restart Blender.

## Dialogue is still authored in TS

Star/Boble NPCs need a `dialogue: DialogueLine[]` array. Authoring
structured dialogue trees in Blender custom properties would be ugly,
so dialogue lives in `src/game/levels/<world>/dialogue.ts` keyed by
spawn id. When you add a new NPC in Blender, also add an entry to
`dialogue.ts` matching its `id`. The loader merges them automatically.

## Troubleshooting

- **Empty doesn't show its sprite image.** Check the `texture`
  custom property points at an existing file under `/public/`. The
  addon tries to load it from `<repo>/public/<texture>`.
- **TypeScript build fails after export.** The Blender addon doesn't
  enforce the `Spawn` type schema — if you add a kind-specific field
  that's not in `types.ts`, TS will reject it. Either add the field
  to the appropriate Spawn type, or delete the custom property in
  Blender.
- **HMR didn't pick up the change.** Save the `.blend` after
  exporting, and verify `spawns.json` actually changed on disk.
  Hard-refresh the browser if needed.
- **Coordinates feel wrong.** Remember Blender Y is the game's Z.
  In top-down view (numpad 7), "up the screen" is +Y in Blender =
  +Z in game = "south" in the iso camera. Walking north in-game
  means decreasing the spawn's `position[1]` (Blender -Y).

## Re-seeding from TypeScript

If you ever need to wipe the JSON and rebuild it from the current
TS state (e.g. someone hand-edited `spawns.json` and you want the
original layout back), run:

```
node scripts/bake-spawns.mjs
```

That script has the original spawn arrays inlined as plain data —
it's a one-shot baseline, not a round-trip exporter.
