import * as THREE from 'three';
import {
  REGION_COUNT,
  regionCenters,
  regionSigmas,
  type PaletteRole,
} from './regions';

// Photoshop-style gradient map: each stop is [position 0..1, hex color].
// Kept as a top-level type so spawn definitions and palette tables can
// share it. The actual gradient → colour conversion lives in
// regions.ts now (see makeRegionGradientTexture).
export type Stop = [number, string];

// Mega-map gradient system. Every gradient-mapped surface (ground,
// plants, halo, relic) samples a single 2D RGBA texture indexed by
// (luminance, regionV). `regionV` is computed per-pixel from the
// world XZ position via a softmax over Gaussians at each region
// centre — so the world's tint blends organically as the player walks
// from one region into another, no scene swaps required.
//
// Day/night still drives a separate hue-rotation + brightness uniform
// pair shared across every patched material.

export type GradientRole = PaletteRole;

type SharedUniforms = {
  uHueAngle: { value: number };
  uBrightness: { value: number };
};
const shared: SharedUniforms = {
  uHueAngle: { value: 0 },
  uBrightness: { value: 1 },
};

export function updateGradientUniforms(hueAngle: number, brightness: number) {
  shared.uHueAngle.value = hueAngle;
  shared.uBrightness.value = brightness;
}

// Each per-role gradient texture is built once at app start and
// referenced by every patched material. Live-swap via setGradientTexture
// during the play session lets us hot-replace palettes from the
// console while iterating.
const roleTextures: Partial<Record<GradientRole, THREE.Texture>> = {};
const roleUniforms: Partial<Record<GradientRole, { value: THREE.Texture }>[]> = {};

// Material registries by role so `setGradientTexture(role, tex)` can
// re-point every patched material's `gradientMap` uniform at once.
const materialUniformsByRole: Record<GradientRole, { value: THREE.Texture }[]> = {
  ground: [],
  plant: [],
  halo: [],
  relic: [],
};

export function setGradientTexture(role: GradientRole, texture: THREE.Texture) {
  roleTextures[role] = texture;
  for (const u of materialUniformsByRole[role]) u.value = texture;
}

export function getGradientTexture(role: GradientRole): THREE.Texture | undefined {
  return roleTextures[role];
}

// Patches a material's <map_fragment> shader chunk with:
//   1. Region-blend lookup: per-pixel softmax over Gaussians at each
//      region centre → regionV ∈ [0, 1]. Sampled together with
//      luminance against the 2D gradient texture for that role.
//   2. Day-cycle hue rotation + brightness scale on the resulting
//      colour, driven by the shared uniforms above.
//
// Works on any material that includes the standard `<map_fragment>`
// chunk (Lambert / Basic / Standard / Phong).
export function applyGradientMap(
  material: THREE.Material,
  initialGradient: THREE.Texture,
  role: GradientRole,
) {
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    prev?.call(material, shader, renderer);

    shader.uniforms.gradientMap = { value: initialGradient };
    shader.uniforms.uHueAngle = shared.uHueAngle;
    shader.uniforms.uBrightness = shared.uBrightness;
    shader.uniforms.uRegionCenters = { value: regionCenters() };
    shader.uniforms.uRegionSigmas = { value: regionSigmas() };

    // Track the gradientMap uniform so setGradientTexture can swap it.
    materialUniformsByRole[role].push(shader.uniforms.gradientMap as { value: THREE.Texture });

    // -- Inject world position into the fragment stage. --
    // Three.js doesn't pass world position to fragment by default, so
    // we add a varying in the vertex shader and feed it from the
    // begin_vertex chunk's `transformed` (post-skinning local space)
    // multiplied by modelMatrix.
    shader.vertexShader =
      /* glsl */ `
        varying vec3 vGradientWorldPos;
      ` + shader.vertexShader;

    shader.vertexShader = shader.vertexShader.replace(
      '#include <project_vertex>',
      /* glsl */ `
        vGradientWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
        #include <project_vertex>
      `,
    );

    // -- Fragment patch. --
    shader.fragmentShader =
      /* glsl */ `
      varying vec3 vGradientWorldPos;
      uniform sampler2D gradientMap;
      uniform float uHueAngle;
      uniform float uBrightness;
      uniform vec2 uRegionCenters[${REGION_COUNT}];
      uniform float uRegionSigmas[${REGION_COUNT}];

      // Rodrigues rotation around the (1,1,1)/√3 axis — hue rotation
      // on RGB that preserves luminance.
      vec3 hueShift(vec3 col, float angle) {
        const vec3 k = vec3(0.57735026, 0.57735026, 0.57735026);
        float c = cos(angle);
        return col * c + cross(k, col) * sin(angle) + k * dot(k, col) * (1.0 - c);
      }

      // Per-pixel weighted region row in [0, 1]. Each region gets a
      // Gaussian weight from its centre + sigma; the result is a
      // softmax over those weights mapped to the gradient texture's
      // V axis. With ${REGION_COUNT} rows and linear filtering, the
      // returned colour is the smooth weighted average of region
      // palettes at this pixel's world position.
      float gradientRegionV() {
        float weights[${REGION_COUNT}];
        float maxW = -1e9;
        for (int i = 0; i < ${REGION_COUNT}; i++) {
          vec2 d = vGradientWorldPos.xz - uRegionCenters[i];
          float dSq = dot(d, d);
          weights[i] = -dSq / max(1.0, uRegionSigmas[i] * uRegionSigmas[i]);
          maxW = max(maxW, weights[i]);
        }
        // Softmax: subtract max for stability, exp, normalise.
        float sum = 0.0;
        float vAccum = 0.0;
        for (int i = 0; i < ${REGION_COUNT}; i++) {
          float e = exp(weights[i] - maxW);
          sum += e;
          // Region row → centre of its V band, so a pure-region
          // pixel hits the row exactly.
          float rowV = (float(i) + 0.5) / float(${REGION_COUNT});
          vAccum += e * rowV;
        }
        return vAccum / max(sum, 1e-6);
      }
    ` + shader.fragmentShader;

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_fragment>',
      /* glsl */ `
        #ifdef USE_MAP
          vec4 sampledColor = texture2D( map, vMapUv );
          float gradLum = dot( sampledColor.rgb, vec3(0.299, 0.587, 0.114) );
          float regionV = gradientRegionV();
          vec3 graded = texture2D( gradientMap, vec2(gradLum, regionV) ).rgb;
          graded = hueShift(graded, uHueAngle);
          graded *= uBrightness;
          sampledColor.rgb = graded;
          diffuseColor *= sampledColor;
        #endif
      `,
    );
  };
  // Force recompilation if material was already used.
  material.needsUpdate = true;
}
