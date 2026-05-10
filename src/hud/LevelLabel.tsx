'use client';

import { getRegion } from '@/game/regions';
import { useLevel } from '@/store/level';

// Bottom-left chip showing the current region's name. Updates as the
// player walks across a region boundary (savePosition refreshes
// currentRegionId every couple seconds) or after a fast-travel hop.
export default function LevelLabel() {
  const regionId = useLevel((s) => s.currentRegionId);
  const name = getRegion(regionId).name;
  return (
    <div className="pointer-events-none absolute bottom-20 left-4 z-10 select-none text-xs uppercase tracking-[0.22em] text-violet-200/80">
      {name}
    </div>
  );
}
