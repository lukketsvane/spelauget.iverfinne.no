'use client';

import { useEffect, useMemo } from 'react';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { collision } from '@/store/collision';
import { applyGradientMap, getGradientTexture } from './gradients';
import { makeRegionGradientTexture } from './regions';

const FACE_CAMERA_Y = Math.PI / 4;
// Half-depth of the silhouette card's collision footprint along its
// local Z axis. Just thick enough to feel solid edge-on.
const CARD_THICKNESS = 0.22;

type Props = {
  id: string;
  position: [number, number, number];
  texture: string;
  // World-space height of the rendered card. Width derives from aspect.
  height?: number;
  scale?: number;
  // Y-rotation jitter on top of FACE_CAMERA_Y so neighbouring remnants
  // don't all front the camera at exactly the same angle.
  rotationOffset?: number;
};

// Tall sprite-card ruin scattered across The Remnants. Source PNGs are
// gray silhouettes on a near-white background; the fragment shader
// inverts luminance into alpha so the chunky shape comes through and
// the white plate disappears. The remaining color goes through the
// relic-role gradient so the level's grays read on the silhouette.
//
// Casts a tilted shadow and registers a thin OBB collider so the
// player walks around it rather than through.
export default function Remnant({
  id,
  position,
  texture,
  height = 5,
  scale = 1,
  rotationOffset = 0,
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
    // MeshLambertMaterial so the remnant takes the day-cycle lighting
    // (the directional + ambient + hemisphere) and reads with depth.
    const m = new THREE.MeshLambertMaterial({
      map: tex,
      transparent: true,
      alphaTest: 0.35,
      side: THREE.DoubleSide,
    });
    const initialGradient =
      getGradientTexture('relic') ?? makeRegionGradientTexture('relic');
    applyGradientMap(m, initialGradient, 'relic');

    // Layer an alpha-from-inverted-luminance shader chunk on top of the
    // gradient remap so the white plate around the silhouette becomes
    // transparent. Chained onto the existing onBeforeCompile from
    // applyGradientMap, not replacing it.
    const prev = m.onBeforeCompile;
    m.onBeforeCompile = (shader, renderer) => {
      prev?.call(m, shader, renderer);
      shader.fragmentShader = shader.fragmentShader.replace(
        'diffuseColor *= sampledColor;',
        /* glsl */ `
          // Invert the source PNG's luminance to get alpha — the gray
          // silhouette stays opaque, the white background fades out.
          vec4 srcRaw = texture2D( map, vMapUv );
          float srcLum = dot( srcRaw.rgb, vec3(0.299, 0.587, 0.114) );
          float alpha = clamp(1.0 - srcLum, 0.0, 1.0);
          // Sharpen the cutoff so edges read crisp at low dpr.
          alpha = smoothstep(0.25, 0.6, alpha);
          sampledColor.a *= alpha * srcRaw.a;
          diffuseColor *= sampledColor;
        `,
      );
    };
    m.needsUpdate = true;
    return m;
  }, [tex]);

  useEffect(() => () => material.dispose(), [material]);

  const dims = useMemo(() => {
    const img = tex.image as { width?: number; height?: number } | undefined;
    const aspect = img?.width && img?.height ? img.width / img.height : 0.6;
    const h = height * scale;
    const w = h * aspect;
    return { w, h };
  }, [tex, height, scale]);

  // Thin OBB matching the card's ground footprint, rotated to match
  // its face-the-camera + rotationOffset orientation.
  useEffect(() => {
    collision.registerBox(
      id,
      position[0],
      position[2],
      dims.w / 2,
      CARD_THICKNESS,
      FACE_CAMERA_Y + rotationOffset,
    );
    return () => collision.unregister(id);
  }, [id, position, dims.w, rotationOffset]);

  return (
    <mesh
      position={[position[0], dims.h / 2, position[2]]}
      rotation={[0, FACE_CAMERA_Y + rotationOffset, 0]}
      castShadow
      receiveShadow
    >
      <planeGeometry args={[dims.w, dims.h]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}
