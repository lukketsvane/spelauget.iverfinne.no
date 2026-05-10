# Improvements backlog

Stuff to ship later — captured during playtest passes. Roughly ordered
by impact / effort. Strike out as we land them.

## Easy wins (probably an hour each)

- [ ] **"Now entering: <region>" toast on walking across a region
      boundary.** `useLevel.savePosition` already detects the region
      change and sets `currentRegionId`; just push a toast at the same
      time, gated to fire only when the player walks across (not when
      `travel()` jumps them — that toast already fires). Nice-to-have:
      cooldown so toggling the boundary doesn't spam.

- [ ] **Skip-line affordance after the typewriter completes.** The
      dialogue UI shows a `▾` cursor when the line is fully revealed,
      but the player is also intentionally blocked from advancing
      until then. Make `Space` / `E` advance once `isComplete`, in
      addition to tap. Currently those keys re-fire the emote, which
      is now a no-op mid-dialogue (good fix from the last pass) — so
      mapping them to "advance line when typewriter done" is free.

- [ ] **Visual hint that the parked car is now interactive.** Right
      now the only signal is the spiral button popping in the corner.
      Add a subtle glow / outline / drifting particle on the car once
      `bobbleVanished` flips. Same for portals once `hasKey`. Could
      reuse the existing portal shader's swirl effect.

- [ ] **Mute button.** Volume slider can go to 0 but a one-tap mute
      next to the slider would be nicer. Same for SFX (footsteps,
      dialogue grunts) — currently both ride `musicVolume`, split
      them into music vs sfx volumes if the time comes.

- [ ] **Map: draw region waypoint pins.** With `MAP_BOUNDS` already
      defined, plotting a small icon at each `regionAt(center)` is one
      `<div>` per region inside `MapOverlay`. Discovered ones fully
      drawn, undiscovered ones a `?` placeholder. Tap to fast-travel
      from the map.

- [ ] **Show region name on first entry, not on every save tick.**
      The "Discovered: <name>" toast is good. The implicit re-entry
      is currently silent. A small fade-in label at top-centre on
      every region change ("STJERNEENGEN") would feel more like
      Hollow Knight's area cards.

## Medium (half a day each)

- [ ] **Music cross-fade between regions.** Today the queue waits for
      track end to refill from the new region. That can be 60-120 s
      of "wrong" mood after a fast-travel. Cross-fade between two
      Audio elements over ~3 s on `currentRegionId` change for a
      smoother shift. Watch out for autoplay-block edge cases.

- [ ] **MAP_BOUNDS calibration UI.** The marker drift comes from the
      printed map.png not exactly matching the world layout. A
      dev-only overlay (gated behind a key combo) that lets you click
      a spot on the map and have it record `worldX, worldZ` →
      `mapU, mapV` would let you re-fit `MAP_BOUNDS` (or upgrade to
      a 4-corner affine matrix) in 30 s. Check this in once the file
      ships.

- [ ] **Pet-rabbit-dot on the map for discovered NPCs / portals.**
      Same machinery as the player marker, fed from
      `LEVELS.world.spawns` filtered to interactable kinds. A
      thumbtack icon per item + tooltip. Possibly sticky scroll if
      the world ever grows beyond what fits at full-screen.

- [ ] **Per-NPC voice profile pitch follow.** Each pixel pool blends
      smoothly already, but a digger that's half-buried in dirt
      should muffle further on each line. Apply a low-pass filter on
      the voice's `gain` node — simple Web Audio biquad.

- [ ] **Scrollable settings panel.** On a tiny phone in landscape,
      Music / Brightness / Controls / Erase / Back almost overflow.
      Wrap the panel in `overflow-y-auto` + a max-height tied to
      `100dvh` so the viewport keyboard doesn't push buttons off-
      screen.

- [ ] **Replant on Bobble vanish.** The plant exclusion bubble
      around Bobble's spawn position persists after she vanishes.
      Plants never grow into that gap. Refresh `plantExclusions`
      after `bobbleVanished` flips to drop her bubble.

- [ ] **Underbrush tint follows the region gradient.** Today
      underbrush is a flat `#3a2a55` colour everywhere — when the
      ground around it tints from magenta → teal across regions, the
      brush stays purple. Pipe `applyGradientMap` into the
      underbrush material like every other ground-cover surface.

## Larger (a day-plus each)

- [ ] **Portal warm-up animation.** Today the bow → fade-to-black is
      instant. A 0.5 s "the portal pulses brighter, then we fade"
      would sell the moment. Probably a uniform on the portal shader
      that ramps from 0 → 1 over the warm-up, plus the existing fade
      starting at 1.

- [ ] **Keyboard-navigable menus.** Tab + arrow keys + Enter on every
      menu / settings panel. Currently tab order is implicit, focus
      ring hidden (we removed colored shadows), and Enter doesn't
      fire button onClick. Makes the game playable without a mouse.

- [ ] **GLB compression pipeline.** `gltf-transform optimize` on the
      pile of `/public/models/*.glb` we ship — Draco / Meshopt would
      cut the cold-start payload meaningfully. Stale TODO from
      months ago, still stale.

- [ ] **Texture compression (KTX2 / Basis).** All the gradient PNGs
      and remnant silhouettes ship as raw PNGs today. Bumping to
      KTX2 with a build-time encode would shrink things significantly
      without losing the pixel-art look.

- [ ] **Per-NPC quest state, not flat flags.** `bobbleVanished` /
      `hasKey` are individual booleans on `useGame`. As more NPCs
      land, generalise to a `quests: { [id]: 'idle' | 'active' |
      'done' }` map with first-class subscribe.

- [ ] **InstancedMesh for plants.** ~Hundreds of draw calls per
      frame today, one per visible plant chunk × per material.
      Switch to one `InstancedMesh` per texture; per-instance UV
      offsets / scales drive variation. Big perf win on phones.

- [ ] **GPU-driven particles.** `Particles.tsx` ticks every position
      on the CPU. A shader with `uTime` + a per-particle seed buffer
      computes positions in the vertex stage; CPU only writes
      `uTime` once per frame. Frees a measurable chunk of frame time.

- [ ] **Pre-warm shaders.** First time a new material hits the
      camera, three.js compiles its shader on the main thread → a
      visible hitch. `gl.compile(scene, camera)` after assets load
      walks every material once, paying the cost up front.

## Polish / chrome

- [ ] **Achievements / lore log.** The relic cards and remnant
      silhouettes are already in-world; let the player tap them for
      a one-line lore card that gets logged in a journal accessible
      from the menu.

- [ ] **Tutorial-free onboarding.** A single "Hold mouse to walk"
      hint that auto-fades on first successful movement input.
      Right now a desktop player who's never seen the controls list
      has nothing on screen telling them what to do.

- [ ] **Splash → first frame transition.** The splash fades to
      black, then the world fades from black. Tightening the
      handover so the first action feels seamless — maybe the
      pixel-art splash slides up out of the way rather than fading.

## Investigated and skipped

- ~~Move BackgroundMusic outside `<Game>` so it persists across the
  splash → game boundary~~ — already does, mounted at top level.
- ~~Key-pickup pip flashes "Saved" too — annoying~~ — that
  `<SaveIndicator>` was removed in an earlier pass.
- ~~Plant wind seems to freeze at certain camera angles~~ — that
  was the reduce-motion query firing; works as intended.
