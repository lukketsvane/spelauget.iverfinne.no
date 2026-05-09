'use client';

import { useGame } from '@/store/game';

export default function HUD() {
  const hearts = useGame((s) => s.hearts);
  const coins = useGame((s) => s.coins);
  const level = useGame((s) => s.level);
  const xp = useGame((s) => s.xp);
  const xpToNext = useGame((s) => s.xpToNext);

  return (
    <div className="pointer-events-none absolute inset-0 select-none">
      {/* Top-left: hearts + coins */}
      <div className="absolute left-4 top-4 flex flex-col gap-2 text-neutral-800">
        <div className="flex gap-1.5">
          {Array.from({ length: 3 }, (_, i) => (
            <Heart key={i} filled={i < hearts} />
          ))}
        </div>
        <div className="flex items-center gap-2 text-lg font-semibold">
          <Coin /> <span>x {coins}</span>
        </div>
      </div>

      {/* Top-right: level + XP */}
      <div className="absolute right-4 top-4 flex flex-col items-end gap-1 text-neutral-800">
        <div className="text-lg font-semibold tracking-wide">LV. {level}</div>
        <div className="text-xs">
          {xp} / {xpToNext} XP
        </div>
        <div className="h-2 w-32 overflow-hidden rounded-sm border border-neutral-700 bg-white">
          <div
            className="h-full bg-neutral-700 transition-[width] duration-200"
            style={{ width: `${Math.min(100, (xp / xpToNext) * 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function Heart({ filled }: { filled: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
      <path
        d="M12 21s-7-4.35-9.5-9C.6 7.7 3.4 4 7 4c2 0 3.5 1 5 3 1.5-2 3-3 5-3 3.6 0 6.4 3.7 4.5 8-2.5 4.65-9.5 9-9.5 9z"
        fill={filled ? '#e11d48' : 'none'}
        stroke="#7f1d1d"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function Coin() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="9" fill="#fbbf24" stroke="#a16207" strokeWidth="1.5" />
      <text
        x="12"
        y="16"
        textAnchor="middle"
        fontSize="11"
        fontWeight="700"
        fill="#78350f"
        fontFamily="serif"
      >
        ¢
      </text>
    </svg>
  );
}
