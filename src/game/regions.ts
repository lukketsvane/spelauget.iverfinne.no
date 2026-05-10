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

const LYSNINGEN_GROUND: Stop[] = [
  [0.0, '#8e6dc0'],
  [0.35, '#b497d6'],
  [0.7, '#d7c2eb'],
  [1.0, '#f6e8fa'],
];
const LYSNINGEN_PLANT: Stop[] = [
  [0.0, '#5a1c95'],
  [0.3, '#b446e0'],
  [0.55, '#ff6fd0'],
  [0.8, '#ffb0e6'],
  [1.0, '#fff5fa'],
];
const LYSNINGEN_HALO: Stop[] = [
  [0.0, '#000000'],
  [0.4, '#000000'],
  [0.55, '#7a2db8'],
  [0.75, '#ff60d0'],
  [0.9, '#ffaee5'],
  [1.0, '#fff5fc'],
];
const LYSNINGEN_RELIC: Stop[] = [
  [0.0, '#2a0d4a'],
  [0.25, '#5a2287'],
  [0.5, '#a956c8'],
  [0.75, '#f0a4dc'],
  [1.0, '#fff0f8'],
];

const STJERNE_GROUND: Stop[] = [
  [0.0, '#1f4658'],
  [0.35, '#3b758a'],
  [0.7, '#7ab2c0'],
  [1.0, '#c7e8ec'],
];
const STJERNE_PLANT: Stop[] = [
  [0.0, '#062840'],
  [0.35, '#1b6e94'],
  [0.6, '#2eb6b8'],
  [0.85, '#7ff0d4'],
  [1.0, '#e8fff5'],
];
const STJERNE_HALO: Stop[] = [
  [0.0, '#000000'],
  [0.55, '#000000'],
  [0.7, '#0f4a6e'],
  [0.85, '#3df0d8'],
  [1.0, '#ddfff8'],
];
const STJERNE_RELIC: Stop[] = [
  [0.0, '#0d2638'],
  [0.25, '#264e6a'],
  [0.5, '#3d96a6'],
  [0.75, '#9be0d4'],
  [1.0, '#f0fff8'],
];

const REMNANT_GROUND: Stop[] = [
  [0.0, '#1a1c22'],
  [0.4, '#3a3d48'],
  [0.7, '#6f7585'],
  [1.0, '#c8cdd6'],
];
const REMNANT_PLANT: Stop[] = [
  [0.0, '#161821'],
  [0.35, '#3b4253'],
  [0.6, '#6e7686'],
  [0.85, '#a8b0bd'],
  [1.0, '#e6e9ef'],
];
const REMNANT_HALO: Stop[] = [
  [0.0, '#000000'],
  [0.6, '#000000'],
  [0.78, '#1a2030'],
  [0.92, '#7a85a0'],
  [1.0, '#dde2ec'],
];
const REMNANT_RELIC: Stop[] = [
  [0.0, '#101218'],
  [0.25, '#2c2f38'],
  [0.5, '#5a606e'],
  [0.75, '#a0a8b6'],
  [1.0, '#eaedf3'],
];

// Region centres are spread out in a triangle so each has air around
// it. Keeping radii smallish so the gradient transitions feel like
// crossing a clear threshold rather than a slow drift.
export const REGIONS: RegionDef[] = [
  {
    id: 'lysningen',
    name: 'The Clearing',
    center: [0, 0],
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
    center: [70, -15],
    sigma: 26,
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
    center: [30, 75],
    sigma: 28,
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

// World-space rectangle that the printed reference map (map.png)
// covers. Used by the in-game map overlay to position the
// "you-are-here" marker. Bounds are loose enough to encompass every
// region's spawn cluster with margin; if the map artwork is later
// re-cropped, bump these to match.
//
// Layout (X = east, Z = south):
//   worldMin = top-left of the map image
//   worldMax = bottom-right of the map image
export const MAP_BOUNDS = {
  worldMin: [-60, -40] as [number, number],
  worldMax: [100, 120] as [number, number],
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
