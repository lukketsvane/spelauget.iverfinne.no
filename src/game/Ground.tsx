'use client';

// A large white plane that *receives* shadows but doesn't add visible geometry.
// ShadowMaterial keeps the surface invisible so the bg color shows through —
// this is what gives the "hard shadow on white" look from the screenshots.
export default function Ground() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
      <planeGeometry args={[200, 200]} />
      <shadowMaterial transparent opacity={0.35} />
    </mesh>
  );
}
