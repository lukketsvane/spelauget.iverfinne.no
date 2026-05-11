import { create } from 'zustand';
import type { RegionId } from '@/game/regions';

// Dev-tuner store. Holds per-region fog overrides + a "palette
// revision" counter the tuner UI bumps after every stop edit so the
// HUD knows to re-read REGIONS-derived state. Pure local state — not
// persisted, not surfaced in production builds.

export type FogConfig = { color: string; near: number; far: number };

type TunerState = {
  fogByRegion: Record<RegionId, FogConfig>;
  setFog: (region: RegionId, fog: Partial<FogConfig>) => void;
  // Bumps after every gradient stop mutation so observers can refresh
  // their derived values (the tuner UI uses this to redraw its
  // palette swatches).
  paletteRevision: number;
  bumpPalette: () => void;
};

// Defaults mirror the values that used to live in Scene.tsx's
// REGION_ATMOS map. Scene.tsx now reads from useTuner.fogByRegion
// instead so the tuner panel can drive fog live without a code edit.
const DEFAULT_FOG: Record<RegionId, FogConfig> = {
  // Hageverden: tighter near plane (15) so the spawn area immediately
  // reads with atmosphere; long far (200) keeps distant trail
  // markers readable instead of vanishing into a wall of fog.
  lysningen: { color: '#1a1230', near: 15, far: 200 },
  blod: { color: '#a01828', near: 14, far: 48 },
  // Flisverden: rosé-cyan haze. Far 200 + near 120 means fog
  // doesn't kick in until the player is far from props, so the
  // immediate scene reads as a clean luminous corridor. Distant
  // edges still soften into the pink wash.
  geometri: { color: '#d8a8d4', near: 120, far: 200 },
  siste: { color: '#1a2c3c', near: 38, far: 100 },
  senter: { color: '#241040', near: 30, far: 88 },
  remnants: { color: '#1a1230', near: 40, far: 95 },
};

export const useTuner = create<TunerState>((set) => ({
  fogByRegion: DEFAULT_FOG,
  setFog: (region, fog) =>
    set((s) => ({
      fogByRegion: {
        ...s.fogByRegion,
        [region]: { ...s.fogByRegion[region], ...fog },
      },
    })),
  paletteRevision: 0,
  bumpPalette: () => set((s) => ({ paletteRevision: s.paletteRevision + 1 })),
}));
