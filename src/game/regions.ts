import * as THREE from 'three';
import type { Stop } from './gradients';

// One mega-map. Each region is a named bubble inside the same world,
// with its own palette stops for ground / plants / halo / relic. The
// shaders pick a per-pixel blend between regions based on the world
// XZ position, so the world tints organically as the player walks
// from one region into another — no hard borders, no scene swaps.
//
// Waypoints (= region centers) double as fast-travel destinations:
// the menu's "Travel" buttons and the in-world portals teleport the
// player directly to waypoint.center.

// Five-world chain: hagen (lysningen) → blodverden (blod) →
// flisverden (geometri) → saltverden (siste) → speilverden (senter).
// `remnants` lingers as a legacy gradient row but no spawns target
// it and the menu hides it from the Travel list. `stjerneengen` was
// removed entirely — its content is gone, the legacy migration
// rewrites old `stjerneengen` keys to `blod`.
export type RegionId =
  | 'lysningen'
  | 'remnants'
  | 'blod'
  | 'geometri'
  | 'siste'
  | 'senter';

export type RegionPalette = {
  ground: Stop[];
  plant: Stop[];
  halo: Stop[];
  relic: Stop[];
};

export type RegionDef = {
  id: RegionId;
  name: string;
  // World-space centre (x, z). The fast-travel waypoint lands the
  // player here; the gradient blend weight peaks here.
  center: [number, number];
  // Sigma (in metres) of the Gaussian falloff used when computing
  // per-pixel blend weights. Larger → softer / wider transition into
  // this region.
  sigma: number;
  palette: RegionPalette;
};

// --- Palette stops -------------------------------------------------------
// Ported from the old per-level definitions, untouched.

// --- Lysningen — vibrant azure / sky-blue, brightest --------------------
// The "alive" zone — re-painted from forest green to a saturated
// azure so the spawn area reads like a luminous blue clearing.
// Lightness floor lifted (0.0 stop is a deep navy rather than near-
// black) so the spawn is brighter than the other zones, not deeper.
// Per user brief: ground must never read as black at the low end —
// even at the bottom of the day/night cycle we want a clear violet/
// navy, not a void. Floor stops lifted accordingly.
const LYSNINGEN_GROUND: Stop[] = [
  [0.0, '#3a2c70'],
  [0.35, '#5560c0'],
  [0.7, '#7cc4ff'],
  [1.0, '#e8f4ff'],
];
// Per user brief: Hagen plants are ALWAYS purple + blue, no pink.
// Previous palette injected hot magenta at the mid-low band; replaced
// with deeper purple so the ramp stays inside the purple→blue→white
// family at every luminance.
const LYSNINGEN_PLANT: Stop[] = [
  [0.0, '#2a1a6a'],
  [0.3, '#6a4ad8'],
  [0.55, '#62b8ff'],
  [0.8, '#bce0ff'],
  [1.0, '#f0f8ff'],
];
// Halo floor lifted off pure black so distant horizon retains a faint
// violet glow at midnight, not a black band.
const LYSNINGEN_HALO: Stop[] = [
  [0.0, '#1a0e3a'],
  [0.4, '#2c1d68'],
  [0.55, '#3e4ea8'],
  [0.75, '#62a8ff'],
  [0.9, '#bcdcff'],
  [1.0, '#f8fcff'],
];
const LYSNINGEN_RELIC: Stop[] = [
  [0.0, '#0a1430'],
  [0.25, '#1e3e80'],
  [0.5, '#4a8edc'],
  [0.75, '#a8d2ff'],
  [1.0, '#f0f6ff'],
];

// --- Remnants — black & white, near-monochrome -------------------------
// The "dead" zone. Pure achromatic ramp from solid black to clean
// white — no hue at all, so the remnant silhouettes read as bone
// against ash. Reads as drained / colour-killed next to the green
// and blue zones. Halo stays mostly black so the zone feels lit
// from above by something distant rather than glowing from within.
const REMNANT_GROUND: Stop[] = [
  [0.0, '#000000'],
  [0.4, '#1a1a1a'],
  [0.7, '#7c7c7c'],
  [1.0, '#f0f0f0'],
];
const REMNANT_PLANT: Stop[] = [
  [0.0, '#000000'],
  [0.35, '#181818'],
  [0.6, '#5e5e5e'],
  [0.85, '#bcbcbc'],
  [1.0, '#ffffff'],
];
const REMNANT_HALO: Stop[] = [
  [0.0, '#000000'],
  [0.65, '#000000'],
  [0.82, '#0a0a0a'],
  [0.94, '#9c9c9c'],
  [1.0, '#ffffff'],
];
const REMNANT_RELIC: Stop[] = [
  [0.0, '#000000'],
  [0.25, '#1a1a1a'],
  [0.5, '#585858'],
  [0.75, '#a4a4a4'],
  [1.0, '#f4f4f4'],
];

// --- Blodverden — tuned via dev panel ---------------------------------
// Ground floor lifted off pure black to a warm dusty rose (#7b4c4c),
// dipping to deep red mid-low and exploding into pink-cream at the
// top. Plants intentionally break the monochrome with sour green +
// gold at mid-band and a cool blue-violet at the brightest stop —
// reads as flora that aren't FROM this red world. Halo is mostly
// black-red with one near-white blue tip for cold star-light. Relic
// silhouettes are bone / pale rose so figures stand out as lit
// from within against the bloody air.
const BLOD_GROUND: Stop[] = [
  [0.0, '#7b4c4c'],
  [0.18, '#3a0408'],
  [0.38, '#d7333b'],
  [0.58, '#dc1c2c'],
  [0.78, '#ff4858'],
  [0.92, '#ffa0ac'],
  [1.0, '#ffe0e4'],
];
const BLOD_PLANT: Stop[] = [
  [0.0, '#a63030'],
  [0.2, '#1a7429'],
  [0.4, '#987b10'],
  [0.6, '#d4202c'],
  [0.8, '#ff5060'],
  [1.0, '#6166ff'],
];
const BLOD_HALO: Stop[] = [
  [0.0, '#8e5252'],
  [0.4, '#a3000e'],
  [0.6, '#6a0814'],
  [0.78, '#c8202c'],
  [0.92, '#ff6878'],
  [1.0, '#d1e7ff'],
];
const BLOD_RELIC: Stop[] = [
  [0.0, '#ac8b8b'],
  [0.2, '#c6b3b3'],
  [0.4, '#ffe1db'],
  [0.6, '#ffffff'],
  [0.78, '#ffffff'],
  [1.0, '#ffffff'],
];

// --- Flisverden — tuned via dev panel --------------------------------
// Same pink/baby-cyan family as before, but the dark stops are now
// LIFTED off near-black to bright/pale colours: ground 0.0 starts
// at near-cream pink, halo 0.0 starts at baby-cyan, relic 0.0 sits
// at pale lavender-pink. The whole region reads as luminous and
// airy — no shadow corners, just shifting pastels.
const GEOMETRI_GROUND: Stop[] = [
  [0.0, '#fff0f0'],
  [0.25, '#65aeb3'],
  [0.55, '#7ed4d0'],
  [0.78, '#c8f0e8'],
  [0.92, '#f4c8e0'],
  [1.0, '#fff0f4'],
];
const GEOMETRI_PLANT: Stop[] = [
  [0.0, '#ffffff'],
  [0.25, '#a8408c'],
  [0.5, '#e670b0'],
  [0.75, '#fab8d4'],
  [1.0, '#fff0f4'],
];
const GEOMETRI_HALO: Stop[] = [
  [0.0, '#7ed6d7'],
  [0.4, '#94bdff'],
  [0.6, '#84c8d8'],
  [0.78, '#d8a8d4'],
  [0.92, '#f4d4e8'],
  [1.0, '#fff4fa'],
];
const GEOMETRI_RELIC: Stop[] = [
  [0.0, '#ffd6fc'],
  [0.25, '#a04088'],
  [0.5, '#e670b0'],
  [0.75, '#fab8d4'],
  [0.92, '#ffe4f0'],
  [1.0, '#fffafc'],
];

// --- Saltverden — bright snow-white / cool silver --------------------
// Pure white-blue salt-flat ramp: dark icy blue at the bottom,
// brightening through silver to pure white. The lightest of all
// worlds; reads as a luminous bleached-out place.
const SISTE_GROUND: Stop[] = [
  [0.0, '#10202c'],
  [0.3, '#506478'],
  [0.6, '#b4c4d0'],
  [0.85, '#e8eef4'],
  [1.0, '#ffffff'],
];
const SISTE_PLANT: Stop[] = [
  [0.0, '#0a1620'],
  [0.3, '#48586c'],
  [0.6, '#aab8c4'],
  [0.85, '#e0e8ee'],
  [1.0, '#ffffff'],
];
const SISTE_HALO: Stop[] = [
  [0.0, '#000000'],
  [0.4, '#0a1620'],
  [0.6, '#3a5068'],
  [0.78, '#a4b8cc'],
  [0.92, '#e8eef4'],
  [1.0, '#ffffff'],
];
const SISTE_RELIC: Stop[] = [
  [0.0, '#0a1620'],
  [0.25, '#3e5066'],
  [0.5, '#9aacc0'],
  [0.75, '#dce4ec'],
  [1.0, '#ffffff'],
];

// --- Speilverden — iridescent violet / mirror-purple -----------------
// Bright fuchsia-violet end of the spectrum so the destination world
// reads as something otherworldly. Distinct from Hagen blue and the
// other chain hues. Brightens to a pearly white-violet at the top.
const SENTER_GROUND: Stop[] = [
  [0.0, '#1a0828'],
  [0.3, '#5a1c8a'],
  [0.6, '#b04ce4'],
  [0.85, '#e8b4f8'],
  [1.0, '#fbeefd'],
];
const SENTER_PLANT: Stop[] = [
  [0.0, '#140622'],
  [0.3, '#4e1880'],
  [0.6, '#a448dc'],
  [0.85, '#e0acf2'],
  [1.0, '#faecfd'],
];
const SENTER_HALO: Stop[] = [
  [0.0, '#000000'],
  [0.4, '#180826'],
  [0.6, '#5a1c8a'],
  [0.78, '#c46cee'],
  [0.92, '#f0d0f8'],
  [1.0, '#fbf4fe'],
];
const SENTER_RELIC: Stop[] = [
  [0.0, '#100620'],
  [0.25, '#4a1878'],
  [0.5, '#a448dc'],
  [0.75, '#e0acf2'],
  [1.0, '#fbf4fe'],
];

// Region centres. Three legacy zones (lysningen / stjerneengen /
// remnants) keep their existing positions so authored content stays
// where it was. The four new regions occupy the previously-empty
// quadrants of the WORLD_RADIUS=120 disc:
//
//   blod      (-90, -50)  — far west, behind/beside the spawn
//   geometri  (-90,  60)  — south-west, opposite stjerneengen
//   siste     ( 90, -50)  — north-east, deep north corner
//   senter    ( 90,  70)  — south-east, the mandala destination
//
// Sigmas stay tight (~24 m) so each palette dominates within ~20 m of
// its centre and blends smoothly into the neighbour at the boundary.
export const REGIONS: RegionDef[] = [
  {
    id: 'lysningen',
    name: 'Hagen',
    center: [0, -30],
    // Tighter sigma than the Gaussian softmax used to default to —
    // each zone's palette now dominates ~95%+ within ~20 m of its
    // centre, so walking between zones reads as a clear colour
    // shift instead of a slow drift across the map.
    sigma: 26,
    palette: {
      ground: LYSNINGEN_GROUND,
      plant: LYSNINGEN_PLANT,
      halo: LYSNINGEN_HALO,
      relic: LYSNINGEN_RELIC,
    },
  },
  {
    id: 'remnants',
    name: 'The Remnants',
    center: [0, 90],
    sigma: 26,
    palette: {
      ground: REMNANT_GROUND,
      plant: REMNANT_PLANT,
      halo: REMNANT_HALO,
      relic: REMNANT_RELIC,
    },
  },
  {
    id: 'blod',
    name: 'Blodverden',
    center: [-90, -50],
    sigma: 24,
    palette: {
      ground: BLOD_GROUND,
      plant: BLOD_PLANT,
      halo: BLOD_HALO,
      relic: BLOD_RELIC,
    },
  },
  {
    id: 'geometri',
    name: 'Flisverden',
    center: [-90, 60],
    sigma: 24,
    palette: {
      ground: GEOMETRI_GROUND,
      plant: GEOMETRI_PLANT,
      halo: GEOMETRI_HALO,
      relic: GEOMETRI_RELIC,
    },
  },
  {
    id: 'siste',
    name: 'Saltverden',
    center: [90, -50],
    sigma: 24,
    palette: {
      ground: SISTE_GROUND,
      plant: SISTE_PLANT,
      halo: SISTE_HALO,
      relic: SISTE_RELIC,
    },
  },
  {
    id: 'senter',
    name: 'Fragleverden',
    center: [90, 70],
    sigma: 22,
    palette: {
      ground: SENTER_GROUND,
      plant: SENTER_PLANT,
      halo: SENTER_HALO,
      relic: SENTER_RELIC,
    },
  },
];

export function getRegion(id: RegionId): RegionDef {
  const r = REGIONS.find((r) => r.id === id);
  if (!r) throw new Error(`Unknown region: ${id}`);
  return r;
}

// Roughly-circular playable world. The player can never walk further
// than WORLD_RADIUS from the origin — Character.tsx clamps their
// position back to the boundary each frame, so the irregular blob
// shape on the map.png reads as solid even though we're enforcing a
// simple circle. A perimeter ring of cairns (placed in levels.ts at
// ~R-3) makes the wall visible without being a literal fence.
export const WORLD_RADIUS = 120;

// World-space rectangle the printed reference map (map.png) covers.
// Symmetric around origin so map UV (0.5, 0.5) = world (0, 0): the
// player spawns at the centre of the map, content radiates out around
// them, and the south edge is the "end" of the world.
//
// Layout (X = east, Z = south):
//   worldMin = top-left of the map image
//   worldMax = bottom-right of the map image
export const MAP_BOUNDS = {
  worldMin: [-130, -130] as [number, number],
  worldMax: [130, 130] as [number, number],
};

// Convenience: convert a world XZ to a 0..1 UV inside the map. Clamped
// at the edges so a player who's wandered outside the bounds gets
// pinned against the nearest border rather than flying off-map.
export function worldToMapUV(x: number, z: number): { u: number; v: number } {
  const [minX, minZ] = MAP_BOUNDS.worldMin;
  const [maxX, maxZ] = MAP_BOUNDS.worldMax;
  const u = (x - minX) / Math.max(1e-3, maxX - minX);
  const v = (z - minZ) / Math.max(1e-3, maxZ - minZ);
  return {
    u: Math.max(0, Math.min(1, u)),
    v: Math.max(0, Math.min(1, v)),
  };
}

// Returns the region the world XZ position is "inside" (highest
// Gaussian weight). Used for region-discovery on proximity and to
// label "now entering" toasts.
export function regionAt(x: number, z: number): RegionDef {
  let best = REGIONS[0];
  let bestW = -Infinity;
  for (const r of REGIONS) {
    const dx = x - r.center[0];
    const dz = z - r.center[1];
    const w = -((dx * dx + dz * dz) / (r.sigma * r.sigma));
    if (w > bestW) {
      bestW = w;
      best = r;
    }
  }
  return best;
}

// --- 2D gradient texture builder ----------------------------------------
// Packs each region's palette as one row of a 2D RGBA texture. The
// shader samples this with vec2(luminance, regionV) — `regionV` comes
// from a per-pixel softmax-Gaussian blend over region centres, so the
// returned colour is a smooth weighted average of the region palettes
// at that world position.
//
// `role` selects which palette per region (ground / plant / halo /
// relic) gets baked in.

export type PaletteRole = 'ground' | 'plant' | 'halo' | 'relic';

const tmpA = new THREE.Color();
const tmpB = new THREE.Color();

function sampleStops(stops: Stop[], t: number, out: THREE.Color) {
  const sorted = [...stops].sort((a, b) => a[0] - b[0]);
  if (t <= sorted[0][0]) {
    out.set(sorted[0][1]);
    return;
  }
  if (t >= sorted[sorted.length - 1][0]) {
    out.set(sorted[sorted.length - 1][1]);
    return;
  }
  for (let s = 0; s < sorted.length - 1; s++) {
    const [t0, c0] = sorted[s];
    const [t1, c1] = sorted[s + 1];
    if (t >= t0 && t <= t1) {
      const u = (t - t0) / (t1 - t0);
      tmpA.set(c0);
      tmpB.set(c1);
      out.r = tmpA.r + (tmpB.r - tmpA.r) * u;
      out.g = tmpA.g + (tmpB.g - tmpA.g) * u;
      out.b = tmpA.b + (tmpB.b - tmpA.b) * u;
      return;
    }
  }
  out.set(sorted[0][1]);
}

export function makeRegionGradientTexture(role: PaletteRole, width = 256): THREE.DataTexture {
  const rows = REGIONS.length;
  const data = new Uint8Array(width * rows * 4);
  const tmp = new THREE.Color();
  for (let row = 0; row < rows; row++) {
    const stops = REGIONS[row].palette[role];
    for (let i = 0; i < width; i++) {
      const t = i / (width - 1);
      sampleStops(stops, t, tmp);
      const idx = (row * width + i) * 4;
      data[idx + 0] = Math.round(tmp.r * 255);
      data[idx + 1] = Math.round(tmp.g * 255);
      data[idx + 2] = Math.round(tmp.b * 255);
      data[idx + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, width, rows, THREE.RGBAFormat);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  // Linear filtering on Y blends between region rows — so a pixel
  // whose `regionV` lands halfway between two rows reads as the avg
  // of those two palettes for free.
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

// Region centres + sigmas as flat float arrays the shader can ingest.
// Length = REGIONS.length × 2 / × 1 respectively.
export function regionCenters(): Float32Array {
  const f = new Float32Array(REGIONS.length * 2);
  for (let i = 0; i < REGIONS.length; i++) {
    f[i * 2 + 0] = REGIONS[i].center[0];
    f[i * 2 + 1] = REGIONS[i].center[1];
  }
  return f;
}

export function regionSigmas(): Float32Array {
  const f = new Float32Array(REGIONS.length);
  for (let i = 0; i < REGIONS.length; i++) f[i] = REGIONS[i].sigma;
  return f;
}

export const REGION_COUNT = REGIONS.length;
