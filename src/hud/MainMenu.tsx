'use client';

import { useEffect, useState } from 'react';
import { useAudio } from '@/store/audio';
import { useGame } from '@/store/game';
import { useLevel } from '@/store/level';
import { useMenu } from '@/store/menu';
import { useSettings } from '@/store/settings';
import type { RegionId } from '@/game/regions';
import PixelatedImage from './PixelatedImage';

// The five named worlds the player can teleport between. Listed in
// chain order so the menu reads as "the journey" top-to-bottom. The
// legacy stjerneengen / remnants regions still exist in REGIONS for
// gradient/blend purposes but aren't surfaced here — they're not
// part of the user-facing chain.
const CHAIN_REGION_IDS: RegionId[] = [
  'lysningen',
  'blod',
  'geometri',
  'siste',
  'senter',
];

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
  const backToTitle = useMenu((s) => s.backToTitle);

  // "Has save" check: read whatever zustand persisted under
  // `spelauget.game` and look for a meaningful in-game state. The
  // game store is only written when the player actually does
  // something that mutates it (New Game, picking up the key,
  // following Bobble, etc.) — useLevel's autosave alone isn't a
  // reliable signal because it can fire from background side
  // effects. We additionally require at least one of the meaningful
  // flags to be set, so a stale localStorage from an earlier
  // half-played session that just contained default values won't
  // show a Continue button on a "fresh" first launch.
  const [hasSave, setHasSave] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = window.localStorage.getItem('spelauget.game');
    if (!raw) {
      setHasSave(false);
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      // zustand persist wraps state as { state, version }.
      const data = parsed?.state as
        | {
            hasKey?: boolean;
            bobbleVanished?: boolean;
            coins?: number;
            crystals?: number;
          }
        | undefined;
      const meaningful =
        !!(data?.hasKey || data?.bobbleVanished || (data?.coins ?? 0) > 0 || (data?.crystals ?? 0) > 0);
      setHasSave(meaningful);
    } catch {
      setHasSave(false);
    }
  }, [showSettings]);

  const handleNewGame = () => {
    useLevel.getState().reset();
    useGame.getState().reset();
    startNewGame();
  };

  // Fast-travel moved from the pause menu to the number keys 1..5
  // (see TravelHotkey). The legacy travelTargets / handleTravel
  // helpers are gone — kept the CHAIN_REGION_IDS constant available
  // to anything else that might want to iterate the chain.

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
        (hasStartedGame ? 'bg-black/70' : 'bg-black')
      }
    >
      {/* Splash background — only on the very first visit, before the
          player has ever entered the game. After that the menu is a
          pause overlay and we want the canvas to show through.
          Routed through PixelatedImage so the splash matches the
          chunky 0.45-DPR look of the in-game canvas instead of
          rendering smooth at native resolution. */}
      {!hasStartedGame && (
        <PixelatedImage
          src="/menu/menu_screen.png"
          alt="Title screen"
          className="absolute inset-0 -z-10 h-full w-full"
        />
      )}

      <div className="mb-12 flex w-64 max-w-[80vw] flex-col items-stretch gap-3">
        {!showSettings ? (
          <>
            {/* Continue first when a save exists — that's the most
                common returning-player action. */}
            {hasSave && <TextButton onClick={startGame}>Continue</TextButton>}
            {/* Travel section removed: the in-game pause menu no
                longer fast-travels. World shortcuts moved to the
                1..5 number-keys (handled by TravelHotkey) so the
                pause overlay stays focused on save / settings. The
                map overlay is also gone — these worlds are meant to
                be walked between via portals and the number keys. */}
            {/* New Game is destructive (wipes progress) — restrict it
                to the splash screen so the player can't fat-finger it
                from the in-game pause overlay. They can still wipe via
                Settings → Erase Save if they really mean it. */}
            {!hasStartedGame && (
              <TextButton onClick={handleNewGame}>New Game</TextButton>
            )}
            <TextButton onClick={openSettings}>Settings</TextButton>
            {/* Title Screen: only meaningful from the in-game pause
                overlay; on the splash itself we'd be sending the
                player to the screen they're already on. The save is
                untouched, so Continue still works after. */}
            {hasStartedGame && (
              <TextButton onClick={backToTitle}>Title Screen</TextButton>
            )}
          </>
        ) : (
          <SettingsPanel onErase={handleErase} onBack={closeSettings} />
        )}
      </div>
    </div>
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
    ['Menu', 'Q or Esc'],
    ['Travel', '1 Hagen · 2 Blod · 3 Flis · 4 Salt · 5 Kjeller'],
    ['Tune', 'T'],
  ];
  return (
    <div className="rounded-md border-2 border-pink-300/60 bg-violet-950/80 px-4 py-3">
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
    <div className="rounded-md border-2 border-pink-300/60 bg-violet-950/80 px-4 py-3">
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
      ? 'border-rose-400/70 bg-rose-950/80 text-rose-100'
      : 'border-pink-300/60 bg-violet-950/80 text-violet-100';
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'block w-full rounded-md border-2 px-4 py-3 text-sm font-bold uppercase tracking-[0.22em] transition active:scale-95 ' +
        palette
      }
    >
      {children}
    </button>
  );
}

// Small uppercase divider used to separate Travel destinations from
// the Continue / New Game / Settings buttons.
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-1 text-center text-[10px] font-bold uppercase tracking-[0.32em] text-pink-200/80">
      {children}
    </div>
  );
}
