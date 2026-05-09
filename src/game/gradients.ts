import * as THREE from 'three';

// Photoshop-style gradient map: each stop is [position 0..1, hex color].
export type Stop = [number, string];

// Build a 1D RGBA texture by interpolating between stops. Gets sampled in
// shaders with vec2(luminance, 0.5) to remap a grayscale value to a colour.
export function makeGradientTexture(stops: Stop[], width = 256): THREE.DataTexture {
  const sorted = [...stops].sort((a, b) => a[0] - b[0]);
  const data = new Uint8Array(width * 4);
  const tmpA = new THREE.Color();
  const tmpB = new THREE.Color();

  for (let i = 0; i < width; i++) {
    const t = i / (width - 1);
    let r = 0;
    let g = 0;
    let b = 0;

    if (t <= sorted[0][0]) {
      tmpA.set(sorted[0][1]);
      r = tmpA.r;
      g = tmpA.g;
      b = tmpA.b;
    } else if (t >= sorted[sorted.length - 1][0]) {
      tmpA.set(sorted[sorted.length - 1][1]);
      r = tmpA.r;
      g = tmpA.g;
      b = tmpA.b;
    } else {
      for (let s = 0; s < sorted.length - 1; s++) {
        const [t0, c0] = sorted[s];
        const [t1, c1] = sorted[s + 1];
        if (t >= t0 && t <= t1) {
          const u = (t - t0) / (t1 - t0);
          tmpA.set(c0);
          tmpB.set(c1);
          r = tmpA.r + (tmpB.r - tmpA.r) * u;
          g = tmpA.g + (tmpB.g - tmpA.g) * u;
          b = tmpA.b + (tmpB.b - tmpA.b) * u;
          break;
        }
      }
    }

    data[i * 4 + 0] = Math.round(r * 255);
    data[i * 4 + 1] = Math.round(g * 255);
    data[i * 4 + 2] = Math.round(b * 255);
    data[i * 4 + 3] = 255;
  }

  const tex = new THREE.DataTexture(data, width, 1, THREE.RGBAFormat);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

// All gradient-mapped materials register their uniforms here so we can
// drive day/night and per-level palette swaps for every surface at
// once. `role` tags ground vs plant vs plant-halo vs relic so the level
// transition can swap them independently.
export type GradientRole = 'ground' | 'plant' | 'plant_halo' | 'relic';

type GradientUniforms = {
  uHueAngle: { value: number };
  uBrightness: { value: number };
  gradientMap: { value: THREE.Texture };
  role: GradientRole;
};
const REGISTRY: GradientUniforms[] = [];

export function updateGradientUniforms(hueAngle: number, brightness: number) {
  for (const u of REGISTRY) {
    u.uHueAngle.value = hueAngle;
    u.uBrightness.value = brightness;
  }
}

// Swap the gradient texture used by every material registered under
// the given role. Used on level transition to re-skin the world without
// recompiling shaders.
export function setGradientTexture(role: GradientRole, texture: THREE.Texture) {
  for (const u of REGISTRY) {
    if (u.role === role) u.gradientMap.value = texture;
  }
}

// Patches a material's <map_fragment> shader chunk to remap the sampled
// texture's luminance through a 1D gradient texture, then rotates the
// hue and scales the brightness based on shared day-cycle uniforms.
// Works for any material that includes the standard map_fragment chunk
// (Lambert, Basic, Standard, Phong).
export function applyGradientMap(
  material: THREE.Material,
  gradient: THREE.Texture,
  role: GradientRole,
) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.gradientMap = { value: gradient };
    shader.uniforms.uHueAngle = { value: 0 };
    shader.uniforms.uBrightness = { value: 1 };
    REGISTRY.push({
      uHueAngle: shader.uniforms.uHueAngle,
      uBrightness: shader.uniforms.uBrightness,
      gradientMap: shader.uniforms.gradientMap,
      role,
    });

    shader.fragmentShader =
      /* glsl */ `
      uniform sampler2D gradientMap;
      uniform float uHueAngle;
      uniform float uBrightness;

      // Rodrigues rotation around the (1,1,1)/√3 axis — hue rotation on
      // RGB that preserves luminance.
      vec3 hueShift(vec3 col, float angle) {
        const vec3 k = vec3(0.57735026, 0.57735026, 0.57735026);
        float c = cos(angle);
        return col * c + cross(k, col) * sin(angle) + k * dot(k, col) * (1.0 - c);
      }
    ` + shader.fragmentShader;

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_fragment>',
      /* glsl */ `
        #ifdef USE_MAP
          vec4 sampledColor = texture2D( map, vMapUv );
          float gradLum = dot( sampledColor.rgb, vec3(0.299, 0.587, 0.114) );
          vec3 graded = texture2D( gradientMap, vec2(gradLum, 0.5) ).rgb;
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

