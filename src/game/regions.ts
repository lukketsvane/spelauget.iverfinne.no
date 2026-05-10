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

export type RegionId = 'lysningen' | 'stjerneengen' | 'remnants';

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

// --- Lysningen — vibrant emerald / grass-green, brightest --------------
// The "alive" zone. Saturated leafy green with a pale-lime ceiling
// so the digger's clearing reads like a forest interior at noon.
// High lightness range (0.10 → 1.0) keeps the zone luminous against
// the dark fog.
const LYSNINGEN_GROUND: Stop[] = [
  [0.0, '#0a2810'],
  [0.4, '#1c5e2a'],
  [0.7, '#52c84a'],
  [1.0, '#dcfac0'],
];
const LYSNINGEN_PLANT: Stop[] = [
  [0.0, '#04200c'],
  [0.3, '#1c6c2c'],
  [0.55, '#3cd84a'],
  [0.8, '#a8f898'],
  [1.0, '#eaffd6'],
];
const LYSNINGEN_HALO: Stop[] = [
  [0.0, '#000000'],
  [0.4, '#000000'],
  [0.55, '#0e4a1a'],
  [0.75, '#3edc44'],
  [0.9, '#a8f898'],
  [1.0, '#f0fff0'],
];
const LYSNINGEN_RELIC: Stop[] = [
  [0.0, '#04140a'],
  [0.25, '#1c3e1e'],
  [0.5, '#3a8c3c'],
  [0.75, '#a4dca0'],
  [1.0, '#eaffe8'],
];

// --- Stjerneengen — light sky blue / ice, mid-bright -------------------
// Pure cool sky blue so the relic-dominated zone feels ethereal,
// like standing under a clear winter sky. Plant + halo gradients
// peak at near-white sky tones; ground stays a deeper navy at the
// bottom for contrast.
const STJERNE_GROUND: Stop[] = [
  [0.0, '#082240'],
  [0.35, '#1c5e9a'],
  [0.7, '#76b8ec'],
  [1.0, '#dceefa'],
];
const STJERNE_PLANT: Stop[] = [
  [0.0, '#021430'],
  [0.35, '#0e5aa4'],
  [0.6, '#3aa8e8'],
  [0.85, '#a8dcf8'],
  [1.0, '#f0f8fc'],
];
const STJERNE_HALO: Stop[] = [
  [0.0, '#000000'],
  [0.55, '#000000'],
  [0.7, '#0c4078'],
  [0.85, '#62cdff'],
  [1.0, '#dcf2ff'],
];
const STJERNE_RELIC: Stop[] = [
  [0.0, '#020c1a'],
  [0.25, '#10385a'],
  [0.5, '#3a8ec4'],
  [0.75, '#9ed4ec'],
  [1.0, '#f0f8fc'],
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

// Region centres compressed into the WORLD_RADIUS=60 disc. Lysningen
// surrounds the player spawn (north-of-centre), Stjerneengen owns the
// east-middle band (locked gate + parked car), Remnants is the
// south-third where the exit gate sits. Sigmas tightened so each
// region's palette dominates clearly within the smaller world while
// still blending smoothly between neighbours.
export const REGIONS: RegionDef[] = [
  {
    id: 'lysningen',
    name: 'The Clearing',
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
    id: 'stjerneengen',
    name: 'The Star Meadow',
    center: [50, 30],
    sigma: 22,
    palette: {
      ground: STJERNE_GROUND,
      plant: STJERNE_PLANT,
      halo: STJERNE_HALO,
      relic: STJERNE_RELIC,
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
