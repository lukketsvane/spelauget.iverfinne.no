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

// --- Stjerneengen — electric cyan / aqua, mid-lightness ----------------
// Pushed harder toward pure cyan than before so the hue contrast
// against Lysningen's magenta is unmistakable at the boundary.
// Saturation cranked on the plant + halo gradients to make the
// relic-dominated zone feel like a glowing electric grove.
const STJERNE_GROUND: Stop[] = [
  [0.0, '#001830'],
  [0.35, '#0a5a90'],
  [0.7, '#2cc0d8'],
  [1.0, '#aaf0f8'],
];
const STJERNE_PLANT: Stop[] = [
  [0.0, '#000a20'],
  [0.35, '#0866a8'],
  [0.6, '#0acdcd'],
  [0.85, '#56f0e0'],
  [1.0, '#caffec'],
];
const STJERNE_HALO: Stop[] = [
  [0.0, '#000000'],
  [0.55, '#000000'],
  [0.7, '#003c70'],
  [0.85, '#10ffd8'],
  [1.0, '#c8fffa'],
];
const STJERNE_RELIC: Stop[] = [
  [0.0, '#000c18'],
  [0.25, '#08486c'],
  [0.5, '#1c9eba'],
  [0.75, '#7cead0'],
  [1.0, '#dafff4'],
];

// --- Remnants — warm sepia / bronze / dust, darkest of the three -------
// Was gray-on-gray; now pushed to warm amber tones so the three
// regions form a proper triad (magenta / cyan / amber) on the colour
// wheel instead of two saturated corners + a neutral. Reads as
// "ancient dust" rather than "monochrome dead pixels". Lightness
// stays low — the remnant silhouettes need a quiet backdrop.
const REMNANT_GROUND: Stop[] = [
  [0.0, '#0e0805'],
  [0.4, '#2c1a0e'],
  [0.7, '#684226'],
  [1.0, '#bc9874'],
];
const REMNANT_PLANT: Stop[] = [
  [0.0, '#0a0604'],
  [0.35, '#2e1c0e'],
  [0.6, '#5e3e1e'],
  [0.85, '#a47e50'],
  [1.0, '#e2c690'],
];
const REMNANT_HALO: Stop[] = [
  [0.0, '#000000'],
  [0.6, '#000000'],
  [0.78, '#1c1006'],
  [0.92, '#7a5226'],
  [1.0, '#e2c690'],
];
const REMNANT_RELIC: Stop[] = [
  [0.0, '#0c0805'],
  [0.25, '#28190a'],
  [0.5, '#5e421e'],
  [0.75, '#a07a48'],
  [1.0, '#dec488'],
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
    sigma: 44,
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
    sigma: 40,
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
    sigma: 44,
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
