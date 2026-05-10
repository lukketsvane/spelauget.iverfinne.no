# Character Voice Pack

Drop-in TotK-style talking grunts for dialogue. 9 character voices, ~10–30 short
clips each. Designed to be played one clip per dialogue chunk (or every 2–3
revealed characters), with a small random pitch/rate jitter so it never repeats
exactly the same way.

## Folders

Each subfolder is one character voice. Pick the one whose timbre fits the NPC,
or assign a different folder to each character.

| Folder           | Source              | Vibe                                          |
|------------------|---------------------|-----------------------------------------------|
| `alex/`          | SDAP – Alex Brodie  | Male, mid, calm – everyday human NPC          |
| `ian/`           | SDAP – Ian Lampert  | Male, light – younger / energetic             |
| `sean/`          | SDAP – Sean Lenhart | Male, raspier – gruff / older                 |
| `karen/`         | SDAP – Karen Cenon  | Female, mid – everyday human NPC              |
| `meghan/`        | SDAP – Meghan C.    | Female, light – younger / softer              |
| `pixel_lowest/`  | Animalese bank      | Synthetic, very low – heavy creature / boss   |
| `pixel_low/`     | Animalese bank      | Synthetic, low – troll / spirit               |
| `pixel_med/`     | Animalese bank      | Synthetic, mid – generic creature             |
| `pixel_high/`    | Animalese bank      | Synthetic, high – sprite / korok-ish          |

All clips are mono OGG, normalised to ~-16 dBFS, capped at ~600ms with a soft
fade-out, so they sit cleanly under dialogue music without spiking.

## Recommended usage pattern

TotK plays *one* short grunt per dialogue chunk (per visible-text-burst), not
per letter. The cheapest way to feel TotK-y:

1. Pick a folder per character. Preload all clips at game start.
2. On each dialogue advance / new chunk reveal, pick a random clip from that
   character's pool.
3. Apply a tiny pitch jitter (±2 semitones, i.e. playbackRate 0.89–1.12) so
   repeats sound different.
4. Don't play if the previous clip is still playing — debounce ~150ms.

A minimal Web Audio implementation is in `voice-player.js`. A drop-in React
hook is in `useCharacterVoice.tsx`.

## Multiplying voices from one bank

Two characters can share the same folder if you give each a different
`pitchRange` and `rate`. e.g. character A uses `pixel_med` at pitch 1.0,
character B uses `pixel_med` at pitch 0.85 + 0.9× speed → sounds like a
totally different creature. With 9 banks × 3 pitch presets you have 27
distinguishable voices for free.

## Per-character profile examples

```ts
// suggestion: for the moody/wistful dialogue style in your screenshots
const profiles = {
  cleaner:        { pool: 'pixel_lowest', pitchRange: [0.95, 1.05], rate: 0.85, volume: 0.55 },
  forest_spirit:  { pool: 'pixel_high',   pitchRange: [0.92, 1.10], rate: 1.00, volume: 0.40 },
  worried_mother: { pool: 'karen',        pitchRange: [0.95, 1.05], rate: 0.95, volume: 0.50 },
  old_man:        { pool: 'sean',         pitchRange: [0.85, 0.95], rate: 0.90, volume: 0.55 },
  child:          { pool: 'meghan',       pitchRange: [1.10, 1.20], rate: 1.05, volume: 0.45 },
};
```

## License & attribution

See `ATTRIBUTION.md`. **You must credit Dillon Becker** for the human voice
clips somewhere in your game (credits scene or readme — short text is fine).
The Animalese syllable bank (pixel_*) is MIT, technically no attribution
required but good practice to credit `equalo-official/animalese-generator`.

