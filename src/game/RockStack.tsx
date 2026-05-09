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
export default function RockStack({ position, scale = 1.2, rotationY = 0 }: Props) {
  const geom = useLoader(STLLoader, URL);

  // STL geometry sometimes has flat normals or a Y-up offset baked in;
  // re-centre to bbox bottom and recompute normals so it sits cleanly
  // on the ground.
  const prepared = useMemo(() => {
    const g = geom.clone();
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
