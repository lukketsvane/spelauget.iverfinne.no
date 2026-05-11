'use client';

import { useEffect, useState } from 'react';
import { getRegionStops, mutateRegionStops, type Stop } from '@/game/gradients';
import {
  REGIONS,
  type PaletteRole,
  type RegionId,
} from '@/game/regions';
import { useLevel } from '@/store/level';
import { useTuner, type FogConfig } from '@/store/tuner';

// Dev-tuner panel. Pinned to the right edge of the screen, scrollable.
// Lets you live-edit the active region's gradient stops and fog
// without a code reload. Strip before shipping (or guard behind a
// debug flag) — every prop is mutable and the UI is utilitarian, not
// designed to ship to players.
//
// Layout:
//   - Region selector (defaults to whichever region the player is in)
//   - Fog block: colour, near, far
//   - Four palette blocks (ground / plant / halo / relic), each a
//     list of stops with a position label + colour picker
//
// Each colour change calls mutateRegionStops, which rewrites the
// REGIONS array in place, rebuilds the role's gradient texture, and
// re-points every patched material at the new texture. So edits show
// up the next render frame across the whole world.

const ROLES: PaletteRole[] = ['ground', 'plant', 'halo', 'relic'];

export default function GradientTuner() {
  const currentRegion = useLevel((s) => s.currentRegionId);
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<RegionId>(currentRegion);

  // Auto-follow the active region when the panel is collapsed so
  // re-opening it lands on the world the player is actually in. When
  // open we leave it pinned so a fast-travel doesn't yank the user
  // out of the palette they're actively editing.
  if (!open && target !== currentRegion) {
    setTarget(currentRegion);
  }

  if (!open) {
    return (
      <button
        type="button"
        onPointerDown={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className="pointer-events-auto absolute right-4 top-1/2 z-30 -translate-y-1/2 rounded-md border border-pink-300/60 bg-violet-950/80 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-pink-200 shadow-lg active:scale-95"
        aria-label="Open gradient tuner"
      >
        tune
      </button>
    );
  }

  return (
    <div
      className="pointer-events-auto absolute right-2 top-2 bottom-2 z-30 flex w-72 flex-col overflow-hidden rounded-md border border-pink-300/60 bg-violet-950/95 text-violet-100 shadow-2xl"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between border-b border-pink-300/40 px-3 py-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-pink-200">
          gradient tuner
        </span>
        <button
          type="button"
          onPointerDown={() => setOpen(false)}
          className="text-violet-200 hover:text-pink-300"
          aria-label="Close tuner"
        >
          ×
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2 text-xs">
        <RegionSelect value={target} onChange={setTarget} />
        <CopyAllButton region={target} />
        <FogBlock region={target} />
        {ROLES.map((role) => (
          <RoleBlock key={role} region={target} role={role} />
        ))}
        <div className="mt-3 text-[10px] text-violet-300/60">
          edits mutate REGIONS in place; use Copy buttons to paste
          values back into regions.ts / tuner.ts.
        </div>
      </div>
    </div>
  );
}

// Variable-name prefix used in regions.ts (e.g. BLOD_GROUND). Most
// region IDs map to their upper-case form; `remnants` keeps the
// singular convention the existing code already uses.
const VAR_PREFIX: Record<RegionId, string> = {
  lysningen: 'LYSNINGEN',
  blod: 'BLOD',
  geometri: 'GEOMETRI',
  siste: 'SISTE',
  senter: 'SENTER',
  remnants: 'REMNANT',
};

function formatStopsBlock(region: RegionId, role: PaletteRole): string {
  const stops = getRegionStops(region, role);
  const varName = `${VAR_PREFIX[region] ?? region.toUpperCase()}_${role.toUpperCase()}`;
  const lines = stops.map(([t, c]) => `  [${t.toFixed(2)}, '${c}'],`).join('\n');
  return `const ${varName}: Stop[] = [\n${lines}\n];`;
}

function formatFogLine(region: RegionId, fog: FogConfig): string {
  return `  ${region}: { color: '${fog.color}', near: ${fog.near}, far: ${fog.far} },`;
}

function formatRegionAll(region: RegionId, fog: FogConfig): string {
  const palette = ROLES.map((role) => formatStopsBlock(region, role)).join('\n\n');
  return [
    `// === ${VAR_PREFIX[region] ?? region.toUpperCase()} — paste palette into regions.ts ===`,
    palette,
    '',
    `// fog (paste into tuner.ts DEFAULT_FOG):`,
    formatFogLine(region, fog),
  ].join('\n');
}

function RegionSelect({
  value,
  onChange,
}: {
  value: RegionId;
  onChange: (v: RegionId) => void;
}) {
  return (
    <label className="mb-3 block">
      <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-pink-200">
        region
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as RegionId)}
        className="block w-full rounded border border-pink-300/40 bg-violet-900/80 px-2 py-1 text-xs text-violet-100"
      >
        {REGIONS.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name} ({r.id})
          </option>
        ))}
      </select>
    </label>
  );
}

function FogBlock({ region }: { region: RegionId }) {
  const fog = useTuner((s) => s.fogByRegion[region]);
  const setFog = useTuner((s) => s.setFog);

  return (
    <div className="mb-4 rounded border border-pink-300/30 bg-violet-900/40 p-2">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-widest text-pink-200">
          fog
        </span>
        <CopyButton getText={() => formatFogLine(region, fog)} />
      </div>
      <div className="mb-2 flex items-center gap-2">
        <input
          type="color"
          value={fog.color}
          onChange={(e) => setFog(region, { color: e.target.value })}
          className="h-7 w-10 cursor-pointer rounded border border-pink-300/40 bg-transparent p-0"
        />
        <span className="font-mono text-[10px] text-violet-200">{fog.color}</span>
      </div>
      <SliderRow
        label="near"
        value={fog.near}
        min={1}
        max={120}
        step={1}
        onChange={(v) => setFog(region, { near: v })}
      />
      <SliderRow
        label="far"
        value={fog.far}
        min={5}
        max={200}
        step={1}
        onChange={(v) => setFog(region, { far: v })}
      />
    </div>
  );
}

function RoleBlock({ region, role }: { region: RegionId; role: PaletteRole }) {
  // Read live from REGIONS via getRegionStops. paletteRevision bumps
  // every time mutateRegionStops fires, forcing this component to
  // re-read so the displayed colours stay in sync with what the
  // shader is actually sampling.
  const revision = useTuner((s) => s.paletteRevision);
  const bumpPalette = useTuner((s) => s.bumpPalette);
  // Stops aren't reactive — we read on render, swap on edit.
  // `revision` in the dependency list keeps this in sync after every
  // setStop call.
  const stops: Stop[] = getRegionStops(region, role);
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  revision;

  const setStop = (index: number, color: string) => {
    const next: Stop[] = stops.map((s, i) => (i === index ? [s[0], color] : s));
    mutateRegionStops(region, role, next);
    bumpPalette();
  };

  return (
    <div className="mb-3 rounded border border-pink-300/30 bg-violet-900/40 p-2">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-widest text-pink-200">
          {role}
        </span>
        <CopyButton getText={() => formatStopsBlock(region, role)} />
      </div>
      <div className="flex flex-col gap-1">
        {stops.map(([t, color], i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-9 text-right font-mono text-[10px] text-violet-300">
              {t.toFixed(2)}
            </span>
            <input
              type="color"
              value={normaliseHex(color)}
              onChange={(e) => setStop(i, e.target.value)}
              className="h-6 w-10 cursor-pointer rounded border border-pink-300/40 bg-transparent p-0"
            />
            <span className="flex-1 font-mono text-[10px] text-violet-200">
              {color}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="mb-1 block">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-widest text-violet-200">
          {label}
        </span>
        <span className="font-mono text-[10px] tabular-nums text-violet-200">
          {value.toFixed(0)}
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
    </label>
  );
}

// Top-of-panel button: dumps EVERY palette + fog value for the
// active region into the clipboard, prefixed with paste-ready
// comments so the user can drop the whole block into regions.ts /
// tuner.ts.
function CopyAllButton({ region }: { region: RegionId }) {
  const fog = useTuner((s) => s.fogByRegion[region]);
  // Subscribe to paletteRevision so the snapshot reads fresh REGIONS
  // every time the user re-clicks after edits.
  const revision = useTuner((s) => s.paletteRevision);
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  revision;
  return (
    <div className="mb-3">
      <CopyButton
        label="copy all values"
        getText={() => formatRegionAll(region, fog)}
        wide
      />
    </div>
  );
}

// Reusable copy-to-clipboard button. Briefly flips its label to
// "copied!" so the user gets visible confirmation.
function CopyButton({
  getText,
  label = 'copy',
  wide = false,
}: {
  getText: () => string;
  label?: string;
  wide?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  // Auto-reset the "copied!" badge so a second click later still
  // flips it back into action.
  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 1200);
    return () => clearTimeout(id);
  }, [copied]);

  const onClick = async () => {
    const text = getText();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      // Fallback: select-and-copy via a temporary textarea (covers
      // browsers / iframe contexts where clipboard API is blocked).
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        setCopied(true);
      } catch {
        // give up silently — user can still read the panel and type.
      }
      document.body.removeChild(ta);
    }
  };

  return (
    <button
      type="button"
      onPointerDown={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={
        'rounded border border-pink-300/40 px-2 py-1 text-[10px] font-bold uppercase tracking-widest transition active:scale-95 ' +
        (copied
          ? 'bg-emerald-700/60 text-emerald-100'
          : 'bg-violet-800/60 text-pink-200 hover:bg-violet-700/70') +
        (wide ? ' block w-full text-center' : '')
      }
    >
      {copied ? 'copied!' : label}
    </button>
  );
}

// HTML <input type="color"> only accepts 6-digit hex. Some palette
// stops live with shorter forms or rgb() — strip / coerce to a safe
// 6-digit hex so the picker doesn't reset to black on first render.
function normaliseHex(c: string): string {
  if (/^#[0-9a-f]{6}$/i.test(c)) return c.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(c)) {
    return (
      '#' +
      c
        .slice(1)
        .split('')
        .map((ch) => ch + ch)
        .join('')
        .toLowerCase()
    );
  }
  return '#000000';
}
