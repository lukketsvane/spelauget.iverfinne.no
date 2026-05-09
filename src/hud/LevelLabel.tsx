'use client';

import { LEVELS } from '@/game/levels';
import { useLevel } from '@/store/level';

// Bottom-left chip showing the current level's name. Updates as soon as
// the level state changes; used as orientation when teleporting.
export default function LevelLabel() {
  const id = useLevel((s) => s.currentLevelId);
  const name = LEVELS[id].name;
  return (
    <div className="pointer-events-none absolute bottom-20 left-4 z-10 select-none text-xs uppercase tracking-[0.22em] text-violet-200/80 drop-shadow-[0_2px_4px_rgba(0,0,0,0.7)]">
      {name}
    </div>
  );
}
