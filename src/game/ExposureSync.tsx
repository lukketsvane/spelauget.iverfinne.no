'use client';

import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { useSettings } from '@/store/settings';

// Bridges the user's exposure setting to the WebGL renderer. Has to
// live inside the <Canvas> tree because gl is only accessible through
// useThree there. Subscribes imperatively so a slider drag updates the
// scene every frame without re-rendering the React tree.
export default function ExposureSync() {
  const gl = useThree((s) => s.gl);

  useEffect(() => {
    const apply = (exposure: number) => {
      gl.toneMappingExposure = exposure;
    };
    apply(useSettings.getState().exposure);
    return useSettings.subscribe((s, prev) => {
      if (s.exposure !== prev.exposure) apply(s.exposure);
    });
  }, [gl]);

  return null;
}
