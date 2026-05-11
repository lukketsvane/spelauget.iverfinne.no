'use client';

import { useEffect, useMemo } from 'react';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { collision } from '@/store/collision';

// Half-depth of the sprite-card's collision footprint along its local
// Z axis. Just enough thickness so the player walks around the
// silhouette rather than gliding through it edge-on.
const CARD_THICKNESS = 0.22;
const FACE_CAMERA_Y = Math.PI / 4;

type Props = {
  id: string;
  position: [number, number, number];
  texture: string;
  // World-space height of the rendered card. Width derives from aspect.
  height?: number;
  scale?: number;
  // Y-rotation jitter on top of FACE_CAMERA_Y so neighbouring sprites
  // don't all face the camera at the same angle.
  rotationOffset?: number;
  // Disable the collider for purely decorative props (e.g. flying
  // moths, distant horizon silhouettes).
  noCollide?: boolean;
  // Lift the card off the ground (metres). Default places the card
  // sitting on the ground; flying creatures pass a positive y.
  yOffset?: number;
  // Optional emissive boost: lifts the painted colours off the
  // ambient lighting so a glowing portal or moth reads as luminous.
  // 0 = no glow (default), 1 = pure self-lit, 0.4 = a hint of glow.
  glow?: number;
  // Optional tint multiplier (hex). Useful for tinting white-grey
  // silhouettes toward red/pink for the blood biome.
  tint?: string;
};

// Painted-card sprite for the blod_verden asset family. Source PNGs
// have BLACK backgrounds with light silhouettes / coloured shapes;
// the shader patch maps luminance → alpha so the silhouette comes
// through and the black plate vanishes. RGB is preserved (no gradient
// remap), so a red portal stays red while a white moth stays icy-blue.
//
// Vertical billboard tilted 45° toward the iso camera, with a thin
// OBB collider that matches the card's footprint.
export default function BlodSprite({
  id,
  position,
  texture,
  height = 5,
  scale = 1,
  rotationOffset = 0,
  noCollide = false,
  yOffset = 0,
  glow = 0,
  tint,
}: Props) {
  const tex = useTexture(texture);

  useEffect(() => {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.anisotropy = 4;
    tex.needsUpdate = true;
  }, [tex]);

  const material = useMemo(() => {
    const m = new THREE.MeshLambertMaterial({
      map: tex,
      transparent: true,
      alphaTest: 0.08,
      side: THREE.DoubleSide,
      color: tint ? new THREE.Color(tint) : 0xffffff,
      emissive: new THREE.Color(0xffffff),
      emissiveMap: tex,
      emissiveIntensity: glow,
    });

    // Patch the fragment shader so the PNG's luminance becomes alpha:
    // anything above near-black survives. Tight cutoff at the very
    // bottom of the luminance range, then a quick ramp — keeps the
    // soft painted gradients in the silhouette opaque while dropping
    // the black background cleanly.
    m.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <map_fragment>',
        /* glsl */ `
          #ifdef USE_MAP
            vec4 srcRaw = texture2D( map, vMapUv );
            float srcLum = dot( srcRaw.rgb, vec3(0.299, 0.587, 0.114) );
            float a = smoothstep(0.015, 0.12, srcLum) * srcRaw.a;
            diffuseColor.rgb *= srcRaw.rgb;
            diffuseColor.a *= a;
          #endif
        `,
      );
    };
    m.needsUpdate = true;
    return m;
  }, [tex, glow, tint]);

  useEffect(() => () => material.dispose(), [material]);

  const dims = useMemo(() => {
    const img = tex.image as { width?: number; height?: number } | undefined;
    const aspect = img?.width && img?.height ? img.width / img.height : 1;
    const h = height * scale;
    const w = h * aspect;
    return { w, h };
  }, [tex, height, scale]);

  // Thin OBB matching the visible card.
  useEffect(() => {
    if (noCollide) return;
    collision.registerBox(
      id,
      position[0],
      position[2],
      dims.w / 2,
      CARD_THICKNESS,
      FACE_CAMERA_Y + rotationOffset,
    );
    return () => collision.unregister(id);
  }, [id, position, dims.w, rotationOffset, noCollide]);

  return (
    <mesh
      position={[position[0], yOffset + dims.h / 2, position[2]]}
      rotation={[0, FACE_CAMERA_Y + rotationOffset, 0]}
      castShadow
      receiveShadow
    >
      <planeGeometry args={[dims.w, dims.h]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}
