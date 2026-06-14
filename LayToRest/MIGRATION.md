# Lay to Rest — web → Unity migration

Migration of the game-jam web build (Next.js + react-three-fiber, `spelauget.vercel.app`) into this Unity 6 URP project. Assets were batch-exported live from `lay_to_rest_blockout.blend`; the core gameplay systems were ported to C# preserving the web tunings.

## What was migrated

### Assets (from the .blend, via FBX)

- `Assets/Art/Models/` — 57 static assets, one FBX per `AS_*` collection (halos exported as parented child meshes). Textures are embedded; in Unity select an FBX → Materials tab → **Extract Textures…** / **Extract Materials…**, then convert materials to URP (Window ▸ Rendering ▸ Render Pipeline Converter) if they import pink.
- `Assets/Art/Characters/` — 5 rigged FBX with NLA animations baked as takes: `sligo` (player), `sligo_01` (unused variant), `boblehovud` (Bobble NPC), `starfish`, `stjernekarakter` (star NPC).
- Export settings: metric scale 1 (`FBX_SCALE_ALL`, so no ×100 scale factor in Unity), `-Z` forward / `Y` up, modifiers applied, no leaf bones, deform bones only.

Skipped (empty collections in the .blend — content lives in the web `public/` GLBs only): `flis_figure_seated`, `flis_vesica`, `glowing_purple_coral`, `mythical_horse`, `neon_vascular_tree`, `purple_coral`, `purple_coral_alt`, and `jetty_system` (geometry-nodes curve; convert to mesh in Blender before exporting).

### Animation clips

The Blender NLA tracks export as generic `NlaTrack.NNN` take names. The web game resolved roles **by clip duration** (shortest → run, second-shortest → walk, longest → idle, rest → emotes). The same logic is replicated in **Tools ▸ LayToRest ▸ Map Clip Roles (by duration)** — select the character FBX assets and run it once; clips are renamed to `run` / `walk` / `idle` / `extra…` and loop flags set.

### Levels

The web worlds are authored as `spawns.json` — those files were copied **unchanged** to `Assets/StreamingAssets/Levels/`, named by region id:

| File | Web world | Region |
|---|---|---|
| `lysningen.json` | hageverden | Hageverden (start) |
| `blod.json` | blodverden | Blodverden |
| `geometri.json` | flisverden | Flisverden |
| `siste.json` | saltverden | Saltverden |
| `senter.json` | speilverden | Kjellerverden |

Keep authoring in the web repo and re-copy, or edit these directly — same schema.

### Code (`Assets/Scripts/`)

| Script | Ports | Notes |
|---|---|---|
| `Core/GameState.cs` | `store/game.ts` | Hearts/coins/crystals/XP (×1.5 curve), per-portal keys, artifacts, collected/altar ids. JSON in PlayerPrefs under `spelauget.game`. |
| `Core/Region.cs` | `regions.ts` | Region ids, names, centers, sigmas. |
| `Core/DayCycle.cs` | `dayCycle.ts` | UTC-synced 10-min cycle; brightness + hue curves. |
| `Player/PlayerController.cs` | `Character.tsx` + `config.ts` | walk 3.0 / run 5.5 m/s, turn 12 rad/s, camera-relative input (WASD/arrows/gamepad, Shift = run). |
| `Player/IsoCameraFollow.cs` | `Scene.tsx` camera | Ortho, offset (14, 9, 14), viewSize 18 / desktop 14, lerp 0.12 (frame-rate independent). |
| `Player/PlayerAnimation.cs` | `Character.tsx` anim | Crossfade 0.18 s; idle emote after 5–9 s. |
| `World/WorldLoader.cs` | `Spawns.tsx` + level store | Loads region JSON, instantiates prefabs, teleports player to spawn point. Unknown kinds → placeholder cubes (logged). |
| `World/SpawnPrefabLibrary.cs` | — | ScriptableObject mapping spawn `kind` → prefab (`flis_prop:<prop>`, `car:<model>` for variants). |
| `World/Portal.cs` | `Portal.tsx` | Trigger; gated by `requiredKey` (RegionId) or legacy any-key. |
| `World/Pickup.cs` | `Key/Crystal/Artifact.tsx` | One-shot trigger pickups, persisted by spawn id. |
| `Editor/ClipRoleMapper.cs` | `Character.tsx` role mapping | See Animation clips above. |

## Scene setup (first run)

1. Open the default scene. Create an empty **Game** object with `GameState` + `WorldLoader`.
2. Drag the `sligo` FBX into the scene → add `CharacterController`, `PlayerController`, `PlayerAnimation` (needs an Animator with states `run/walk/idle/extra` after running the clip mapper). Tag the root or just assign it to `WorldLoader.player`.
3. Main Camera → add `IsoCameraFollow`, target = player.
4. Create the `SpawnPrefabLibrary` asset (Assets ▸ Create ▸ LayToRest), make prefabs from `Art/Models` FBX and map kinds (`purple_stone_cairn`, `tangled_root_sculpture`, `portal`, `stone_hut`, `trilo`, …). Unmapped kinds show as cubes so the layout is testable immediately.
5. Directional Light → add `DayCycle`, assign the light.
6. Add a big ground plane (the web ground is a flat shader plane; URP shader port is still TODO).

## Not migrated yet

- **Gradient region-blend shaders** (`gradients.ts`, ground/plant/halo palettes) — needs a URP Shader Graph with per-pixel Gaussian region weights; palette data is in `src/game/regions.ts`.
- **Sprite-card props** (`blod_sprite`, `remnant`, `relic` — black-background PNGs → additive cards) and `kjeller_mirror` (use a URP planar reflection).
- **Dialogue/NPC behaviours** (`BobleNpc`, `StarNpc` lead/talk logic) and voices.

## Title screen / audio / pixelation (ported)

Run **Tools ▸ LayToRest ▸ Build Title Screen (active scene)** to wire these into the open scene (idempotent):

- `UI/MainMenu.cs` — port of `MainMenu.tsx` + `store/menu.ts`. Splash over a paused game on first launch (full `Resources/UI/menu_screen.png`), then an Esc/Q pause overlay. Continue / New Game / Settings (Music + Brightness + Erase). Builds its own canvas at runtime like `GameHud`.
- `Audio/BackgroundMusic.cs` — port of `BackgroundMusic.tsx`. Per-region playlists from `Resources/Audio/ost_NN`, 4 s fade-in, shuffled, advance-on-end, live volume via `GamePrefs`.
- Pixelation — URP `renderScale 0.45` + **Point** upscaling filter (chunky 3D, crisp UI; screen-space input intact). The splash texture is imported at maxsize 1024 + Point so it matches.
- `Rendering/ExposureSync.cs` + a global Volume `ColorAdjustments.postExposure` drive the Brightness slider (`store/settings.ts` parity).
- `Core/GamePrefs.cs` — music volume / exposure persisted in PlayerPrefs (ports `store/audio.ts` + `store/settings.ts`).
- **Collision blockers** from `store/collision.ts` (Unity colliders on prefabs largely replace this).
