'use client';

import { useEffect, useState } from 'react';
import { useGame } from '@/store/game';
import { useLevel } from '@/store/level';
import { useMenu } from '@/store/menu';

// Splash menu shown before the game canvas takes focus. Pixel-art
// background fills the screen; buttons stack at the bottom and swap
// in-place between the "main" set (New Game / Continue / Settings) and
// the "settings" set (Erase Save / Back). No modal overlay — keeps the
// pixel-art frame intact.
export default function MainMenu() {
  const startGame = useMenu((s) => s.startGame);
  const startNewGame = useMenu((s) => s.startNewGame);
  const openSettings = useMenu((s) => s.openSettings);
  const closeSettings = useMenu((s) => s.closeSettings);
  const showSettings = useMenu((s) => s.showSettings);

  const [hasSave, setHasSave] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    setHasSave(window.localStorage.getItem('spelauget.level') !== null);
  }, [showSettings]);

  const handleNewGame = () => {
    useLevel.getState().reset();
    useGame.getState().reset();
    // startNewGame triggers the slow fade-from-black overlay.
    startNewGame();
  };

  const handleErase = () => {
    if (typeof window === 'undefined') return;
    const ok = window.confirm('Erase saved progress? This cannot be undone.');
    if (!ok) return;
    window.localStorage.removeItem('spelauget.level');
    window.localStorage.removeItem('spelauget.game');
    useLevel.getState().reset();
    useGame.getState().reset();
    setHasSave(false);
    closeSettings();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-end overflow-hidden bg-black">
      <img
        src="/menu/menu_screen.png"
        alt=""
        className="absolute inset-0 -z-10 h-full w-full object-cover"
        style={{ imageRendering: 'pixelated' }}
        aria-hidden
      />

      <div className="mb-12 flex flex-col items-center gap-3">
        {!showSettings ? (
          <>
            {/* Continue is shown first when a save exists so returning
                players don't have to scan past New Game. */}
            {hasSave && (
              <ImageButton src="/menu/bt_continue.png" alt="Continue" onClick={startGame} />
            )}
            <ImageButton src="/menu/bt_new_game.png" alt="New Game" onClick={handleNewGame} />
            <ImageButton src="/menu/bt_settings.png" alt="Settings" onClick={openSettings} />
          </>
        ) : (
          <>
            <TextButton onClick={handleErase} variant="danger">
              Erase Save
            </TextButton>
            <TextButton onClick={closeSettings}>Back</TextButton>
          </>
        )}
      </div>
    </div>
  );
}

function ImageButton({
  src,
  alt,
  onClick,
}: {
  src: string;
  alt: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="block transition active:scale-95"
      aria-label={alt}
    >
      <img
        src={src}
        alt={alt}
        className="block w-64 max-w-[80vw] select-none"
        style={{ imageRendering: 'pixelated' }}
        draggable={false}
      />
    </button>
  );
}

// Plain-styled button matching the pixel-art frame of the menu image
// buttons (same width, same glow, same text feel) but rendered from
// plain CSS so we can use it for actions we don't have a PNG for.
function TextButton({
  children,
  onClick,
  variant = 'normal',
}: {
  children: React.ReactNode;
  onClick: () => void;
  variant?: 'normal' | 'danger';
}) {
  const palette =
    variant === 'danger'
      ? 'border-rose-400/70 bg-rose-950/80 text-rose-100 shadow-[0_4px_20px_rgba(236,80,120,0.35)]'
      : 'border-pink-300/60 bg-violet-950/80 text-violet-100 shadow-[0_4px_20px_rgba(170,80,220,0.35)]';
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'block w-64 max-w-[80vw] rounded-md border-2 px-4 py-3 text-sm font-bold uppercase tracking-[0.22em] backdrop-blur transition active:scale-95 ' +
        palette
      }
    >
      {children}
    </button>
  );
}
