import * as THREE from 'three';

// Photoshop-style gradient map: each stop is [position 0..1, hex color].
type Stop = [number, string];

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

// Patches a material's <map_fragment> shader chunk to remap the sampled
// texture's luminance through a 1D gradient texture. Works for any
// material that includes the standard map_fragment chunk (Lambert, Basic,
// Standard, Phong all do).
export function applyGradientMap(material: THREE.Material, gradient: THREE.Texture) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.gradientMap = { value: gradient };
    shader.fragmentShader = `uniform sampler2D gradientMap;\n${shader.fragmentShader}`;
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_fragment>',
      /* glsl */ `
        #ifdef USE_MAP
          vec4 sampledColor = texture2D( map, vMapUv );
          float gradLum = dot( sampledColor.rgb, vec3(0.299, 0.587, 0.114) );
          vec3 graded = texture2D( gradientMap, vec2(gradLum, 0.5) ).rgb;
          sampledColor.rgb = graded;
          diffuseColor *= sampledColor;
        #endif
      `,
    );
  };
  // Force recompilation if material was already used.
  material.needsUpdate = true;
}

// --- Curated gradient ramps for the moody bioluminescent look ----------

// Ground stays dark and subdued so the plants/particles can pop.
export const GROUND_GRADIENT: Stop[] = [
  [0.0, '#0a0418'],
  [0.35, '#1f1438'],
  [0.7, '#3a2a5e'],
  [1.0, '#6a558d'],
];

// Plants get a vibrant ramp: deep indigo body → magenta mids → near-white
// highlights, so even mostly-dark inky source PNGs read as glowing flora.
export const PLANT_GRADIENT: Stop[] = [
  [0.0, '#241048'],
  [0.35, '#7a2db3'],
  [0.65, '#d35ab8'],
  [0.85, '#ff9bd6'],
  [1.0, '#ffe3f2'],
];
