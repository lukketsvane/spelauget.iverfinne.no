'use client';

import { useEffect, useMemo } from 'react';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { applyGradientMap, GROUND_GRADIENT, makeGradientTexture } from './gradients';

const GROUND_TEXTURES = ['/ny_bakke_01.png', '/ny_bakke_02.png', '/ny_bakke_03.png'];
const GROUND_SIZE = 400;
// World units per ground tile. The fragment shader picks a random one of
// the three source textures and a random 90° rotation per tile so the
// pattern reads as natural and never visibly repeats.
const TILE_SIZE = 6;

export default function Ground() {
  const textures = useTexture(GROUND_TEXTURES);

  useEffect(() => {
    for (const tex of textures) {
      // Per-tile sampling means we want the texture clamped to its own
      // 0..1 UV range — wrapping would let neighbouring tiles bleed in.
      tex.wrapS = THREE.ClampToEdgeWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 8;
      tex.minFilter = THREE.LinearMipMapLinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.generateMipmaps = true;
      tex.needsUpdate = true;
    }
  }, [textures]);

  const gradientTex = useMemo(() => makeGradientTexture(GROUND_GRADIENT), []);

  const material = useMemo(() => {
    const m = new THREE.MeshLambertMaterial({
      // The `map` slot needs *some* texture so three.js wires up the UV
      // varyings (vMapUv etc.) we read in our shader patch. We sample
      // tileTex0/1/2 ourselves and ignore the bound map.
      map: textures[0],
      color: '#ffffff',
      emissive: new THREE.Color('#a08bc0'),
      emissiveIntensity: 0.6,
      emissiveMap: textures[0],
    });

    applyGradientMap(m, gradientTex);

    // Now extend the patched material with stochastic three-texture
    // sampling. We chain on top of applyGradientMap's onBeforeCompile —
    // its replacement of <map_fragment> reads from our `sampleStochastic`
    // helper instead of the raw `map` uniform.
    const prev = m.onBeforeCompile;
    m.onBeforeCompile = (shader) => {
      prev?.(shader);
      shader.uniforms.tileTex0 = { value: textures[0] };
      shader.uniforms.tileTex1 = { value: textures[1] };
      shader.uniforms.tileTex2 = { value: textures[2] };
      shader.uniforms.tilesPerSide = { value: GROUND_SIZE / TILE_SIZE };

      const helper = /* glsl */ `
        uniform sampler2D tileTex0;
        uniform sampler2D tileTex1;
        uniform sampler2D tileTex2;
        uniform float tilesPerSide;

        // Cheap 2D hash → 0..1.
        float groundHash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }

        // Returns the colour of the stochastic ground at a given UV.
        // Each tile picks one of three textures and a 90° rotation,
        // both seeded by the integer tile coordinate.
        vec4 sampleStochastic(vec2 uv) {
          vec2 g = uv * tilesPerSide;
          vec2 tileId = floor(g);
          vec2 localUv = fract(g);

          // Random 90° rotation around tile centre.
          float rotH = groundHash(tileId + vec2(7.1, 13.9));
          float steps = floor(rotH * 4.0);
          vec2 c = localUv - 0.5;
          if (steps > 2.5)      c = vec2( c.y, -c.x);
          else if (steps > 1.5) c = -c;
          else if (steps > 0.5) c = vec2(-c.y,  c.x);
          localUv = c + 0.5;

          // Pick texture.
          float pickH = groundHash(tileId);
          if (pickH < 0.3333) return texture2D(tileTex0, localUv);
          if (pickH < 0.6666) return texture2D(tileTex1, localUv);
          return texture2D(tileTex2, localUv);
        }
      `;

      shader.fragmentShader = helper + shader.fragmentShader;

      // Reroute every texture2D(map, vMapUv) and texture2D(emissiveMap, …)
      // through sampleStochastic so the gradient + emissive patches
      // operate on the blended result instead of the dummy `map`.
      shader.fragmentShader = shader.fragmentShader.replace(
        /texture2D\(\s*map\s*,\s*vMapUv\s*\)/g,
        'sampleStochastic(vMapUv)',
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        /texture2D\(\s*emissiveMap\s*,\s*vEmissiveMapUv\s*\)/g,
        'sampleStochastic(vEmissiveMapUv)',
      );
    };
    m.needsUpdate = true;
    return m;
  }, [textures, gradientTex]);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
      <planeGeometry args={[GROUND_SIZE, GROUND_SIZE]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

useTexture.preload(GROUND_TEXTURES);
