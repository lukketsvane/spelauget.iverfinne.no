'use client';

import { useGame } from '@/store/game';

export default function HUD() {
  const hearts = useGame((s) => s.hearts);
  const coins = useGame((s) => s.coins);
  const crystals = useGame((s) => s.crystals);
  const hasKey = useGame((s) => s.hasKey);
  const xp = useGame((s) => s.xp);
  const xpToNext = useGame((s) => s.xpToNext);

  // Build the inventory list dynamically — only items the player has
  // actually picked up appear under the hearts.
  const items: { id: string; src: string; count?: number }[] = [];
  if (hasKey) items.push({ id: 'key', src: '/menu/key_01.png' });
  if (coins > 0) items.push({ id: 'coins', src: '/menu/coin.png', count: coins });
  if (crystals > 0)
    items.push({ id: 'crystals', src: '/menu/crystal.png', count: crystals });

  return (
    <div className="pointer-events-none absolute inset-0 select-none">
      {/* Top-left: hearts + collected items, stacked vertically. */}
      <div className="absolute left-4 top-4 flex flex-col gap-2 text-violet-100">
        <div className="flex gap-1.5">
          {Array.from({ length: 3 }, (_, i) => (
            <Heart key={i} filled={i < hearts} />
          ))}
        </div>
        {items.length > 0 && (
          <div className="flex flex-col gap-1.5">
            {items.map((it) => (
              <InventorySlot key={it.id} src={it.src} count={it.count} alt={it.id} />
            ))}
          </div>
        )}
      </div>

      {/* Top-right: XP. Pause button now lives in the bottom-left so
          this corner is back to its normal top spot. */}
      <div className="absolute right-4 top-4 flex flex-col items-end gap-1 text-violet-100">
        <div className="text-xs">
          {xp} / {xpToNext} XP
        </div>
        <div className="h-2 w-32 overflow-hidden rounded-sm border border-violet-300/60 bg-violet-950/60">
          <div
            className="h-full bg-gradient-to-r from-pink-400 to-violet-300 transition-[width] duration-200"
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

// Pixel-art inventory slot. Pop-in animation on first mount; rerenders
// don't re-trigger the keyframes (CSS handles that). The optional
// `count` is shown to the right for stackable items (coins, crystals).
function InventorySlot({
  src,
  alt,
  count,
}: {
  src: string;
  alt: string;
  count?: number;
}) {
  return (
    <div
      className="animate-key-pop flex items-center gap-1.5"
      title={alt}
    >
      <img
        src={src}
        alt={alt}
        width={32}
        height={32}
        className="block select-none"
        style={{ imageRendering: 'pixelated' }}
        draggable={false}
      />
      {count !== undefined && (
        <span className="text-base font-semibold tabular-nums">×{count}</span>
      )}
    </div>
  );
}
