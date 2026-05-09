'use client';

import { useMemo } from 'react';
import { useLoader } from '@react-three/fiber';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import * as THREE from 'three';

const URL = '/models/rock_stack.stl';

type Props = {
  position: [number, number, number];
  scale?: number;
  rotationY?: number;
};

// Stack of rocks loaded from STL. STL has no materials, so we attach a
// stone-coloured Lambert with a touch of emissive for visibility in the
// dark scene.
export default function RockStack({ position, scale = 12, rotationY = 0 }: Props) {
  const geom = useLoader(STLLoader, URL);

  // STL ships Z-up by convention; three.js is Y-up — rotate so the
  // stack stands upright. Then recompute bbox and lift so the bottom
  // sits on y = 0.
  const prepared = useMemo(() => {
    const g = geom.clone();
    g.rotateX(-Math.PI / 2);
    g.computeVertexNormals();
    g.computeBoundingBox();
    if (g.boundingBox) {
      const lift = -g.boundingBox.min.y;
      g.translate(0, lift, 0);
    }
    return g;
  }, [geom]);

  const material = useMemo(
    () =>
      new THREE.MeshLambertMaterial({
        color: '#6b5a85',
        emissive: new THREE.Color('#1a1130'),
        emissiveIntensity: 0.35,
      }),
    [],
  );

  return (
    <mesh
      position={position}
      rotation={[0, rotationY, 0]}
      scale={scale}
      geometry={prepared}
      material={material}
      castShadow
      receiveShadow
    />
  );
}
