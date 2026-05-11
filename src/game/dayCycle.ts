// Synced to absolute UTC so every client sees the same cycle position.
// 10-minute period: 00:00 UTC start of cycle, 00:10 next, etc.
const CYCLE_MS = 10 * 60 * 1000;

// Returns 0..1 around the cycle. 0 = dawn, 0.25 = noon, 0.5 = dusk, 0.75 = midnight.
export function dayPhase(): number {
  return (Date.now() % CYCLE_MS) / CYCLE_MS;
}

// Smooth brightness curve — peaks at noon, troughs at midnight. Floor
// kept high so the world reads as a vibrant glowing biome at all hours,
// with the cycle adding a subtle pulse rather than a real day/night.
export function dayBrightness(phase: number): number {
  return 0.95 + 0.45 * (0.5 + 0.5 * Math.cos(2 * Math.PI * (phase - 0.25)));
}

// Hue rotation in radians. Smaller sweep (±π/12 ≈ ±15°) keeps the
// blue spawn region readable as blue throughout the cycle — only a
// gentle warm/cool drift, not a full hue swing into violet/magenta.
export function dayHueAngle(phase: number): number {
  return Math.cos(2 * Math.PI * (phase - 0.25)) * (Math.PI / 12);
}
