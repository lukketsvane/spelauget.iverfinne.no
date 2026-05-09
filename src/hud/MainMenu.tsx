'use client';

import { useEffect, useState } from 'react';
import { useAudio } from '@/store/audio';
import { useGame } from '@/store/game';
import { useLevel } from '@/store/level';
import { useMenu } from '@/store/menu';
import { useSettings } from '@/store/settings';

// Splash menu shown before the game canvas takes focus, and as a
// pause overlay when the player taps the menu button mid-game.
//
// Two visual modes:
//   - Splash (first ever visit): full pixel-art bg image fills the screen.
//   - Pause (after first start): just a dim translucent overlay so the
//     game canvas behind stays visible.
export default function MainMenu() {
  const startGame = useMenu((s) => s.startGame);
  const startNewGame = useMenu((s) => s.startNewGame);
  const openSettings = useMenu((s) => s.openSettings);
  const closeSettings = useMenu((s) => s.closeSettings);
  const showSettings = useMenu((s) => s.showSettings);
  const hasStartedGame = useMenu((s) => s.hasStartedGame);

  const [hasSave, setHasSave] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    setHasSave(window.localStorage.getItem('spelauget.level') !== null);
  }, [showSettings]);

  const handleNewGame = () => {
    useLevel.getState().reset();
    useGame.getState().reset();
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
    <div
      className={
        'fixed inset-0 z-50 flex flex-col items-center justify-end overflow-hidden ' +
        (hasStartedGame ? 'bg-black/70 backdrop-blur-sm' : 'bg-black')
      }
    >
      {/* Splash background — only on the very first visit, before the
          player has ever entered the game. After that the menu is a
          pause overlay and we want the canvas to show through. */}
      {!hasStartedGame && (
        <img
          src="/menu/menu_screen.png"
          alt=""
          className="absolute inset-0 -z-10 h-full w-full object-cover"
          style={{ imageRendering: 'pixelated' }}
          aria-hidden
        />
      )}

      <div className="mb-12 flex flex-col items-center gap-3">
        {!showSettings ? (
          <>
            {/* Continue first when a save exists. */}
            {hasSave && (
              <ImageButton src="/menu/bt_continue.png" alt="Continue" onClick={startGame} />
            )}
            <ImageButton src="/menu/bt_new_game.png" alt="New Game" onClick={handleNewGame} />
            <ImageButton src="/menu/bt_settings.png" alt="Settings" onClick={openSettings} />
          </>
        ) : (
          <SettingsPanel onErase={handleErase} onBack={closeSettings} />
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

function SettingsPanel({ onErase, onBack }: { onErase: () => void; onBack: () => void }) {
  const musicVolume = useAudio((s) => s.musicVolume);
  const setMusicVolume = useAudio((s) => s.setMusicVolume);
  const exposure = useSettings((s) => s.exposure);
  const setExposure = useSettings((s) => s.setExposure);

  return (
    <div className="flex w-64 max-w-[80vw] flex-col gap-3">
      <RangeSlider
        label="Music"
        value={musicVolume}
        onChange={setMusicVolume}
        min={0}
        max={1}
        step={0.01}
        format={(v) => `${Math.round(v * 100)}`}
      />
      <RangeSlider
        label="Brightness"
        value={exposure}
        onChange={setExposure}
        min={0.4}
        max={1.8}
        step={0.02}
        // Show as a percentage relative to default (1.0 = 100). A
        // dim laptop on battery would crank this to 130–150 to
        // compensate.
        format={(v) => `${Math.round(v * 100)}`}
      />
      <ControlsLegend />
      <TextButton onClick={onErase} variant="danger">
        Erase Save
      </TextButton>
      <TextButton onClick={onBack}>Back</TextButton>
    </div>
  );
}

// Discoverability for the desktop keybinds. Tucked into the settings
// panel rather than the main menu so first-time mobile players don't
// see irrelevant keyboard hints.
function ControlsLegend() {
  const rows: [string, string][] = [
    ['Move', 'WASD / Arrows / Hold mouse'],
    ['Bow', 'E or Space'],
    ['Menu', 'M or Esc'],
  ];
  return (
    <div className="rounded-md border-2 border-pink-300/60 bg-violet-950/80 px-4 py-3 backdrop-blur">
      <div className="mb-2 text-xs font-bold uppercase tracking-[0.22em] text-pink-200">
        Controls
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs text-violet-200">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="font-bold uppercase tracking-wider text-pink-200/80">{k}</dt>
            <dd className="tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

// Generic labelled range input. Same pixel-art panel chrome the
// VolumeSlider used to have; now reused for Brightness too.
function RangeSlider({
  label,
  value,
  onChange,
  min,
  max,
  step,
  format,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  format?: (v: number) => string;
}) {
  return (
    <div className="rounded-md border-2 border-pink-300/60 bg-violet-950/80 px-4 py-3 backdrop-blur">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-[0.22em] text-pink-200">
          {label}
        </span>
        <span className="text-xs tabular-nums text-violet-200">
          {format ? format(value) : value.toFixed(2)}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="block w-full accent-pink-400"
      />
    </div>
  );
}

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
        'block w-full rounded-md border-2 px-4 py-3 text-sm font-bold uppercase tracking-[0.22em] backdrop-blur transition active:scale-95 ' +
        palette
      }
    >
      {children}
    </button>
  );
}
