'use client';

import { useEffect, useState } from 'react';
import { useGame } from '@/store/game';
import { useLevel } from '@/store/level';
import { useMenu } from '@/store/menu';
import SettingsPanel from './SettingsPanel';

// Splash menu shown before the game canvas takes focus. Pixel-art
// background fills the screen; three image-buttons stack at the bottom.
// Continue is hidden when no save exists yet.
export default function MainMenu() {
  const startGame = useMenu((s) => s.startGame);
  const openSettings = useMenu((s) => s.openSettings);
  const showSettings = useMenu((s) => s.showSettings);

  const [hasSave, setHasSave] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    setHasSave(window.localStorage.getItem('spelauget.level') !== null);
  }, []);

  const handleNewGame = () => {
    useLevel.getState().reset();
    useGame.getState().reset();
    startGame();
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
        <MenuButton src="/menu/bt_new_game.png" alt="New Game" onClick={handleNewGame} />
        {hasSave && (
          <MenuButton src="/menu/bt_continue.png" alt="Continue" onClick={startGame} />
        )}
        <MenuButton src="/menu/bt_settings.png" alt="Settings" onClick={openSettings} />
      </div>

      {showSettings && <SettingsPanel />}
    </div>
  );
}

function MenuButton({
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
