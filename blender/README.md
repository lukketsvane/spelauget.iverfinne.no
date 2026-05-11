# Spelauget Blender Level Editor

Edit and create entire game levels visually in Blender — drag, rotate,
scale spawns in 3D, hit **Export**, and the change shows up in the
running game on save (Next.js HMR picks up the JSON instantly).

## How the pieces fit together

```
/blender/
  spelauget_levels_addon.py     ← install this in Blender (once)
  levels/                       ← one .blend per world
    hageverden.blend
    blodverden.blend
    flisverden.blend
    saltverden.blend
    speilverden.blend

/src/game/levels/<world>/
  spawns.json                   ← source of truth (Blender writes here)
  dialogue.ts                   ← NPC dialogue trees, keyed by spawn id
  index.ts                      ← loads spawns.json + merges dialogue

/scripts/
  bake-spawns.mjs               ← regenerate JSON from the original TS data
  clean-glb-names.py            ← strip tripo_node_* names out of GLB files
```

The TypeScript level files have collapsed to ~10 lines each — they
just import the JSON and pass it through `loader.ts`, which mixes in
the per-world dialogue map at runtime.

## What you see in Blender after Import Level

- **Cyan / red / pink / silver / violet ground disc** — the
  region-tinted Add Ground Reference, matches the in-game palette.
- **Real GLB instances** for kinds that have a 3D model — giantesses,
  corals, the chrome horse, vascular trees, stone cairns, … They use
  the same default scale (`giantess = 11x`, `trilo = 1.5x`, etc.) as
  the game's components, so the layout you see is the layout you get.
- **Image billboards** for painted-card kinds (`blod_sprite`,
  `relic`, `remnant`, painted portals). The PNG loads from `/public/`.
- **Plain axes empties** for the rest — keys, artifacts, NPCs, etc.

## Install the addon (once per machine)

Easiest path via the Python console (in any Blender):

```python
import bpy
bpy.ops.preferences.addon_install(
    filepath=r"C:\path\to\spelauget.iverfinne.no\blender\spelauget_levels_addon.py")
bpy.ops.preferences.addon_enable(module="spelauget_levels_addon")
bpy.ops.wm.save_userpref()
```

Or via the GUI: Edit → Preferences → Add-ons → Install... → pick the
file → tick the checkbox. Look for the **Spelauget** tab in the N-panel
of the 3D viewport.

## Per-`.blend` setup (do this once per world)

1. Open Blender, then File → New → General. Save As
   `blender/levels/<world>.blend`.
2. Press **N** to open the sidebar → click the **Spelauget** tab.
3. **Repo**: absolute path to the repo (e.g.
   `C:/Users/.../spelauget.iverfinne.no`). Forward slashes work fine.
4. **World**: pick the world this `.blend` represents.
5. **Import Level** — the spawns appear as a `spawns_<world>`
   collection. Adds a `__spawnpoint_<world>` sphere for the player
   spawn and a `__ground_<world>` / `__bounds_<world>` for the region.
6. **Add Ground Reference** — drops the tinted disc + the
   WORLD_RADIUS=120 wire ring at the region centre (both flagged so
   the exporter skips them).

## Editing

- **Move / rotate / scale** Empties like any object. The transform
  drives `position`, `rotation` (Z-axis = yaw), and uniform `scale`
  in the JSON.
- **Add a new spawn**: pick a **Kind** in the Add Spawn box, hit
  **+ Add Spawn**. The kind dropdown is filtered to the active
  world's allowlist + the chain kinds (`key`, `portal`, `artifact`, …).
  A new Empty appears at the 3D cursor with sane defaults; rename it
  to set the spawn `id`.
- **Edit kind-specific fields** (texture, height, glow, tint,
  targetRegion, opens, …): with the Empty selected, open Object
  Properties → Custom Properties. Each property maps 1:1 to a field
  in the spawn JSON. Add a property to introduce a new field; delete
  it to drop the field.
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

1. Add a row to `KIND_ITEMS` in `spelauget_levels_addon.py` (the
   dropdown).
2. If the kind has a GLB asset → add a row to `KIND_GLB`. If the
   game component uses a non-1.0 default scale → add a row to
   `KIND_DEFAULT_SCALE` so the preview matches.
3. Optional: add a row to `KIND_DEFAULTS` so newly-added spawns of
   that kind start with sensible field values.
4. List the kind in `WORLD_KIND_ALLOWLIST[<world>]` for every world
   it can appear in (or add to `CHAIN_KINDS` if it's cross-world).
5. Re-install the addon (the Python install command at the top of
   this file overwrites the previous copy).

## Dialogue is still authored in TS

Star/Boble NPCs need a `dialogue: DialogueLine[]` array. Authoring
structured dialogue trees in Blender custom properties would be ugly,
so dialogue lives in `src/game/levels/<world>/dialogue.ts` keyed by
spawn id. When you add a new NPC in Blender, also add an entry to
`dialogue.ts` matching its `id`. The loader merges them automatically.

## Cleaning ugly mesh names inside GLBs

Tripo and other AI mesh generators leave names like
`tripo_node_8b8c229e-…` inside the .glb files. Those leak into the
Blender outliner the moment you drop the asset into the scene. To
clean them up across the whole asset library in one shot:

```
blender --background --python scripts/clean-glb-names.py
```

The script opens every `.glb` under `public/models/` and
`public/flisverden/`, renames any junk-named meshes / objects /
materials / armatures to use the file's basename, and writes the GLB
back. Idempotent — re-run any time.

## Troubleshooting

- **GLB preview is invisible.** Make sure the source `.glb` exists
  under `/public/`. The addon caches loaded GLBs in collections named
  `_glb_lib_<url>`; if a load failed once, deleting that collection
  via the outliner and re-running Import Level forces a retry.
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
- **Kind dropdown is missing options.** It's filtered by the active
  World. Switch worlds, or extend `WORLD_KIND_ALLOWLIST` in the
  addon source.

## Re-seeding from TypeScript

If you ever need to wipe the JSON and rebuild it from the originally
baked TS state (e.g. someone hand-edited `spawns.json` and you want
the baseline layout back), run:

```
node scripts/bake-spawns.mjs
```

That script has the original spawn arrays inlined as plain data —
it's a one-shot baseline, not a round-trip exporter.
