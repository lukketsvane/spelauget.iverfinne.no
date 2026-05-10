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

// --- Lysningen — warm magenta / pink, brightest of the three -----------
// Pushed warmer than before (more red, less blue) so it reads
// distinctly hotter than the cool teal of Stjerneengen and the cold
// gray of the Remnants. Lightness range stays high — this is the
// "alive" zone.
const LYSNINGEN_GROUND: Stop[] = [
  [0.0, '#7a3aa8'],
  [0.35, '#b063d0'],
  [0.7, '#e3a4dc'],
  [1.0, '#fff0fa'],
];
const LYSNINGEN_PLANT: Stop[] = [
  [0.0, '#3b0a78'],
  [0.3, '#c0309c'],
  [0.55, '#ff5cc0'],
  [0.8, '#ffaad8'],
  [1.0, '#fff5fa'],
];
const LYSNINGEN_HALO: Stop[] = [
  [0.0, '#000000'],
  [0.4, '#000000'],
  [0.55, '#931ea0'],
  [0.75, '#ff4cc0'],
  [0.9, '#ffa8e0'],
  [1.0, '#fff8fc'],
];
const LYSNINGEN_RELIC: Stop[] = [
  [0.0, '#1c0533'],
  [0.25, '#5a1a87'],
  [0.5, '#bd47c8'],
  [0.75, '#ff8ed0'],
  [1.0, '#fff0f8'],
];

// --- Stjerneengen — saturated teal / cyan, mid-lightness ---------------
// Deepened toward pure cyan so it reads as clearly different from
// the magenta of Lysningen even when the gradient blends them at the
// border. Plant + halo lifted toward bright aqua so the relic cards
// (which dominate this zone) glow cool against the ground.
const STJERNE_GROUND: Stop[] = [
  [0.0, '#0a3a52'],
  [0.35, '#1f7090'],
  [0.7, '#56b8ce'],
  [1.0, '#bef0f4'],
];
const STJERNE_PLANT: Stop[] = [
  [0.0, '#021c3a'],
  [0.35, '#0e6aa0'],
  [0.6, '#18c4c8'],
  [0.85, '#6cf4dc'],
  [1.0, '#dafff4'],
];
const STJERNE_HALO: Stop[] = [
  [0.0, '#000000'],
  [0.55, '#000000'],
  [0.7, '#0a4878'],
  [0.85, '#1fffdc'],
  [1.0, '#d8fff8'],
];
const STJERNE_RELIC: Stop[] = [
  [0.0, '#031826'],
  [0.25, '#0e4868'],
  [0.5, '#2d9fb4'],
  [0.75, '#86eedc'],
  [1.0, '#eafff4'],
];

// --- Remnants — cold ash gray, darkest of the three --------------------
// Pulled the whole curve down so this zone reads as visibly DEAD —
// the remnant silhouettes need a backdrop that doesn't compete. Top
// stop only ~70% lightness; bottom near-black. Hue cools toward
// pure neutral so the sculpted-stone PNGs read as bone rather than
// purple ruins.
const REMNANT_GROUND: Stop[] = [
  [0.0, '#08090c'],
  [0.4, '#262936'],
  [0.7, '#5a6070'],
  [1.0, '#a8acb6'],
];
const REMNANT_PLANT: Stop[] = [
  [0.0, '#0a0d14'],
  [0.35, '#262d3e'],
  [0.6, '#525a6c'],
  [0.85, '#8c95a4'],
  [1.0, '#cfd2da'],
];
const REMNANT_HALO: Stop[] = [
  [0.0, '#000000'],
  [0.6, '#000000'],
  [0.78, '#0c1018'],
  [0.92, '#586073'],
  [1.0, '#b8bdc7'],
];
const REMNANT_RELIC: Stop[] = [
  [0.0, '#04050a'],
  [0.25, '#1a1d26'],
  [0.5, '#42485a'],
  [0.75, '#8a909e'],
  [1.0, '#d4d8df'],
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
    center: [0, -15],
    sigma: 22,
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
    center: [25, 15],
    sigma: 20,
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
    center: [0, 45],
    sigma: 22,
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
// ~R-2) makes the wall visible without being a literal fence.
export const WORLD_RADIUS = 60;

// World-space rectangle the printed reference map (map.png) covers.
// Symmetric around origin so map UV (0.5, 0.5) = world (0, 0): the
// player spawns at the centre of the map, content radiates out around
// them, and the south edge is the "end" of the world.
//
// Layout (X = east, Z = south):
//   worldMin = top-left of the map image
//   worldMax = bottom-right of the map image
export const MAP_BOUNDS = {
  worldMin: [-65, -65] as [number, number],
  worldMax: [65, 65] as [number, number],
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
