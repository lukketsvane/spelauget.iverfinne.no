'use client';

import { useGame } from '@/store/game';

export default function HUD() {
  const hearts = useGame((s) => s.hearts);
  const coins = useGame((s) => s.coins);
  const hasKey = useGame((s) => s.hasKey);
  const keys = useGame((s) => s.keys);
  const artifacts = useGame((s) => s.artifacts);

  // Build the inventory list dynamically — only items the player has
  // actually picked up appear under the hearts.
  //
  // Key icon shows once with a count when the player has more than
  // the legacy single key. Keeps the HUD compact even after they
  // collect all four portal-keys; the count communicates progression
  // through the chain.
  //
  // (Crystal pickup was removed from the world, so the crystal slot
  // no longer renders — store field is kept for backwards-compat
  // saves but never increments anymore.)
  const items: { id: string; src: string; count?: number }[] = [];
  if (hasKey || keys.length > 0) {
    items.push({
      id: 'key',
      // The digger's key is rendered via the flisverden key tile —
      // it's the same physical object the player carries through
      // every portal in the chain. URL-encoded ø so the path works
      // when the dev server serves it as static.
      src: '/flisverden/flis_n%C3%B8kkel.png',
      count: keys.length > 1 ? keys.length : undefined,
    });
  }
  if (artifacts.length > 0) {
    // Artefacts are deliberately understated — same crystal icon as a
    // placeholder until a proper artefact sprite exists. Count
    // doubles as the bitmask population count for the endings.
    items.push({
      id: 'artifacts',
      src: '/menu/crystal.png',
      count: artifacts.length,
    });
  }
  if (coins > 0) items.push({ id: 'coins', src: '/menu/coin.png', count: coins });

  return (
    <div className="pointer-events-none absolute inset-0 select-none">
      {/* Top-left: hearts + collected items, stacked vertically.
          (XP / level progress bar in the top-right was removed —
          progression is now legible via the key + artefact slots
          alone.) */}
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
